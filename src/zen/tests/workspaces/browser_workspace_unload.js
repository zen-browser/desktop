/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function waitForActiveWorkspace(workspaceId) {
  await BrowserTestUtils.waitForCondition(
    () => gZenWorkspaces.activeWorkspace === workspaceId,
    `Workspace ${workspaceId} should become active`
  );
}

async function openWorkspaceTab(workspaceId, title) {
  await gZenWorkspaces.changeWorkspaceWithID(workspaceId);
  await waitForActiveWorkspace(workspaceId);
  const tab = await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    `data:text/html,<title>${title}</title>`,
    true,
    { skipAnimation: true }
  );
  gZenWorkspaces.moveTabToWorkspace(tab, workspaceId);
  return tab;
}

function removeNonWorkspaceTabs(excludedTabs = []) {
  const excluded = new Set(excludedTabs);
  for (const tab of [...gBrowser.tabs]) {
    if (excluded.has(tab)) {
      continue;
    }
    if (
      !tab.hasAttribute("zen-workspace-id") &&
      !tab.hasAttribute("zen-empty-tab")
    ) {
      BrowserTestUtils.removeTab(tab);
    }
  }
}

// verify that workspace unloading works
add_task(async function test_UnloadWorkspace_WithMultipleTabs() {
  const workspace =
    await gZenWorkspaces.createAndSaveWorkspace("Test Workspace 1");
  const workspaceId = workspace.uuid;
  await waitForActiveWorkspace(workspaceId);
  const tabs = [];
  for (let i = 0; i < 3; i++) {
    const tab = await openWorkspaceTab(workspaceId, `Workspace Tab ${i}`);
    tabs.push(tab);
  }

  for (const tab of tabs) {
    ok(!tab.hasAttribute("pending"), "Tab should not be pending before unload");
    ok(tab.linkedPanel, "Tab should have linked panel before unload");
  }

  await gZenWorkspaces.unloadWorkspace();

  for (const tab of tabs) {
    ok(tab.hasAttribute("pending"), "Tab should be pending after unload");
    ok(!tab.linkedPanel, "Tab should not have linked panel after unload");
  }

  await gZenWorkspaces.removeWorkspace(workspaceId);
});

// verify that essential tabs are not unloaded
add_task(async function test_UnloadWorkspace_WithEssentialTabs() {
  const workspace =
    await gZenWorkspaces.createAndSaveWorkspace("Test Workspace 2", undefined, true);
  const workspaceId = workspace.uuid;
  await gZenWorkspaces.changeWorkspaceWithID(workspaceId);
  await waitForActiveWorkspace(workspaceId);

  const regularTab = await openWorkspaceTab(workspaceId, "Hi! I am a Regular Tab");
  const essentialTab = await openWorkspaceTab(
    workspaceId,
    "Hi! I am an Essential Tab"
  );
  gZenPinnedTabManager.addToEssentials(essentialTab);

  await gZenWorkspaces.unloadWorkspace();

  ok(regularTab.hasAttribute("pending"), "Regular tab should be unloaded");
  ok(!regularTab.linkedPanel, "Regular tab should not have linked panel");

  ok(
    !essentialTab.hasAttribute("pending"),
    "Essential tab should not be unloaded"
  );
  ok(essentialTab.linkedPanel, "Essential tab should still have linked panel");
  ok(
    !essentialTab.hasAttribute("zen-workspace-id"),
    "Essential tab should not stay attached to the workspace"
  );

  await gZenWorkspaces.removeWorkspace(workspaceId);
  removeNonWorkspaceTabs();
});

// only tabs from the targeted workspace should be unloaded
add_task(async function test_UnloadWorkspace_TargetedWorkspaceIsolation() {
  const inActiveWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Test In-Active Workspace",
    undefined,
    true
  );
  const activeWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Test Active Workspace",
    undefined,
    true
  );
  const inActiveWorkspaceId = inActiveWorkspace.uuid;
  const activeWorkspaceId = activeWorkspace.uuid;
  await gZenWorkspaces.changeWorkspaceWithID(activeWorkspaceId);
  await waitForActiveWorkspace(activeWorkspaceId);

  const inActiveWorkspaceTabs = [];
  for (let i = 0; i < 2; i++) {
    const tab = await openWorkspaceTab(
      inActiveWorkspaceId,
      `In-Active Workspace Tab ${i}`
    );
    inActiveWorkspaceTabs.push(tab);
  }

  const activeWorkspaceTabs = [];
  for (let i = 0; i < 2; i++) {
    const tab = await openWorkspaceTab(
      activeWorkspaceId,
      `Active Workspace Tab ${i}`
    );
    activeWorkspaceTabs.push(tab);
  }

  await gZenWorkspaces.unloadWorkspace(); // this unloads the latest created workspace -> activeWorkspaceId

  for (const tab of activeWorkspaceTabs) {
    ok(
      tab.hasAttribute("pending"),
      "Active workspace tab should be pending after unload"
    );
    ok(
      !tab.linkedPanel,
      "Active workspace tab should not have linked panel after unload"
    );
  }

  for (const tab of inActiveWorkspaceTabs) {
    ok(
      !tab.hasAttribute("pending"),
      "In-Active workspace tab should NOT be pending after unload"
    );
    ok(
      tab.linkedPanel,
      "In-Active workspace tab should still have linked panel after unload"
    );
  }

  await gZenWorkspaces.removeWorkspace(inActiveWorkspaceId);
  await gZenWorkspaces.removeWorkspace(activeWorkspaceId);
  removeNonWorkspaceTabs();
});

add_task(async function test_DeleteWorkspace_RemovesWorkspaceOwnedTabs() {
  const originalWorkspaceId = gZenWorkspaces.activeWorkspace;
  const originalWorkspaceTab = await openWorkspaceTab(
    originalWorkspaceId,
    "Original Workspace Tab"
  );

  const deletedWorkspace = 
    await gZenWorkspaces.createAndSaveWorkspace(
      "Workspace To Delete",
      undefined,
      true
    );
  const deletedWorkspaceId = deletedWorkspace.uuid;
  await gZenWorkspaces.changeWorkspaceWithID(deletedWorkspaceId);
  await waitForActiveWorkspace(deletedWorkspaceId);

  const regularTab = await openWorkspaceTab(deletedWorkspaceId, "Delete Me Regular");
  const pinnedTab = await openWorkspaceTab(deletedWorkspaceId, "Delete Me Pinned");
  gBrowser.pinTab(pinnedTab);
  gZenWorkspaces.moveTabToWorkspace(pinnedTab, deletedWorkspaceId);

  await gZenWorkspaces.removeWorkspace(deletedWorkspaceId);

  ok(
    !gBrowser.tabs.includes(regularTab),
    "Regular workspace-owned tab should be removed when deleting the workspace"
  );
  ok(
    !gBrowser.tabs.includes(pinnedTab),
    "Pinned workspace-owned tab should be removed when deleting the workspace"
  );
  ok(
    gBrowser.tabs.includes(originalWorkspaceTab),
    "Tab from the original workspace should remain after deleting another workspace"
  );
  ok(
    !gBrowser.tabs.some(
      tab => tab.getAttribute("zen-workspace-id") === deletedWorkspaceId
    ),
    "No remaining tab should keep the deleted workspace id"
  );

  BrowserTestUtils.removeTab(originalWorkspaceTab);
});
