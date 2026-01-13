/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Change_To_Empty() {
  // eslint-disable-next-line no-unused-vars
  const currentWorkspaceUUID = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Test Workspace 2");
  const workspaces = await gZenWorkspaces._workspaces();
  const secondWorkspace = workspaces.workspaces[1];

  await gZenWorkspaces.changeWorkspace(secondWorkspace.uuid);
  Assert.strictEqual(
    gBrowser.selectedTab,
    gZenWorkspaces._emptyTab,
    "The empty tab should be selected."
  );

  await gZenWorkspaces.removeWorkspace(gZenWorkspaces.activeWorkspace);
  Assert.notStrictEqual(
    gBrowser.selectedTab,
    gZenWorkspaces._emptyTab,
    "The empty tab should not be selected anymore."
  );

  const workspacesAfterRemove = await gZenWorkspaces._workspaces();
  Assert.strictEqual(workspacesAfterRemove.length, 1, "One workspace should exist.");
  Assert.strictEqual(gBrowser.tabs.length, 2, "There should be two tabs.");
});
