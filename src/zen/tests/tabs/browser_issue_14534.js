/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed", true]],
  });
  registerCleanupFunction(async () => {
    await SpecialPowers.popPrefEnv();
  });
});

add_task(async function test_Close_Unpinned_While_Focused_On_Pinned() {
  if (!gZenWorkspaces.workspaceEnabled) {
    ok(true, "Workspaces disabled; the regression cannot occur. Skipping.");
    return;
  }

  // Pin the currently selected tab
  const pinnedTab = gBrowser.selectedTab;
  gBrowser.pinTab(pinnedTab);
  registerCleanupFunction(() => {
    if (pinnedTab.pinned && !pinnedTab.closing) {
      gBrowser.unpinTab(pinnedTab);
    }
  });

  ok(pinnedTab.pinned, "Main tab should be pinned");
  ok(pinnedTab.selected, "Main pinned tab should be selected");

  // Open an unpinned tab
  const unpinnedTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com"
  );
  registerCleanupFunction(async () => {
    if (!unpinnedTab.closing) {
      await BrowserTestUtils.removeTab(unpinnedTab);
    }
  });

  // Re-select the pinned tab so we are focused on it
  await BrowserTestUtils.switchTab(gBrowser, pinnedTab);
  ok(pinnedTab.selected, "Pinned tab should be selected again");

  // Spy on selectEmptyTab
  let selectEmptyTabCalled = false;
  const originalSelectEmptyTab = gZenWorkspaces.selectEmptyTab;
  gZenWorkspaces.selectEmptyTab = function (...args) {
    selectEmptyTabCalled = true;
    return originalSelectEmptyTab.apply(this, args);
  };
  registerCleanupFunction(() => {
    gZenWorkspaces.selectEmptyTab = originalSelectEmptyTab;
  });

  // Close the unpinned tab
  await BrowserTestUtils.removeTab(unpinnedTab);

  ok(
    !selectEmptyTabCalled,
    "Closing an unselected unpinned tab must not invoke selectEmptyTab"
  );
  ok(pinnedTab.selected, "The pinned tab should remain selected");
});
