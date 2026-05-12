/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {});

// Cycle 1: Moving a single tab to a workspace by index
add_task(async function test_move_tab_to_workspace_by_index() {
  const workspace1Id = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Move Target");
  const workspaces = gZenWorkspaces.getWorkspaces();
  Assert.strictEqual(workspaces.length, 2, "Should have 2 workspaces.");

  const workspace2Id = workspaces[1].uuid;

  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    workspace1Id,
    "Tab should start in workspace 1."
  );

  gBrowser.selectedTab = tab;
  await gZenWorkspaces.shortcutMoveTabTo(1);

  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    workspace2Id,
    "Tab should now belong to workspace 2."
  );

  BrowserTestUtils.removeTab(tab);
  await gZenWorkspaces.removeWorkspace(workspace2Id);
});

// Cycle 2: After moving a tab, user stays in the current workspace
add_task(async function test_stay_in_current_workspace_after_move() {
  const workspace1Id = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Stay Test");
  const workspaces = gZenWorkspaces.getWorkspaces();
  const workspace2Id = workspaces[1].uuid;

  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  gBrowser.selectedTab = tab;
  await gZenWorkspaces.shortcutMoveTabTo(1);

  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    workspace1Id,
    "Active workspace should still be workspace 1 after moving a tab."
  );

  BrowserTestUtils.removeTab(tab);
  await gZenWorkspaces.removeWorkspace(workspace2Id);
});

// Cycle 3: After moving the active tab, the next tab in the workspace gets selected
add_task(async function test_next_tab_selected_after_move() {
  await gZenWorkspaces.createAndSaveWorkspace("Select Test");
  const workspaces = gZenWorkspaces.getWorkspaces();
  const workspace2Id = workspaces[1].uuid;

  let tabA = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  let tabB = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });

  gBrowser.selectedTab = tabA;
  await gZenWorkspaces.shortcutMoveTabTo(1);

  Assert.strictEqual(
    gBrowser.selectedTab,
    tabB,
    "After moving tabA, tabB should be selected."
  );

  BrowserTestUtils.removeTab(tabA);
  BrowserTestUtils.removeTab(tabB);
  await gZenWorkspaces.removeWorkspace(workspace2Id);
});

// Cycle 4: Moving to an out-of-bounds index is a no-op
add_task(async function test_out_of_bounds_is_noop() {
  const workspace1Id = gZenWorkspaces.activeWorkspace;

  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  gBrowser.selectedTab = tab;

  await gZenWorkspaces.shortcutMoveTabTo(99);

  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    workspace1Id,
    "Tab should remain in workspace 1 when index is out of bounds."
  );

  await gZenWorkspaces.shortcutMoveTabTo(-1);

  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    workspace1Id,
    "Tab should remain in workspace 1 when index is negative."
  );

  BrowserTestUtils.removeTab(tab);
});

// Cycle 5: Moving multiselected tabs to a workspace
add_task(async function test_multiselect_move() {
  const workspace1Id = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Multi Target");
  const workspaces = gZenWorkspaces.getWorkspaces();
  const workspace2Id = workspaces[1].uuid;

  let tabA = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  let tabB = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  let tabC = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });

  gBrowser.selectedTab = tabA;
  gBrowser.addRangeToMultiSelectedTabs(tabA, tabB);
  ok(tabA.multiselected, "tabA should be multiselected.");
  ok(tabB.multiselected, "tabB should be multiselected.");

  await gZenWorkspaces.shortcutMoveTabTo(1);

  Assert.strictEqual(
    tabA.getAttribute("zen-workspace-id"),
    workspace2Id,
    "tabA should belong to target workspace."
  );
  Assert.strictEqual(
    tabB.getAttribute("zen-workspace-id"),
    workspace2Id,
    "tabB should belong to target workspace."
  );
  Assert.strictEqual(
    tabC.getAttribute("zen-workspace-id"),
    workspace1Id,
    "tabC should remain in the source workspace."
  );
  Assert.strictEqual(
    gBrowser.selectedTab,
    tabC,
    "tabC should be selected after moving multiselected tabs."
  );

  BrowserTestUtils.removeTab(tabA);
  BrowserTestUtils.removeTab(tabB);
  BrowserTestUtils.removeTab(tabC);
  await gZenWorkspaces.removeWorkspace(workspace2Id);
});

