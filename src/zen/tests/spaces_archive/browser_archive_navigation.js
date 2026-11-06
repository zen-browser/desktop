/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_next_space_skips_archived() {
  const [first, second, third] = await createTestSpaces(3);
  await gZenWorkspaces.archiveWorkspace(second.uuid);
  await gZenWorkspaces.changeWorkspace(first);

  await gZenWorkspaces.changeWorkspaceShortcut(1);
  is(
    gZenWorkspaces.activeWorkspace,
    third.uuid,
    "Next space skips the archived one"
  );

  await gZenWorkspaces.changeWorkspaceShortcut(-1);
  is(
    gZenWorkspaces.activeWorkspace,
    first.uuid,
    "Previous space skips the archived one"
  );

  await gZenWorkspaces.restoreWorkspace(second.uuid);
});

add_task(async function test_index_shortcut_skips_archived() {
  const [, second, third] = await createTestSpaces(3);
  await gZenWorkspaces.archiveWorkspace(second.uuid);

  const index = visibleIds().indexOf(third.uuid);
  await gZenWorkspaces.shortcutSwitchTo(index);
  is(
    gZenWorkspaces.activeWorkspace,
    third.uuid,
    "Index shortcuts count only visible spaces"
  );

  await gZenWorkspaces.restoreWorkspace(second.uuid);
});

add_task(async function test_move_tab_menu_skips_archived() {
  const [, second] = await createTestSpaces(2);
  await gZenWorkspaces.archiveWorkspace(second.uuid);
  gZenWorkspaces.updateWorkspacesChangeContextMenu();

  const popup = document.getElementById("moveTabOptionsMenu");
  if (popup) {
    ok(
      !popup.querySelector(`menuitem[zen-workspace-id="${second.uuid}"]`),
      "Move tab menu has no entry for the archived space"
    );
  }

  await gZenWorkspaces.restoreWorkspace(second.uuid);
});

add_task(async function test_reorder_counts_visible_positions() {
  const [first, second, third] = await createTestSpaces(3);
  await gZenWorkspaces.archiveWorkspace(second.uuid);

  // Drag and drop hands over positions among the visible spaces.
  const thirdPosition = visibleIds().indexOf(third.uuid);
  await gZenWorkspaces.reorderWorkspace(first.uuid, thirdPosition);

  const order = gZenWorkspaces
    .getWorkspaces()
    .map(w => w.uuid)
    .filter(id => [first.uuid, second.uuid, third.uuid].includes(id));
  Assert.deepEqual(
    order,
    [second.uuid, third.uuid, first.uuid],
    "Space lands after the visible target, archived one keeps its place"
  );

  await gZenWorkspaces.restoreWorkspace(second.uuid);
});
