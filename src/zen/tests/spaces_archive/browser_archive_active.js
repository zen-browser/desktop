/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_archive_active_switches_away() {
  const [first, second] = await createTestSpaces(2);
  await gZenWorkspaces.changeWorkspace(second);

  ok(
    await gZenWorkspaces.archiveWorkspace(second.uuid),
    "Archiving the active space succeeds"
  );
  is(
    gZenWorkspaces.activeWorkspace,
    first.uuid,
    "Switched to the previous visible space"
  );

  await gZenWorkspaces.restoreWorkspace(second.uuid);
});

add_task(async function test_last_visible_space_cannot_be_archived() {
  await createTestSpaces(1);
  const archived = [];
  for (const space of gZenWorkspaces.getVisibleWorkspaces().slice(1)) {
    ok(await gZenWorkspaces.archiveWorkspace(space.uuid), "Archived");
    archived.push(space.uuid);
  }
  const [last] = gZenWorkspaces.getVisibleWorkspaces();
  is(gZenWorkspaces.getVisibleWorkspaces().length, 1, "One space left");

  ok(
    !(await gZenWorkspaces.archiveWorkspace(last.uuid)),
    "Last visible space is not archived"
  );
  ok(
    !gZenWorkspaces.isWorkspaceArchived(
      gZenWorkspaces.getWorkspaceFromId(last.uuid)
    ),
    "Last visible space stays visible"
  );

  for (const uuid of archived) {
    await gZenWorkspaces.restoreWorkspace(uuid);
  }
});

add_task(async function test_active_setter_skips_archived() {
  const [first, second] = await createTestSpaces(2);
  await gZenWorkspaces.archiveWorkspace(second.uuid);
  gZenWorkspaces.activeWorkspace = second.uuid;
  isnot(
    gZenWorkspaces.activeWorkspace,
    second.uuid,
    "An archived space can't become the active one"
  );
  await gZenWorkspaces.changeWorkspace(first);
  await gZenWorkspaces.restoreWorkspace(second.uuid);
});
