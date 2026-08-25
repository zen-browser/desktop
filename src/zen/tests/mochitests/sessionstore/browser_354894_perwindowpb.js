/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * Checks that restoring the last browser window in session is actually
 * working.
 *
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=354894
 * Note: It is implicitly tested that restoring the last window works when
 * non-browser windows are around. The "Run Tests" window as well as the main
 * browser window (wherein the test code gets executed) won't be considered
 * browser windows. To achiveve this said main browser window has its windowtype
 * attribute modified so that it's not considered a browser window any longer.
 * This is crucial, because otherwise there would be two browser windows around,
 * said main test window and the one opened by the tests, and hence the new
 * logic wouldn't be executed at all.
 * Note: Mac only tests the new notifications, as restoring the last window is
 * not enabled on that platform (platform shim; the application is kept running
 * although there are no windows left)
 * Note: There is a difference when closing a browser window with
 * BrowserCommands.tryToCloseWindow() as opposed to close(). The former will make
 * nsSessionStore restore a window next time it gets a chance and will post
 * notifications. The latter won't.
 */

// The rejection "BrowserWindowTracker.getTopWindow(...) is null" is left
// unhandled in some cases. This bug should be fixed, but for the moment this
// file allows a class of rejections.
//
// NOTE: Allowing a whole class of rejections should be avoided. Normally you
//       should use "expectUncaughtRejection" to flag individual failures.
const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);
PromiseTestUtils.allowMatchingRejectionsGlobally(/getTopWindow/);

// Some urls that might be opened in tabs and/or popups
// Do not use about:blank:
// That one is reserved for special purposes in the tests
const TEST_URLS = ["about:mozilla", "about:buildconfig"];

// Number of -request notifications to except
// remember to adjust when adding new tests
const NOTIFICATIONS_EXPECTED = 6;

// Window features of popup windows
const POPUP_FEATURES = "toolbar=no,resizable=no,status=no";

// Window features of browser windows
const CHROME_FEATURES = "chrome,all,dialog=no";

const IS_MAC = navigator.platform.match(/Mac/);

/**
 * Returns an Object with two properties:
 *   open (int):
 *     A count of how many non-closed navigator:browser windows there are.
 *   winstates (int):
 *     A count of how many windows there are in the SessionStore state.
 */
function getBrowserWindowsCount() {
  let open = 0;
  for (let win of Services.wm.getEnumerator("navigator:browser")) {
    if (!win.closed) {
      ++open;
    }
  }

  let winstates = JSON.parse(ss.getBrowserState()).windows.length;

  return { open, winstates };
}

add_setup(async function () {
  // Make sure we've only got one browser window to start with
  let { open, winstates } = getBrowserWindowsCount();
  is(open, 1, "Should only be one open window");
  is(winstates, 1, "Should only be one window state in SessionStore");

  // This test takes some time to run, and it could timeout randomly.
  // So we require a longer timeout. See bug 528219.
  requestLongerTimeout(3);

  // Make the main test window not count as a browser window any longer
  let oldWinType = document.documentElement.getAttribute("windowtype");
  document.documentElement.setAttribute("windowtype", "navigator:testrunner");

  registerCleanupFunction(() => {
    document.documentElement.setAttribute("windowtype", oldWinType);
  });
});

/**
 * Sets up one of our tests by setting the right preferences, and
 * then opening up a browser window preloaded with some tabs.
 *
 * @param options (Object)
 *        An object that can contain the following properties:
 *
 *        private:
 *          Whether or not the opened window should be private.
 *
 *        denyFirst:
 *          Whether or not the first window that attempts to close
 *          via closeWindowForRestoration should be denied.
 *
 * @param testFunction (Function*)
 *        A generator function that yields Promises to be run
 *        once the test has been set up.
 *
 * @returns Promise
 *        Resolves once the test has been cleaned up.
 */
let setupTest = async function (options, testFunction) {
  await pushPrefs(
    ["browser.startup.page", 3],
    ["browser.tabs.warnOnClose", false]
  );
  // SessionStartup caches pref values, but as this test tries to simulate a
  // startup scenario, we'll reset them here.
  SessionStartup.resetForTest();

  // Observe these, and also use to count the number of hits
  let observing = {
    "browser-lastwindow-close-requested": 0,
    "browser-lastwindow-close-granted": 0,
  };

  /**
   * Helper: Will observe and handle the notifications for us
   */
  let hitCount = 0;
  function observer(aCancel, aTopic) {
    // count so that we later may compare
    observing[aTopic]++;

    // handle some tests
    if (options.denyFirst && ++hitCount == 1) {
      aCancel.QueryInterface(Ci.nsISupportsPRBool).data = true;
    }
  }

  for (let o in observing) {
    Services.obs.addObserver(observer, o);
  }

  let newWin = await promiseNewWindowLoaded({
    private: options.private || false,
  });

  await injectTestTabs(newWin);

  await testFunction(newWin, observing);

  let count = getBrowserWindowsCount();
  is(count.open, 0, "Got right number of open windows");
  is(count.winstates, 1, "Got right number of stored window states");

  for (let o in observing) {
    Services.obs.removeObserver(observer, o);
  }

  await popPrefs();
  // Act like nothing ever happened.
  SessionStartup.resetForTest();
};

