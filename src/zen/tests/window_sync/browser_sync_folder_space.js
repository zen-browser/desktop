/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_MirroredFolderKeepsItsOwnSpace() {
  await gZenWorkspaces.promiseInitialized;
  const spaceA = await gZenWorkspaces.createAndSaveWorkspace("space A");
  const spaceB = await gZenWorkspaces.createAndSaveWorkspace("space B");

  try {
    await withNewSyncedWindow(async win => {
      await gZenWorkspaces.changeWorkspace(spaceB);
      await win.gZenWorkspaces.changeWorkspace(spaceA);
      Assert.equal(
        win.gZenWorkspaces.activeWorkspace,
        spaceA.uuid,
        "The other window shows a different space"
      );

      const tab = BrowserTestUtils.addTab(gBrowser, "data:text/html,folder");
      const folder = await gZenFolders.createFolder([tab], {
        renameFolder: false,
        label: "mirrored",
      });
      Assert.equal(
        folder.getAttribute("zen-workspace-id"),
        spaceB.uuid,
        "The folder is created in the space its window shows"
      );

      await TestUtils.waitForCondition(
        () => gZenWindowSync.getItemFromWindow(win, folder.id),
        "the folder is mirrored into the other window"
      );
      const mirror = gZenWindowSync.getItemFromWindow(win, folder.id);

      Assert.equal(
        mirror.getAttribute("zen-workspace-id"),
        spaceB.uuid,
        "The copy keeps the space the folder was created in"
      );
      Assert.notEqual(
        mirror.getAttribute("zen-workspace-id"),
        win.gZenWorkspaces.activeWorkspace,
        "and not the space the mirroring window happened to show"
      );

      const stored = win.gZenFolders
        .storeDataForSessionStore()
        .find(f => f.id === folder.id);
      Assert.equal(
        stored?.workspaceId,
        spaceB.uuid,
        "The other window would store the right space for it"
      );

      await folder.delete();
    });
  } finally {
    await gZenWorkspaces.removeWorkspace(spaceA.uuid);
    await gZenWorkspaces.removeWorkspace(spaceB.uuid);
  }
});

add_task(async function test_MirroredFolderKeepsTheLiveFlag() {
  await gZenWorkspaces.promiseInitialized;

  await withNewSyncedWindow(async win => {
    const folder = await gZenFolders.createFolder([], {
      renameFolder: false,
      label: "live",
      isLiveFolder: true,
    });
    Assert.ok(folder.isLiveFolder, "The folder is a live folder");

    await TestUtils.waitForCondition(
      () => gZenWindowSync.getItemFromWindow(win, folder.id),
      "the live folder is mirrored into the other window"
    );
    const mirror = gZenWindowSync.getItemFromWindow(win, folder.id);
    Assert.ok(mirror.isLiveFolder, "The copy is a live folder too");

    await folder.delete();
  });
});
