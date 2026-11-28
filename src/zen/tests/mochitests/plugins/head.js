ChromeUtils.defineESModuleGetters(this, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

// Various tests in this directory may define gTestBrowser, to use as the
// default browser under test in some of the functions below.
/* global gTestBrowser:true */

/**
 * Waits a specified number of miliseconds.
 *
 * Usage:
 *    let wait = yield waitForMs(2000);
 *    ok(wait, "2 seconds should now have elapsed");
 *
 * @param aMs the number of miliseconds to wait for
 * @returns a Promise that resolves to true after the time has elapsed
 */
function waitForMs(aMs) {
  return new Promise(resolve => {
    setTimeout(done, aMs);
    function done() {
      resolve(true);
    }
  });
}

// Returns a promise for nsIObjectLoadingContent props data.
function promiseForPluginInfo(aId, aBrowser) {
  let browser = aBrowser || gTestBrowser;
  return SpecialPowers.spawn(browser, [aId], async function (contentId) {
    let plugin = content.document.getElementById(contentId);
    if (!(plugin instanceof Ci.nsIObjectLoadingContent)) {
      throw new Error("no plugin found");
    }
    return {
      activated: plugin.activated,
      hasRunningPlugin: plugin.hasRunningPlugin,
      displayedType: plugin.displayedType,
    };
  });
}

/**
 * Allows setting focus on a window, and waiting for that window to achieve
 * focus.
 *
 * @param aWindow
 *        The window to focus and wait for.
 *
 * @returns {Promise<void>}
 *   Resolved when the window is focused.
 */
function promiseWaitForFocus(aWindow) {
  return new Promise(resolve => {
    waitForFocus(resolve, aWindow);
  });
}

/**
 * Returns a Promise that resolves when a notification bar
 * for a browser is shown. Alternatively, for old-style callers,
 * can automatically call a callback before it resolves.
 *
 * @param notificationID
 *        The ID of the notification to look for.
 * @param browser
 *        The browser to check for the notification bar.
 * @param callback (optional)
 *        A function to be called just before the Promise resolves.
 *
 * @return Promise
 */
async function waitForNotificationBar(notificationID, browser, callback) {
  let notificationBox = gBrowser.getNotificationBox(browser);
  let notification = await TestUtils.waitForCondition(
    () => notificationBox.getNotificationWithValue(notificationID),
    `Waited too long for the ${notificationID} notification bar`,
    100,
    100
  );
  ok(notification, `Successfully got the ${notificationID} notification bar`);
  if (callback) {
    callback(notification);
  }
  return notification;
}

function promiseForNotificationBar(notificationID, browser) {
  return new Promise(resolve => {
    waitForNotificationBar(notificationID, browser, resolve);
  });
}

/**
 * Reshow a notification and call a callback when it is reshown.
 *
 * @param notification
 *        The notification to reshow
 * @param callback
 *        A function to be called when the notification has been reshown
 */
function waitForNotificationShown(notification, callback) {
  if (PopupNotifications.panel.state == "open") {
    executeSoon(callback);
    return;
  }
  PopupNotifications.panel.addEventListener(
    "popupshown",
    function () {
      callback();
    },
    { once: true }
  );
  notification.reshow();
}

function promiseForNotificationShown(notification) {
  return new Promise(resolve => {
    waitForNotificationShown(notification, resolve);
  });
}
