/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/. */

"use strict";

const { gZenWorkspaceStorage } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenWorkspaceStorage.sys.mjs"
);
const { gZenWorkspaceHistoryStorage } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenWorkspaceHistoryStorage.sys.mjs"
);
const { gZenWorkspaceMigration } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenWorkspaceMigration.sys.mjs"
);

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.workspaces.isolation.enabled", true],
      ["zen.workspaces.isolation.isolate-bookmarks", true],
      ["zen.workspaces.isolation.isolate-passwords", true],
      ["zen.workspaces.isolation.isolate-history", true],
      ["zen.workspaces.isolation.isolate-cookies", true],
      ["zen.workspaces.isolation.isolate-extensions", true],
    ],
  });

  registerCleanupFunction(async () => {
    await SpecialPowers.popPrefEnv();
  });
});

add_task(async function test_workspace_isolation_flag() {
  const initialWorkspaces = gZenWorkspaces.getWorkspaces();
  const initialCount = initialWorkspaces.length;

  await gZenWorkspaces.createAndSaveWorkspace("Isolated Workspace");
  const workspaces = gZenWorkspaces.getWorkspaces();

  Assert.strictEqual(
    workspaces.length,
    initialCount + 1,
    "A new workspace should be created"
  );

  const newWorkspace = workspaces.find(ws => ws.name === "Isolated Workspace");
  Assert.ok(newWorkspace, "The new workspace should exist");
  Assert.strictEqual(
    newWorkspace.isolated,
    true,
    "The workspace should have isolation enabled"
  );
  Assert.ok(
    newWorkspace.storagePath,
    "The workspace should have a storage path"
  );

  await gZenWorkspaces.removeWorkspace(newWorkspace.uuid);
});

add_task(async function test_workspace_storage_directory_creation() {
  const initialWorkspaces = gZenWorkspaces.getWorkspaces();
  const initialCount = initialWorkspaces.length;

  await gZenWorkspaces.createAndSaveWorkspace("Storage Test Workspace");
  const workspaces = gZenWorkspaces.getWorkspaces();

  const newWorkspace = workspaces.find(
    ws => ws.name === "Storage Test Workspace"
  );
  Assert.ok(newWorkspace, "The new workspace should exist");

  const storagePath = gZenWorkspaceStorage.workspacePath(newWorkspace.uuid);
  const storageExists = await IOUtils.exists(storagePath);
  Assert.ok(
    storageExists,
    "Workspace storage directory should be created"
  );

  const loginsPath = gZenWorkspaceStorage.workspaceFilePath(
    newWorkspace.uuid,
    "logins.json"
  );
  const loginsExists = await IOUtils.exists(loginsPath);
  Assert.ok(
    loginsExists,
    "Workspace logins.json should be created for default workspace"
  );

  await gZenWorkspaces.removeWorkspace(newWorkspace.uuid);

  const storageExistsAfterDelete = await IOUtils.exists(storagePath);
  Assert.ok(
    !storageExistsAfterDelete,
    "Workspace storage directory should be deleted"
  );
});

add_task(async function test_workspace_storage_switch() {
  const initialWorkspaces = gZenWorkspaces.getWorkspaces();
  const initialCount = initialWorkspaces.length;

  await gZenWorkspaces.createAndSaveWorkspace("Switch Test A");
  await gZenWorkspaces.createAndSaveWorkspace("Switch Test B");

  const workspaces = gZenWorkspaces.getWorkspaces();
  const workspaceA = workspaces.find(ws => ws.name === "Switch Test A");
  const workspaceB = workspaces.find(ws => ws.name === "Switch Test B");

  Assert.ok(workspaceA, "Workspace A should exist");
  Assert.ok(workspaceB, "Workspace B should exist");

  await gZenWorkspaces.changeWorkspaceWithID(workspaceA.uuid);
  Assert.strictEqual(
    gZenWorkspaceStorage.activeWorkspaceUuid,
    workspaceA.uuid,
    "Active workspace storage should be workspace A"
  );

  await gZenWorkspaces.changeWorkspaceWithID(workspaceB.uuid);
  Assert.strictEqual(
    gZenWorkspaceStorage.activeWorkspaceUuid,
    workspaceB.uuid,
    "Active workspace storage should be workspace B"
  );

  await gZenWorkspaces.removeWorkspace(workspaceB.uuid);
  await gZenWorkspaces.removeWorkspace(workspaceA.uuid);
});

add_task(async function test_workspace_isolation_disabled() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.workspaces.isolation.enabled", false],
    ],
  });

  const initialWorkspaces = gZenWorkspaces.getWorkspaces();
  const initialCount = initialWorkspaces.length;

  await gZenWorkspaces.createAndSaveWorkspace("Non-Isolated Workspace");
  const workspaces = gZenWorkspaces.getWorkspaces();

  const newWorkspace = workspaces.find(
    ws => ws.name === "Non-Isolated Workspace"
  );
  Assert.ok(newWorkspace, "The new workspace should exist");
  Assert.strictEqual(
    newWorkspace.isolated,
    false,
    "The workspace should not have isolation when disabled"
  );

  await gZenWorkspaces.removeWorkspace(newWorkspace.uuid);

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_history_storage_initialization() {
  await gZenWorkspaceHistoryStorage.init();

  const placeIds = await gZenWorkspaceHistoryStorage.getPlaceIdsForWorkspace(
    "test-uuid"
  );
  Assert.ok(
    placeIds instanceof Set,
    "getPlaceIdsForWorkspace should return a Set"
  );
  Assert.strictEqual(
    placeIds.size,
    0,
    "No history entries should exist for a test workspace"
  );
});

add_task(async function test_migration_runs() {
  const workspaces = gZenWorkspaces.getWorkspaces();

  const migrated = await gZenWorkspaceMigration.migrateIfNeeded(workspaces);

  Assert.ok(
    typeof migrated === "boolean",
    "migrateIfNeeded should return a boolean"
  );
});

add_task(async function test_is_workspace_isolated() {
  const workspaces = gZenWorkspaces.getWorkspaces();

  for (const workspace of workspaces) {
    const isIsolated = gZenWorkspaces.isWorkspaceIsolated(workspace.uuid);
    Assert.strictEqual(
      typeof isIsolated,
      "boolean",
      "isWorkspaceIsolated should return a boolean"
    );
  }
});
