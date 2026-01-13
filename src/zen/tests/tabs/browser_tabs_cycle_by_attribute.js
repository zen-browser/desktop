/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL1 = "data:text/plain,tab1";
const URL2 = "data:text/plain,tab2";
const URL3 = "data:text/plain,tab3";
const URL4 = "data:text/plain,tab4";
const URL5 = "data:text/plain,tab5";
const URL6 = "data:text/plain,tab6";

/**
 * ensures that tab select action is completed
 *
 * @param {MozTabbrowserTab} tab - tab to select
 */
async function selectTab(tab) {
  const onSelect = BrowserTestUtils.waitForEvent(gBrowser.tabContainer, "TabSelect");
  gBrowser.selectedTab = tab;
  await onSelect;
}

add_setup(async () => {
  // remove default new tab
  const tabToRemove = gBrowser.selectedTab;
  BrowserTestUtils.removeTab(tabToRemove);

  const tabs = await Promise.all([
    addTabTo(gBrowser, URL1),
    addTabTo(gBrowser, URL2),
    addTabTo(gBrowser, URL3),
    addTabTo(gBrowser, URL4),
    addTabTo(gBrowser, URL5),
    addTabTo(gBrowser, URL6),
  ]);

  gZenPinnedTabManager.addToEssentials(tabs.slice(0, 3));
  await BrowserTestUtils.waitForCondition(
    () => tabs.slice(0, 3).every((tab) => tab.hasAttribute("zen-essential")),
    "all essentials ready"
  );

  const essentialTabs = gBrowser.tabs.filter((tab) => tab.hasAttribute("zen-essential"));
  Assert.equal(essentialTabs.length, 3, "3 essential tabs created");

  const workspaceTabs = gBrowser.tabs.filter(
    (tab) => !tab.hasAttribute("zen-essential") && !tab.hasAttribute("zen-empty-tab")
  );
  Assert.equal(workspaceTabs.length, 3, "3 workspace tabs created, excluding empty tab");

  registerCleanupFunction(async () => {
    // replace the default new tab in the test window
    addTabTo(gBrowser, "about:blank");
    tabs.forEach((element) => {
      BrowserTestUtils.removeTab(element);
    });
    await SpecialPowers.popPrefEnv();
  });
});

add_task(async function cycleTabsByAttribute() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tabs.ctrl-tab.ignore-essential-tabs", true]],
  });

  const essentialTabs = gBrowser.tabs.filter((tab) => tab.hasAttribute("zen-essential"));
  await selectTab(essentialTabs[0]);

  gBrowser.tabContainer.advanceSelectedTab(1, true);
  gBrowser.tabContainer.advanceSelectedTab(1, true);
  gBrowser.tabContainer.advanceSelectedTab(1, true);
  Assert.strictEqual(
    gBrowser.selectedTab,
    essentialTabs[0],
    "tab cycling applies within essential tabs only, as the starting tab is a essential tab"
  );

  const workspaceTabs = gBrowser.tabs.filter(
    (tab) => !tab.hasAttribute("zen-essential") && !tab.hasAttribute("zen-empty-tab")
  );
  await selectTab(workspaceTabs[0]);

  gBrowser.tabContainer.advanceSelectedTab(1, true);
  gBrowser.tabContainer.advanceSelectedTab(1, true);
  gBrowser.tabContainer.advanceSelectedTab(1, true);

  Assert.strictEqual(
    gBrowser.selectedTab,
    workspaceTabs[0],
    "tab cycling applies within workspace tabs only, as the starting tab is a workspace tab"
  );
});
