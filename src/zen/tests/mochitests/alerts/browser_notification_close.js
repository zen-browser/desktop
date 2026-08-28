"use strict";

const { PlacesTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PlacesTestUtils.sys.mjs"
);

const { PermissionTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PermissionTestUtils.sys.mjs"
);

let notificationURL =
  "https://example.org/browser/browser/base/content/test/alerts/file_dom_notifications.html";

add_task(async function test_notificationClose() {
  await addNotificationPermission(notificationURL);

  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: notificationURL,
    },
    async function dummyTabTask(aBrowser) {
      await openNotification(aBrowser, "showNotification2");

      info("Notification alert showing");

      let alertWindow = Services.wm.getMostRecentWindow("alert:alert");
      if (!alertWindow) {
        ok(true, "Notifications don't use XUL windows on all platforms.");
        await closeNotification(aBrowser);
        return;
      }

      let alertTitleLabel =
        alertWindow.document.getElementById("alertTitleLabel");
      is(
        alertTitleLabel.value,
        "Test title",
        "Title text of notification should be present"
      );
      let alertTextLabel =
        alertWindow.document.getElementById("alertTextLabel");
      is(
        alertTextLabel.textContent,
        "Test body 2",
        "Body text of notification should be present"
      );

      let alertCloseButton = alertWindow.document.querySelector(".close-icon");
      is(alertCloseButton.localName, "toolbarbutton", "close button found");
      let promiseBeforeUnloadEvent = BrowserTestUtils.waitForEvent(
        alertWindow,
        "beforeunload"
      );
      let closedTime = alertWindow.Date.now();
      alertCloseButton.click();
      info("Clicked on close button");
      await promiseBeforeUnloadEvent;

      ok(true, "Alert should close when the close button is clicked");
      let currentTime = alertWindow.Date.now();
      // The notification will self-close at 12 seconds, so this checks
      // that the notification closed before the timeout.
      Assert.less(
        currentTime - closedTime,
        5000,
        "Close requested at " +
          closedTime +
          ", actually closed at " +
          currentTime
      );
    }
  );
});

add_task(async function cleanup() {
  PermissionTestUtils.remove(notificationURL, "desktop-notification");
});
