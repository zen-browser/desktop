"use strict";

let { PluginManager } = ChromeUtils.importESModule(
  "resource:///actors/PluginParent.sys.mjs"
);

/**
 * Test that the notification bar for crashed GMPs works.
 */
add_task(async function () {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:blank",
    },
    async function (browser) {
      // Ensure the parent has heard before the client.
      // In practice, this is always true for GMP crashes (but not for NPAPI ones!)
      let props = Cc["@mozilla.org/hash-property-bag;1"].createInstance(
        Ci.nsIWritablePropertyBag2
      );
      props.setPropertyAsUint32("pluginID", 1);
      props.setPropertyAsACString("pluginName", "GlobalTestPlugin");
      props.setPropertyAsACString("pluginDumpID", "1234");
      Services.obs.notifyObservers(props, "gmp-plugin-crash");

      await SpecialPowers.spawn(browser, [], async function () {
        const GMP_CRASH_EVENT = {
          pluginID: 1,
          pluginName: "GlobalTestPlugin",
          submittedCrashReport: false,
          bubbles: true,
          cancelable: true,
          gmpPlugin: true,
        };

        let crashEvent = new content.PluginCrashedEvent(
          "PluginCrashed",
          GMP_CRASH_EVENT
        );
        content.dispatchEvent(crashEvent);
      });

      let notification = await waitForNotificationBar(
        "plugin-crashed",
        browser
      );

      let notificationBox = gBrowser.getNotificationBox(browser);
      ok(notification, "Infobar was shown.");
      is(
        notification.priority,
        notificationBox.PRIORITY_WARNING_MEDIUM,
        "Correct priority."
      );
      is(
        notification.messageText.textContent.trim(),
        "The GlobalTestPlugin plugin has crashed.",
        "Correct message."
      );
    }
  );
});
