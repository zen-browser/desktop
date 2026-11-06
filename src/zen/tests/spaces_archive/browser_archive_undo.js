/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_context_archive_offers_undo() {
  const [, second] = await createTestSpaces(2);
  await gZenWorkspaces.changeWorkspace(second);

  await gZenWorkspaces.contextArchiveWorkspace();
  ok(
    gZenWorkspaces.isWorkspaceArchived(
      gZenWorkspaces.getWorkspaceFromId(second.uuid)
    ),
    "Context menu action archives the active space"
  );

  const button = await TestUtils.waitForCondition(
    () => document.getElementById("zen-workspace-archived-undo-button"),
    "Toast shows an undo button"
  );
  button.doCommand();
  await TestUtils.waitForCondition(
    () => gZenWorkspaces.activeWorkspace === second.uuid,
    "Undo switches back into the space"
  );
  ok(
    !gZenWorkspaces.isWorkspaceArchived(
      gZenWorkspaces.getWorkspaceFromId(second.uuid)
    ),
    "Undo restores the space"
  );
});

add_task(async function test_archive_command_disabled_with_one_visible() {
  const archived = [];
  for (const space of gZenWorkspaces.getVisibleWorkspaces().slice(1)) {
    await gZenWorkspaces.archiveWorkspace(space.uuid);
    archived.push(space.uuid);
  }
  gZenWorkspaces.updateWorkspacesChangeContextMenu();
  is(
    document
      .getElementById("cmd_zenCtxArchiveWorkspace")
      .getAttribute("disabled"),
    "true",
    "Archive is disabled for the last visible space"
  );
  for (const uuid of archived) {
    await gZenWorkspaces.restoreWorkspace(uuid);
  }
});
