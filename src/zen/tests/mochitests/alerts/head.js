// Platforms may default to reducing motion. We override this to ensure the
// alert slide animation is enabled in tests.
SpecialPowers.pushPrefEnv({
  set: [["ui.prefersReducedMotion", 0]],
});

async function addNotificationPermission(originString) {
  return SpecialPowers.pushPermissions([
    {
      type: "desktop-notification",
      allow: true,
      context: originString,
    },
  ]);
}

/**
 * Similar to `BrowserTestUtils.closeWindow`, but
 * doesn't call `window.close()`.
 */
function promiseWindowClosed(window) {
  return new Promise(function (resolve) {
    Services.ww.registerNotification(function observer(subject, topic) {
      if (topic == "domwindowclosed" && subject == window) {
        Services.ww.unregisterNotification(observer);
        resolve();
      }
    });
  });
}

/**
 * These two functions work with file_dom_notifications.html to open the
 * notification and close it.
 *
 * |fn| can be showNotification1 or showNotification2.
 * if |timeout| is passed, then the promise returned from this function is
 * rejected after the requested number of miliseconds.
 */
function openNotification(aBrowser, fn, timeout) {
  info(`openNotification: ${fn}`);
  return SpecialPowers.spawn(
    aBrowser,
    [fn, timeout],
    async function (contentFn, contentTimeout) {
      await new Promise((resolve, reject) => {
        let win = content.wrappedJSObject;
        let notification = win[contentFn]();
        win._notification = notification;

        function listener() {
          notification.removeEventListener("show", listener);
          resolve();
        }

        notification.addEventListener("show", listener);

        if (contentTimeout) {
          content.setTimeout(() => {
            notification.removeEventListener("show", listener);
            reject("timed out");
          }, contentTimeout);
        }
      });
    }
  );
}

function closeNotification(aBrowser) {
  return SpecialPowers.spawn(aBrowser, [], function () {
    content.wrappedJSObject._notification.close();
  });
}
