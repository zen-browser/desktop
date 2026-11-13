/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function openTab(title) {
  return BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    `data:text/html,<title>${title}</title>`,
    true,
    { skipAnimation: true }
  );
}

add_task(async function test_ctrl_tab_cross_space() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.ctrlTab.sortByRecentlyUsed", true],
      ["zen.tabs.ctrl-tab.cross-space", false],
    ],
  });

  const firstSpace = await gZenWorkspaces.createAndSaveWorkspace("First");
  await gZenWorkspaces.changeWorkspace(firstSpace);
  const otherSpaceTab = await openTab("Other space");

  const secondSpace = await gZenWorkspaces.createAndSaveWorkspace("Second");
  await gZenWorkspaces.changeWorkspace(secondSpace);
  const currentSpaceTab = await openTab("Current space");

  try {
    ok(
      ctrlTab.tabList.includes(currentSpaceTab),
      "Tabs of the current space are listed"
    );
    ok(
      !ctrlTab.tabList.includes(otherSpaceTab),
      "Tabs of other spaces are not listed by default"
    );

    await SpecialPowers.pushPrefEnv({
      set: [["zen.tabs.ctrl-tab.cross-space", true]],
    });
    is(ctrlTab.tabList[0], currentSpaceTab, "The selected tab comes first");
    is(
      ctrlTab.tabList[1],
      otherSpaceTab,
      "followed by the last used tab of another space"
    );
    ok(
      ctrlTab.tabList.every(tab => !tab.hasAttribute("zen-empty-tab")),
      "Empty tabs are never listed"
    );

    EventUtils.synthesizeKey("VK_TAB", { ctrlKey: true }, window);
    EventUtils.synthesizeKey("VK_CONTROL", { type: "keyup" }, window);
    await TestUtils.waitForCondition(
      () => gBrowser.selectedTab == otherSpaceTab,
      "Ctrl+Tab to select the tab of the other space"
    );
    await TestUtils.waitForCondition(
      () => gZenWorkspaces.activeWorkspace == firstSpace.uuid,
      "and switch to its space"
    );

    await SpecialPowers.popPrefEnv();
    ok(
      !ctrlTab.tabList.includes(currentSpaceTab),
      "Turning the pref off goes back to the current space only"
    );
  } finally {
    await SpecialPowers.popPrefEnv();
    BrowserTestUtils.removeTab(otherSpaceTab);
    BrowserTestUtils.removeTab(currentSpaceTab);
    await gZenWorkspaces.removeWorkspace(secondSpace.uuid);
    await gZenWorkspaces.removeWorkspace(firstSpace.uuid);
  }
});
