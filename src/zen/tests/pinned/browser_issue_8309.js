/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test that moving an Essential tab to a new window preserves its Essential status.
 * Regression test for https://github.com/zen-browser/desktop/issues/8309
 */

add_task(async function test_Essential_Tab_Move_To_New_Window() {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "https://example.com/",
    },
    async function (browser) {
      let tab = gBrowser.getTabForBrowser(browser);
      gZenPinnedTabManager.addToEssentials(tab);

      ok(
        tab.hasAttribute("zen-essential"),
        "The tab should be marked as essential"
      );
      ok(tab.pinned, "The tab should be pinned");

      let newWindow = gBrowser.replaceTabsWithWindow(tab);

      await BrowserTestUtils.waitForEvent(newWindow, "DOMContentLoaded");
      await BrowserTestUtils.waitForEvent(
        newWindow.gBrowser.tabContainer,
        "TabOpen"
      );

      await newWindow.gZenWorkspaces.promiseInitialized;

      let movedTab = newWindow.gBrowser.tabs[0];

      ok(movedTab, "The tab should exist in the new window");
      ok(
        movedTab.hasAttribute("zen-essential"),
        "The tab should still be marked as essential in the new window"
      );
      ok(
        movedTab.pinned,
        "The tab should still be pinned in the new window"
      );
      ok(
        movedTab.parentElement.closest(".zen-essentials-container"),
        "The tab should be in the essentials container in the new window"
      );

      await BrowserTestUtils.closeWindow(newWindow);
    }
  );
});
