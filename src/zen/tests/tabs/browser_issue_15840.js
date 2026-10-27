/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { NonPrivateTabs } = ChromeUtils.importESModule(
  "resource:///modules/OpenTabs.sys.mjs"
);

add_task(async function test_Open_Tabs_Exclude_Empty_Tab() {
  const emptyTab = gZenWorkspaces._emptyTab;
  ok(emptyTab?.hasAttribute("zen-empty-tab"), "Window has an empty tab");

  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "https://example.com" },
    async browser => {
      await NonPrivateTabs.readyWindowsPromise;
      const tab = gBrowser.getTabForBrowser(browser);

      const windowTabs = NonPrivateTabs.getTabsForWindow(window);
      ok(windowTabs.includes(tab), "Regular tab is listed");
      ok(!windowTabs.includes(emptyTab), "Empty tab is not listed");

      const recentTabs = NonPrivateTabs.getRecentTabs();
      ok(recentTabs.includes(tab), "Regular tab is in the recent tabs");
      ok(!recentTabs.includes(emptyTab), "Empty tab is not in the recent tabs");
    }
  );
});

add_task(async function test_Firefox_View_Excludes_Empty_Tab() {
  const emptyTab = gZenWorkspaces._emptyTab;

  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "about:firefoxview#opentabs" },
    async browser => {
      const viewTab = gBrowser.getTabForBrowser(browser);
      const openTabs = browser.contentDocument.querySelector(
        "named-deck > view-opentabs"
      );
      let tabItems;
      await TestUtils.waitForCondition(() => {
        const card = openTabs?.shadowRoot?.querySelector("view-opentabs-card");
        tabItems = card?.tabList?.tabItems;
        return tabItems?.length;
      }, "Wait for the open tabs card to have rows");

      const listedTabs = tabItems.map(item => item.tabElement);
      ok(listedTabs.includes(viewTab), "Firefox View tab is listed");
      ok(!listedTabs.includes(emptyTab), "Empty tab is not listed");
    }
  );
});
