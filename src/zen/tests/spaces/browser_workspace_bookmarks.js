/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URL = "about:buildconfig";
const TEST_URI = Services.io.newURI(TEST_URL);

loadTestSubscript("bookmark_edit_helpers.js");

add_setup(async function () {
  await PlacesUtils.bookmarks.eraseEverything();
  registerCleanupFunction(async () => {
    await PlacesUtils.bookmarks.eraseEverything();
  });
});

async function changeWorkspaceForBookmark(aBookmark, aWorkspace) {
  await promiseToolbarRebuilt();
  const toolbarNode = await waitForToolbarNode(aBookmark.guid);
  await withPropertiesDialog(toolbarNode, async (dialogWin, doc) => {
    await selectSpace(doc, aWorkspace);
    EventUtils.synthesizeKey("VK_RETURN", {}, dialogWin);
  });
}

add_task(async function test_workspace_bookmark() {
  // Zen hides the bookmarks toolbar by default, and with it the toolbar
  // nodes the dialog needs.
  await ensureBookmarksToolbarIsVisibleAndPopulated();

  await gZenWorkspaces.createAndSaveWorkspace("Test Workspace 2");
  const workspaces = gZenWorkspaces.getWorkspaces();
  Assert.strictEqual(workspaces.length, 2, "Two workspaces should exist.");
  const firstWorkspace = workspaces[0];
  const secondWorkspace = workspaces[1];
  Assert.notStrictEqual(
    firstWorkspace.uuid,
    secondWorkspace.uuid,
    "The new workspace should be different from the current one."
  );
  registerCleanupFunction(async () => {
    if (gZenWorkspaces.getWorkspaceFromId(secondWorkspace.uuid)) {
      await gZenWorkspaces.removeWorkspace(secondWorkspace.uuid);
    }
  });

  // The edit surfaces read spaces from the session store, not the live cache.
  flushSpacesToSessionStore();

  await gZenWorkspaces.changeWorkspaceWithID(firstWorkspace.uuid);
  await promiseToolbarRebuilt();
  const bookmark1 = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.toolbarGuid,
    title: "workspace1",
    url: TEST_URI,
  });

  await changeWorkspaceForBookmark(bookmark1, firstWorkspace);

  await promiseToolbarRebuilt();
  const bookmark2 = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.toolbarGuid,
    title: "workspace2",
    url: TEST_URI,
  });

  await changeWorkspaceForBookmark(bookmark2, secondWorkspace);

  await gZenWorkspaces.changeWorkspace(secondWorkspace);
  await TestUtils.waitForCondition(
    () =>
      !getToolbarNodeForItemGuid(bookmark1.guid) &&
      !!getToolbarNodeForItemGuid(bookmark2.guid),
    "bookmark2 should be visible and bookmark1 hidden in the second workspace"
  );

  await gZenWorkspaces.changeWorkspace(firstWorkspace);
  await TestUtils.waitForCondition(
    () =>
      !!getToolbarNodeForItemGuid(bookmark1.guid) &&
      !getToolbarNodeForItemGuid(bookmark2.guid),
    "bookmark1 should be visible and bookmark2 hidden in the first workspace"
  );
});
