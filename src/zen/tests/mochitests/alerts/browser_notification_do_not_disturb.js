/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that notifications can be silenced using nsIAlertsDoNotDisturb
 * on systems where that interface and its methods are implemented for
 * the nsIAlertService.
 */

const ALERT_SERVICE = Cc["@mozilla.org/alerts-service;1"]
  .getService(Ci.nsIAlertsService)
  .QueryInterface(Ci.nsIAlertsDoNotDisturb);

const PAGE =
  "https://example.org/browser/browser/base/content/test/alerts/file_dom_notifications.html";

// The amount of time in seconds that we will wait for a notification
// to show up before we decide that it's not coming.
const NOTIFICATION_TIMEOUT_SECS = 2000;

add_setup(async function () {
  await addNotificationPermission(PAGE);
});

/**
 * Test that the manualDoNotDisturb attribute can prevent
 * notifications from appearing.
 */
add_task(async function test_manualDoNotDisturb() {
  try {
    // Only run the test if the do-not-disturb
    // interface has been implemented.
    ALERT_SERVICE.manualDoNotDisturb;
    ok(true, "Alert service implements do-not-disturb interface");
  } catch (e) {
    ok(
      true,
      "Alert service doesn't implement do-not-disturb interface, exiting test"
    );
    return;
  }

  // In the event that something goes wrong during this test, make sure
  // we put the attribute back to the default setting when this test file
  // exits.
  registerCleanupFunction(() => {
    ALERT_SERVICE.manualDoNotDisturb = false;
  });

  // Make sure that do-not-disturb is not enabled before we start.
  ok(
    !ALERT_SERVICE.manualDoNotDisturb,
    "Alert service should not be disabled when test starts"
  );

  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    await openNotification(browser, "showNotification2");

    info("Notification alert showing");

    let alertWindow = Services.wm.getMostRecentWindow("alert:alert");

    // For now, only the XUL alert backend implements the manualDoNotDisturb
    // method for nsIAlertsDoNotDisturb, so we expect there to be a XUL alert
    // window. If the method gets implemented by native backends in the future,
    // we'll probably want to branch here and set the manualDoNotDisturb
    // attribute manually.
    ok(alertWindow, "Expected a XUL alert window.");

    // We're using the XUL notification backend. This means that there's
    // a menuitem for enabling manualDoNotDisturb. We exercise that
    // menuitem here.
    let doNotDisturbMenuItem = alertWindow.document.getElementById(
      "doNotDisturbMenuItem"
    );
    is(doNotDisturbMenuItem.localName, "menuitem", "menuitem found");

    let unloadPromise = BrowserTestUtils.waitForEvent(
      alertWindow,
      "beforeunload"
    );

    doNotDisturbMenuItem.click();
    info("Clicked on do-not-disturb menuitem");
    await unloadPromise;

    // At this point, we should be configured to not display notifications
    // to the user.
    ok(
      ALERT_SERVICE.manualDoNotDisturb,
      "Alert service should be disabled after clicking menuitem"
    );

    // The notification should not appear, but there is no way from the
    // client-side to know that it was blocked, except for waiting some time
    // and realizing that the "onshow" event never fired.
    await Assert.rejects(
      openNotification(browser, "showNotification2", NOTIFICATION_TIMEOUT_SECS),
      /timed out/,
      "The notification should never display."
    );

    ALERT_SERVICE.manualDoNotDisturb = false;
  });
});

/**
 * Test that the suppressForScreenSharing attribute can prevent
 * notifications from appearing.
 */
add_task(async function test_suppressForScreenSharing() {
  try {
    // Only run the test if the do-not-disturb
    // interface has been implemented.
    ALERT_SERVICE.suppressForScreenSharing;
    ok(true, "Alert service implements do-not-disturb interface");
  } catch (e) {
    ok(
      true,
      "Alert service doesn't implement do-not-disturb interface, exiting test"
    );
    return;
  }

  // In the event that something goes wrong during this test, make sure
  // we put the attribute back to the default setting when this test file
  // exits.
  registerCleanupFunction(() => {
    ALERT_SERVICE.suppressForScreenSharing = false;
  });

  // Make sure that do-not-disturb is not enabled before we start.
  ok(
    !ALERT_SERVICE.suppressForScreenSharing,
    "Alert service should not be suppressing for screen sharing when test " +
      "starts"
  );

  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    await openNotification(browser, "showNotification2");

    info("Notification alert showing");
    await closeNotification(browser);
    ALERT_SERVICE.suppressForScreenSharing = true;

    // The notification should not appear, but there is no way from the
    // client-side to know that it was blocked, except for waiting some time
    // and realizing that the "onshow" event never fired.
    await Assert.rejects(
      openNotification(browser, "showNotification2", NOTIFICATION_TIMEOUT_SECS),
      /timed out/,
      "The notification should never display."
    );
  });

  ALERT_SERVICE.suppressForScreenSharing = false;
});
