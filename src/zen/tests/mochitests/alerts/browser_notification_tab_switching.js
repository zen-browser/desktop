/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

"use strict";

const { PermissionTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PermissionTestUtils.sys.mjs"
);

var tab;
var notification;
var notificationURL =
  "https://example.org/browser/browser/base/content/test/alerts/file_dom_notifications.html";
var newWindowOpenedFromTab;

add_task(async function test_notificationPreventDefaultAndSwitchTabs() {
  await addNotificationPermission(notificationURL);

  let originalTab = gBrowser.selectedTab;
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: notificationURL,
    },
    async function dummyTabTask(aBrowser) {
      // Put new tab in background so it is obvious when it is re-focused.
      await BrowserTestUtils.switchTab(gBrowser, originalTab);
      isnot(
        gBrowser.selectedBrowser,
        aBrowser,
        "Notification page loaded as a background tab"
      );

      // First, show a notification that will be have the tab-switching prevented.
      function promiseNotificationEvent(evt) {
        return SpecialPowers.spawn(
          aBrowser,
          [evt],
          async function (contentEvt) {
            return new Promise(resolve => {
              let contentNotification = content.wrappedJSObject._notification;
              contentNotification.addEventListener(
                contentEvt,
                function (event) {
                  resolve({ defaultPrevented: event.defaultPrevented });
                },
                { once: true }
              );
            });
          }
        );
      }
      await openNotification(aBrowser, "showNotification1");
      info("Notification alert showing");
      let alertWindow = Services.wm.getMostRecentWindow("alert:alert");
      if (!alertWindow) {
        ok(true, "Notifications don't use XUL windows on all platforms.");
        await closeNotification(aBrowser);
        return;
      }
      info("Clicking on notification");
      let promiseClickEvent = promiseNotificationEvent("click");

      // NB: This executeSoon is needed to allow the non-e10s runs of this test
      // a chance to set the event listener on the page. Otherwise, we
      // synchronously fire the click event before we listen for the event.
      executeSoon(() => {
        EventUtils.synthesizeMouseAtCenter(
          alertWindow.document.getElementById("alertTitleLabel"),
          {},
          alertWindow
        );
      });
      let clickEvent = await promiseClickEvent;
      ok(
        clickEvent.defaultPrevented,
        "The event handler for the first notification cancels the event"
      );
      isnot(
        gBrowser.selectedBrowser,
        aBrowser,
        "Notification page still a background tab"
      );
      let notificationClosed = promiseNotificationEvent("close");
      await closeNotification(aBrowser);
      await notificationClosed;

      // Second, show a notification that will cause the tab to get switched.
      await openNotification(aBrowser, "showNotification2");
      alertWindow = Services.wm.getMostRecentWindow("alert:alert");
      let promiseTabSelect = BrowserTestUtils.waitForEvent(
        gBrowser.tabContainer,
        "TabSelect"
      );
      EventUtils.synthesizeMouseAtCenter(
        alertWindow.document.getElementById("alertTitleLabel"),
        {},
        alertWindow
      );
      await promiseTabSelect;
      is(
        gBrowser.selectedBrowser.currentURI.spec,
        notificationURL,
        "Clicking on the second notification should select its originating tab"
      );
      notificationClosed = promiseNotificationEvent("close");
      await closeNotification(aBrowser);
      await notificationClosed;
    }
  );
});

add_task(async function cleanup() {
  PermissionTestUtils.remove(notificationURL, "desktop-notification");
});