/**
 * Loads a TEST_URLS into a browser window.
 *
 * @param win (Window)
 *        The browser window to load the tabs in
 */
function injectTestTabs(win) {
  let promises = TEST_URLS.map(url =>
    BrowserTestUtils.addTab(win.gBrowser, url)
  ).map(tab => BrowserTestUtils.browserLoaded(tab.linkedBrowser));
  return Promise.all(promises);
}

/**
 * Attempts to close a window via BrowserCommands.tryToCloseWindow so that
 * we get the browser-lastwindow-close-requested and
 * browser-lastwindow-close-granted observer notifications.
 *
 * @param win (Window)
 *        The window to try to close
 * @returns Promise
 *        Resolves to true if the window closed, or false if the window
 *        was denied the ability to close.
 */
function closeWindowForRestoration(win) {
  return new Promise(resolve => {
    let closePromise = BrowserTestUtils.windowClosed(win);
    win.BrowserCommands.tryToCloseWindow();
    if (!win.closed) {
      resolve(false);
      return;
    }

    closePromise.then(() => {
      resolve(true);
    });
  });
}

/**
 * Normal in-session restore
 *
 * Note: Non-Mac only
 *
 * Should do the following:
 *  1. Open a new browser window
 *  2. Add some tabs
 *  3. Close that window
 *  4. Opening another window
 *  5. Checks that state is restored
 */
add_task(async function test_open_close_normal() {
  if (IS_MAC) {
    return;
  }

  await setupTest({ denyFirst: true }, async function (newWin, obs) {
    let closed = await closeWindowForRestoration(newWin);
    ok(!closed, "First close request should have been denied");

    closed = await closeWindowForRestoration(newWin);
    ok(closed, "Second close request should be accepted");

    newWin = await promiseNewWindowLoaded();
    is(
      newWin.gBrowser.browsers.length,
      TEST_URLS.length + 2,
      "Restored window in-session with otherpopup windows around"
    );

    // Note that this will not result in the the browser-lastwindow-close
    // notifications firing for this other newWin.
    await BrowserTestUtils.closeWindow(newWin);

    // setupTest gave us a window which was denied for closing once, and then
    // closed.
    is(
      obs["browser-lastwindow-close-requested"],
      2,
      "Got expected browser-lastwindow-close-requested notifications"
    );
    is(
      obs["browser-lastwindow-close-granted"],
      1,
      "Got expected browser-lastwindow-close-granted notifications"
    );
  });
});

/**
 * PrivateBrowsing in-session restore
 *
 * Note: Non-Mac only
 *
 * Should do the following:
 *  1. Open a new browser window A
 *  2. Add some tabs
 *  3. Close the window A as the last window
 *  4. Open a private browsing window B
 *  5. Make sure that B didn't restore the tabs from A
 *  6. Close private browsing window B
 *  7. Open a new window C
 *  8. Make sure that new window C has restored tabs from A
 */
add_task(async function test_open_close_private_browsing() {
  if (IS_MAC) {
    return;
  }

  await setupTest({}, async function (newWin, obs) {
    let closed = await closeWindowForRestoration(newWin);
    ok(closed, "Should be able to close the window");

    newWin = await promiseNewWindowLoaded({ private: true });
    is(
      newWin.gBrowser.browsers.length,
      1,
      "Did not restore in private browsing mode"
    );

    closed = await closeWindowForRestoration(newWin);
    ok(closed, "Should be able to close the window");

    newWin = await promiseNewWindowLoaded();
    is(
      newWin.gBrowser.browsers.length,
      TEST_URLS.length + 2,
      "Restored tabs in a new non-private window"
    );

    // Note that this will not result in the the browser-lastwindow-close
    // notifications firing for this other newWin.
    await BrowserTestUtils.closeWindow(newWin);

    // We closed two windows with closeWindowForRestoration, and both
    // should have been successful.
    is(
      obs["browser-lastwindow-close-requested"],
      2,
      "Got expected browser-lastwindow-close-requested notifications"
    );
    is(
      obs["browser-lastwindow-close-granted"],
      2,
      "Got expected browser-lastwindow-close-granted notifications"
    );
  });
});

/**
 * Open some popup window to check it isn't restored. Instead nothing at all
 * should be restored
 *
 * Note: Non-Mac only
 *
 * Should do the following:
 *  1. Open a popup
 *  2. Add another tab to the popup (so that it gets stored) and close it again
 *  3. Open a window
 *  4. Check that nothing at all is restored
 *  5. Open two browser windows and close them again
 *  6. undoCloseWindow() one
 *  7. Open another browser window
 *  8. Check that nothing at all is restored
 */
