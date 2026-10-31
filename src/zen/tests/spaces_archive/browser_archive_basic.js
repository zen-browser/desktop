/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_archive_hides_space_and_keeps_data() {
  const [first, second, third] = await createTestSpaces(3);
  const orderBefore = gZenWorkspaces.getWorkspaces().map(w => w.uuid);

  const pinned = BrowserTestUtils.addTab(gBrowser, "about:blank");
  gBrowser.pinTab(pinned);
  gZenWorkspaces.moveTabToWorkspace(pinned, second.uuid);

  ok(
    await gZenWorkspaces.archiveWorkspace(second.uuid),
    "Archiving an inactive space succeeds"
  );

  ok(
    gZenWorkspaces.isWorkspaceArchived(
      gZenWorkspaces.getWorkspaceFromId(second.uuid)
    ),
    "Space is marked as archived"
  );
  ok(!visibleIds().includes(second.uuid), "Archived space is not visible");
  Assert.deepEqual(
    gZenWorkspaces.getWorkspaces().map(w => w.uuid),
    orderBefore,
    "Archived space stays in the full list at its position"
  );
  ok(
    gZenWorkspaces.workspaceElement(second.uuid).archived,
    "Space element is marked as archived"
  );
  ok(
    !document.querySelector(
      `#zen-workspaces-button [zen-workspace-id="${second.uuid}"]`
    ),
    "Switcher has no button for the archived space"
  );
  ok(pinned.isConnected, "Pinned tab of the archived space is kept");
  is(
    pinned.getAttribute("zen-workspace-id"),
    second.uuid,
    "Pinned tab still belongs to the archived space"
  );

  ok(await gZenWorkspaces.restoreWorkspace(second.uuid), "Restoring succeeds");
  is(
    gZenWorkspaces.activeWorkspace,
    second.uuid,
    "Restored space becomes active"
  );
  Assert.deepEqual(
    visibleIds().filter(id =>
      [first.uuid, second.uuid, third.uuid].includes(id)
    ),
    [first.uuid, second.uuid, third.uuid],
    "Restored space is back at its old position"
  );
  ok(
    !gZenWorkspaces.workspaceElement(second.uuid).archived,
    "Space element is no longer archived"
  );
  is(
    gZenWorkspaces.getWorkspaceFromId(second.uuid).archived,
    false,
    "Restore stores an explicit false for sync"
  );

  BrowserTestUtils.removeTab(pinned);
});

add_task(async function test_archive_unloads_tabs() {
  const [first, second] = await createTestSpaces(2);
  await gZenWorkspaces.changeWorkspace(second);
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "data:text/html,<title>Archive me</title>",
    true,
    { skipAnimation: true }
  );
  is(tab.getAttribute("zen-workspace-id"), second.uuid, "Tab in second");

  await gZenWorkspaces.changeWorkspace(first);
  await gZenWorkspaces.archiveWorkspace(second.uuid);

  ok(tab.isConnected, "Normal tab is kept");
  ok(tab.hasAttribute("pending"), "Normal tab is unloaded");

  await gZenWorkspaces.restoreWorkspace(second.uuid);
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_zombie_cleanup_keeps_archived_tabs() {
  const [, second] = await createTestSpaces(2);
  const pinned = BrowserTestUtils.addTab(gBrowser, "about:blank");
  gBrowser.pinTab(pinned);
  gZenWorkspaces.moveTabToWorkspace(pinned, second.uuid);
  await gZenWorkspaces.archiveWorkspace(second.uuid);

  // Same check the zombie cleanup runs on startup.
  ok(
    gZenWorkspaces
      .getWorkspaces()
      .some(w => w.uuid === pinned.getAttribute("zen-workspace-id")),
    "Tabs of an archived space are not considered zombies"
  );

  await gZenWorkspaces.restoreWorkspace(second.uuid);
  BrowserTestUtils.removeTab(pinned);
});
