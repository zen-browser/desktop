/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that if we have tabs that are still in the "click to
 * restore" state, that if their browsers crash, that we don't
 * show the crashed state for those tabs (since selecting them
 * should restore them anyway).
 */

const PREF = "browser.sessionstore.restore_on_demand";
const PAGE =
  "data:text/html,<html><body>A%20regular,%20everyday,%20normal%20page.";

add_task(async function test() {
  await pushPrefs([PREF, true]);

  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: PAGE,
    },
    async function (browser) {
      await TabStateFlusher.flush(browser);

      // We'll create a second "pending" tab. This is the one we'll
      // ensure doesn't go to about:tabcrashed. We start it non-remote
      // since this is how SessionStore creates all browsers before
      // they are restored.
      let unrestoredTab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
        skipAnimation: true,
        forceNotRemote: true,
      });

      let state = {
        entries: [{ url: PAGE, triggeringPrincipal_base64 }],
      };

      ss.setTabState(unrestoredTab, JSON.stringify(state));

      ok(!unrestoredTab.hasAttribute("crashed"), "tab is not crashed");
      ok(unrestoredTab.hasAttribute("pending"), "tab is pending");

      // Now crash the selected browser.
      await BrowserTestUtils.crashFrame(browser);

      ok(!unrestoredTab.hasAttribute("crashed"), "tab is still not crashed");
      ok(unrestoredTab.hasAttribute("pending"), "tab is still pending");

      // Selecting the tab should now restore it.
      gBrowser.selectedTab = unrestoredTab;
      await promiseTabRestored(unrestoredTab);

      ok(!unrestoredTab.hasAttribute("crashed"), "tab is still not crashed");
      ok(!unrestoredTab.hasAttribute("pending"), "tab is no longer pending");

      // The original tab should still be crashed
      let originalTab = gBrowser.getTabForBrowser(browser);
      ok(originalTab.hasAttribute("crashed"), "original tab is crashed");
      ok(!originalTab.isRemoteBrowser, "Should not be remote");

      // We'd better be able to restore it still.
      gBrowser.selectedTab = originalTab;
      SessionStore.reviveCrashedTab(originalTab);
      await promiseTabRestored(originalTab);

      // Clean up.
      BrowserTestUtils.removeTab(unrestoredTab);
    }
  );
});
