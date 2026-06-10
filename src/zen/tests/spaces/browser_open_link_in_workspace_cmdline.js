/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_resolve_workspace_from_string() {
  const originalWorkspaceUUID = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Cmdline Space");
  const created = gZenWorkspaces
    .getWorkspaces()
    .find(workspace => workspace.name === "Cmdline Space");
  Assert.ok(created, "The new workspace should exist.");

  Assert.strictEqual(
    gZenWorkspaces.resolveWorkspaceFromString(created.uuid)?.uuid,
    created.uuid,
    "Workspaces should resolve by UUID."
  );
  Assert.strictEqual(
    gZenWorkspaces.resolveWorkspaceFromString("cmdline space")?.uuid,
    created.uuid,
    "Workspaces should resolve by name, case-insensitively."
  );
  Assert.strictEqual(
    gZenWorkspaces.resolveWorkspaceFromString("does-not-exist"),
    null,
    "Unknown workspaces should resolve to null."
  );
  Assert.strictEqual(
    gZenWorkspaces.resolveWorkspaceFromString(null),
    null,
    "Empty values should resolve to null."
  );

  await gZenWorkspaces.removeWorkspace(created.uuid);
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalWorkspaceUUID,
    "We should be back on the original workspace."
  );
});

add_task(async function test_open_link_in_workspace_from_command_line() {
  const originalWorkspaceUUID = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Cmdline Target");
  const target = gZenWorkspaces
    .getWorkspaces()
    .find(workspace => workspace.name === "Cmdline Target");
  Assert.ok(target, "The target workspace should exist.");

  await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalWorkspaceUUID,
    "We should start from the original workspace."
  );

  await gZenWorkspaces.openLinkInWorkspaceFromCommandLine(
    "Cmdline Target",
    "https://example.com/"
  );

  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    target.uuid,
    "The command line flag should switch to the target workspace."
  );
  const tab = gBrowser.selectedTab;
  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    target.uuid,
    "The opened tab should belong to the target workspace."
  );

  BrowserTestUtils.removeTab(tab);
  await gZenWorkspaces.removeWorkspace(target.uuid);
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalWorkspaceUUID,
    "We should be back on the original workspace."
  );
});

add_task(async function test_open_link_with_unknown_workspace() {
  const originalWorkspaceUUID = gZenWorkspaces.activeWorkspace;

  await gZenWorkspaces.openLinkInWorkspaceFromCommandLine(
    "does-not-exist",
    "https://example.com/"
  );

  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalWorkspaceUUID,
    "An unknown workspace should not switch spaces."
  );
  const tab = gBrowser.selectedTab;
  Assert.strictEqual(
    tab.getAttribute("zen-workspace-id"),
    originalWorkspaceUUID,
    "The tab should open in the active workspace as a fallback."
  );

  BrowserTestUtils.removeTab(tab);
});