add_task(async function test_open_close_only_popup() {
  if (IS_MAC) {
    return;
  }

  await setupTest({}, async function (newWin, obs) {
    // We actually don't care about the initial window in this test.
    await BrowserTestUtils.closeWindow(newWin);

    // This will cause nsSessionStore to restore a window the next time it
    // gets a chance.
    let popupPromise = BrowserTestUtils.waitForNewWindow();
    openDialog(location, "popup", POPUP_FEATURES, TEST_URLS[1]);
    let popup = await popupPromise;

    is(
      popup.gBrowser.browsers.length,
      1,
      "Did not restore the popup window (1)"
    );

    let closed = await closeWindowForRestoration(popup);
    ok(closed, "Should be able to close the window");

    popupPromise = BrowserTestUtils.waitForNewWindow();
    openDialog(location, "popup", POPUP_FEATURES, TEST_URLS[1]);
    popup = await popupPromise;

    BrowserTestUtils.addTab(popup.gBrowser, TEST_URLS[0]);
    is(
      popup.gBrowser.browsers.length,
      2,
      "Did not restore to the popup window (2)"
    );

    await BrowserTestUtils.closeWindow(popup);

    newWin = await promiseNewWindowLoaded();
    isnot(
      newWin.gBrowser.browsers.length,
      2,
      "Did not restore the popup window"
    );
    is(
      TEST_URLS.indexOf(newWin.gBrowser.browsers[0].currentURI.spec),
      -1,
      "Did not restore the popup window (2)"
    );
    await BrowserTestUtils.closeWindow(newWin);

    // We closed one popup window with closeWindowForRestoration, and popup
    // windows should never fire the browser-lastwindow notifications.
    is(
      obs["browser-lastwindow-close-requested"],
      0,
      "Got expected browser-lastwindow-close-requested notifications"
    );
    is(
      obs["browser-lastwindow-close-granted"],
      0,
      "Got expected browser-lastwindow-close-granted notifications"
    );
  });
});

/**
 * Open some windows and do undoCloseWindow. This should prevent any
 * restoring later in the test
 *
 * Note: Non-Mac only
 *
 * Should do the following:
 *  1. Open two browser windows and close them again
 *  2. undoCloseWindow() one
 *  3. Open another browser window
 *  4. Make sure nothing at all is restored
 */
add_task(async function test_open_close_restore_from_popup() {
  if (IS_MAC) {
    return;
  }

  await setupTest({}, async function (newWin) {
    let newWin2 = await promiseNewWindowLoaded();
    await injectTestTabs(newWin2);

    let closed = await closeWindowForRestoration(newWin);
    ok(closed, "Should be able to close the window");
    closed = await closeWindowForRestoration(newWin2);
    ok(closed, "Should be able to close the window");

    let counts = getBrowserWindowsCount();
    is(counts.open, 0, "Got right number of open windows");
    is(counts.winstates, 1, "Got right number of window states");

    newWin = SessionWindowUI.undoCloseWindow(0);
    await BrowserTestUtils.waitForEvent(newWin, "load");

    // Make sure we wait until this window is restored.
    await BrowserTestUtils.waitForEvent(
      newWin.gBrowser.tabContainer,
      "SSTabRestored"
    );

    newWin2 = await promiseNewWindowLoaded();

    is(
      TEST_URLS.indexOf(newWin2.gBrowser.browsers[0].currentURI.spec),
      -1,
      "Did not restore, as undoCloseWindow() was last called (2)"
    );

    counts = getBrowserWindowsCount();
    is(counts.open, 2, "Got right number of open windows");
    is(counts.winstates, 3, "Got right number of window states");

    await BrowserTestUtils.closeWindow(newWin);
    await BrowserTestUtils.closeWindow(newWin2);

    counts = getBrowserWindowsCount();
    is(counts.open, 0, "Got right number of open windows");
    is(counts.winstates, 1, "Got right number of window states");
  });
});

/**
 * Test if closing can be denied on Mac.
 *
 * Note: Mac only
 */
add_task(async function test_mac_notifications() {
  if (!IS_MAC) {
    return;
  }

  await setupTest({ denyFirst: true }, async function (newWin, obs) {
    let closed = await closeWindowForRestoration(newWin);
    ok(!closed, "First close attempt should be denied");
    closed = await closeWindowForRestoration(newWin);
    ok(closed, "Second close attempt should be granted");

    // We tried closing once, and got denied. Then we tried again and
    // succeeded. That means 2 close requests, and 1 close granted.
    is(
      obs["browser-lastwindow-close-requested"],
      2,
      "Got expected browser-lastwindow-close-requested notifications"
    );
    is(
      obs["browser-lastwindow-close-granted"],
      1,
      "Got expected browser-lastwindow-close-granted notifications"
    );
  });
});