// Cycle 6: moveActiveTabShortcut wraps forward from last workspace
add_task(async function test_move_forward_wraps() {
  await gZenWorkspaces.createAndSaveWorkspace("Wrap A");
  await gZenWorkspaces.createAndSaveWorkspace("Wrap B");
  const workspaces = gZenWorkspaces.getWorkspaces();
  Assert.strictEqual(workspaces.length, 3, "Should have 3 workspaces.");

  const lastWorkspace = workspaces[2];
  await gZenWorkspaces.changeWorkspace(lastWorkspace);
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    lastWorkspace.uuid,
    "Should be in the last workspace."
  );

  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  gBrowser.selectedTab = tab;

  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.wrap-around-navigation", true]],
  });
  await gZenWorkspaces.moveActiveTabShortcut(1);

  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    workspaces[0].uuid,
    "Tab should wrap to the first workspace."
  );

  await SpecialPowers.popPrefEnv();
  BrowserTestUtils.removeTab(tab);
  await gZenWorkspaces.changeWorkspace(workspaces[0]);
  await gZenWorkspaces.removeWorkspace(workspaces[1].uuid);
  await gZenWorkspaces.removeWorkspace(workspaces[2].uuid);
});

// Cycle 7: moveActiveTabShortcut is a no-op at boundary with wrap disabled
add_task(async function test_move_forward_no_wrap_is_noop() {
  await gZenWorkspaces.createAndSaveWorkspace("NoWrap A");
  await gZenWorkspaces.createAndSaveWorkspace("NoWrap B");
  const workspaces = gZenWorkspaces.getWorkspaces();
  Assert.strictEqual(workspaces.length, 3, "Should have 3 workspaces.");

  const lastWorkspace = workspaces[2];
  await gZenWorkspaces.changeWorkspace(lastWorkspace);

  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  gBrowser.selectedTab = tab;

  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.wrap-around-navigation", false]],
  });
  await gZenWorkspaces.moveActiveTabShortcut(1);

  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    lastWorkspace.uuid,
    "Tab should stay in the last workspace when wrap is disabled."
  );

  await SpecialPowers.popPrefEnv();
  BrowserTestUtils.removeTab(tab);
  await gZenWorkspaces.changeWorkspace(workspaces[0]);
  await gZenWorkspaces.removeWorkspace(workspaces[1].uuid);
  await gZenWorkspaces.removeWorkspace(workspaces[2].uuid);
});

// Cycle 8: Moving to the current workspace is a no-op
add_task(async function test_same_workspace_is_noop() {
  const workspace1Id = gZenWorkspaces.activeWorkspace;

  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  gBrowser.selectedTab = tab;

  await gZenWorkspaces.shortcutMoveTabTo(0);

  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    workspace1Id,
    "Tab should remain in the same workspace when target is current."
  );

  BrowserTestUtils.removeTab(tab);
});

// Cycle 9: Moving the last tab out triggers selectEmptyTab fallback
add_task(async function test_last_tab_triggers_empty_fallback() {
  await gZenWorkspaces.createAndSaveWorkspace("Empty Fallback");
  const workspaces = gZenWorkspaces.getWorkspaces();
  const workspace2 = workspaces[1];
  await gZenWorkspaces.changeWorkspace(workspace2);

  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  gBrowser.selectedTab = tab;

  const allVisibleBefore = gBrowser.visibleTabs.filter(
    t => !t.pinned && !t.closing && t !== tab
  );
  Assert.strictEqual(
    allVisibleBefore.length,
    0,
    "Tab should be the only non-pinned visible tab in this workspace."
  );

  await gZenWorkspaces.shortcutMoveTabTo(0);

  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    workspaces[0].uuid,
    "Tab should have moved to workspace 1."
  );

  BrowserTestUtils.removeTab(tab);
  await gZenWorkspaces.changeWorkspace(workspaces[0]);
  await gZenWorkspaces.removeWorkspace(workspace2.uuid);
});

// Cycle 10: Post-move toast notification displays correct content
add_task(async function test_post_move_notification() {
  await gZenWorkspaces.createAndSaveWorkspace("Notify Target");
  const workspaces = gZenWorkspaces.getWorkspaces();
  const workspace2Id = workspaces[1].uuid;
  const targetName = workspaces[1].name;

  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  gBrowser.selectedTab = tab;

  await gZenWorkspaces.shortcutMoveTabTo(1);

  const toastContainer = document.getElementById("zen-toast-container");
  ok(toastContainer, "Toast container should exist.");
  ok(
    !toastContainer.hasAttribute("hidden"),
    "Toast container should be visible."
  );

  const toasts = toastContainer.querySelectorAll(".zen-toast");
  ok(toasts.length > 0, "At least one toast should be present.");

  const lastToast = toasts[toasts.length - 1];
  await document.l10n.translateFragment(lastToast);
  const toastText = lastToast.textContent;
  ok(
    toastText.includes(targetName),
    `Toast should contain the workspace name "${targetName}", got: "${toastText}".`
  );

  BrowserTestUtils.removeTab(tab);
  await gZenWorkspaces.removeWorkspace(workspace2Id);
});
