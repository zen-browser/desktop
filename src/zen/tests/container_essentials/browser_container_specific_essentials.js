/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Check_Creation() {
  await gZenWorkspaces.createAndSaveWorkspace(
    "Container Profile 1",
    undefined,
    false,
    1
  );
  const workspaces = gZenWorkspaces.getWorkspaces();
  Assert.strictEqual(workspaces.length, 2, "Two workspaces should exist.");

  await gZenWorkspaces.changeWorkspace(workspaces[1]);
  let newTab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
    userContextId: 1,
  });
  ok(newTab, "New tab should be opened.");
  gZenPinnedTabManager.addToEssentials(newTab);
  ok(
    newTab.hasAttribute("zen-essential") &&
      newTab.parentNode.getAttribute("container") == "1",
    "New tab should be marked as essential."
  );
  ok(
    gBrowser.tabs.find(
      t =>
        t.hasAttribute("zen-essential") && t.getAttribute("usercontextid") == 1
    ),
    "New tab should be marked as essential."
  );
  const newWorkspaceUUID = gZenWorkspaces.activeWorkspace;

  // Change to the original workspace, there should be no essential tabs
  await gZenWorkspaces.changeWorkspace(workspaces[0]);
  ok(
    !gBrowser.tabs.find(
      t =>
        t.hasAttribute("zen-essential") && t.getAttribute("usercontextid") == 1
    ),
    "No essential tabs should be found in the original workspace."
  );

  await BrowserTestUtils.removeTab(newTab);
  await gZenWorkspaces.removeWorkspace(newWorkspaceUUID);
});

add_task(async function test_Remove_Orphaned_Container_Essentials() {
  const workspaceContextIds = new Set(
    gZenWorkspaces
      .getWorkspaces()
      .map(workspace => Number(workspace.containerTabId) || 0)
  );
  const orphanedContextId = [1, 2, 3].find(
    contextId => !workspaceContextIds.has(contextId)
  );
  const validContextId =
    Number(gZenWorkspaces.getActiveWorkspaceFromCache().containerTabId) || 0;
  const tabs = [
    BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
      userContextId: validContextId,
    }),
    BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
      userContextId: orphanedContextId,
    }),
  ];

  try {
    for (const tab of tabs) {
      gZenPinnedTabManager.addToEssentials(tab, { replicating: true });
    }

    ok(
      gZenWorkspaces.allStoredTabs.includes(tabs[0]),
      "The Essential for an existing workspace container should be stored."
    );
    ok(
      gZenWorkspaces.allStoredTabs.includes(tabs[1]),
      "The orphaned container Essential should initially be stored."
    );

    await gZenWorkspaces.clearAnyZombieTabs();

    ok(
      gZenWorkspaces.allStoredTabs.includes(tabs[0]),
      "The Essential for an existing workspace container should remain."
    );
    ok(
      !gZenWorkspaces.allStoredTabs.includes(tabs[1]),
      "The Essential without a corresponding workspace container should be removed."
    );
  } finally {
    for (const tab of tabs) {
      if (gZenWorkspaces.allStoredTabs.includes(tab)) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});
