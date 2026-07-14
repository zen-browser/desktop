/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function openLoadedTab(title) {
  return BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    `data:text/html,<!doctype html><title>${title}</title>`,
    true,
    { skipAnimation: true }
  );
}

async function waitForTabToUnload(tab) {
  await TestUtils.waitForCondition(
    () => tab.hasAttribute("pending") && !tab.linkedPanel,
    "Tab should become pending and release its linked panel"
  );
}

add_task(async function test_UnloadSelectedTabs_shortcut_registration() {
  const shortcuts = await gZenKeyboardShortcutsManager.getModifiableShortcuts();
  const shortcut = shortcuts.find(
    item => item.getID() === "zen-unload-selected-tabs"
  );

  ok(shortcut, "Unload Current Tab or Selection should be configurable");
  is(
    shortcut.getAction(),
    "cmd_zenUnloadSelectedTabs",
    "Shortcut should invoke the unload-selected-tabs command"
  );
  is(
    shortcut.getGroup(),
    "windowAndTabManagement",
    "Shortcut should appear in Window & Tab Management"
  );
  is(shortcut.getKeyName(), "", "Shortcut should have no default key");
  is(shortcut.getKeyCode(), null, "Shortcut should have no default keycode");
});

add_task(async function test_UnloadSelectedTabs_current_tab() {
  const controlTab = await openLoadedTab("Unload Selected Tabs control");
  const targetTab = await openLoadedTab("Unload Selected Tabs target");

  try {
    document.getElementById("cmd_zenUnloadSelectedTabs").doCommand();
    await waitForTabToUnload(targetTab);

    isnot(
      gBrowser.selectedTab,
      targetTab,
      "The unloaded tab should lose focus"
    );
    ok(
      !controlTab.hasAttribute("pending"),
      "An unselected tab should remain loaded"
    );
    ok(controlTab.linkedPanel, "An unselected tab should retain its panel");
  } finally {
    await BrowserTestUtils.removeTab(targetTab);
    await BrowserTestUtils.removeTab(controlTab);
  }
});

add_task(async function test_UnloadSelectedTabs_multi_selection() {
  const controlTab = await openLoadedTab("Unload Selected Tabs control");
  const firstSelectedTab = await openLoadedTab("Unload Selected Tabs first");
  const secondSelectedTab = await openLoadedTab("Unload Selected Tabs second");

  try {
    gBrowser.addRangeToMultiSelectedTabs(firstSelectedTab, secondSelectedTab);
    is(
      gBrowser.selectedTabs.length,
      2,
      "The test should start with exactly two selected tabs"
    );

    document.getElementById("cmd_zenUnloadSelectedTabs").doCommand();
    await Promise.all([
      waitForTabToUnload(firstSelectedTab),
      waitForTabToUnload(secondSelectedTab),
    ]);

    ok(
      !controlTab.hasAttribute("pending"),
      "A tab outside the multi-selection should remain loaded"
    );
    ok(
      controlTab.linkedPanel,
      "A tab outside the multi-selection should retain its panel"
    );
  } finally {
    gBrowser.clearMultiSelectedTabs();
    await BrowserTestUtils.removeTab(secondSelectedTab);
    await BrowserTestUtils.removeTab(firstSelectedTab);
    await BrowserTestUtils.removeTab(controlTab);
  }
});
