/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function getToolbarButton(title) {
  return [...document.getElementById("PlacesToolbarItems").children].find(
    child => child._placesNode?.title == title
  );
}

add_setup(async function () {
  const toolbar = document.getElementById("PersonalToolbar");
  const wasCollapsed = toolbar.collapsed;
  if (wasCollapsed) {
    setToolbarVisibility(toolbar, true, undefined, false);
    await TestUtils.waitForCondition(() => !toolbar.collapsed);
  }
  registerCleanupFunction(async () => {
    if (wasCollapsed) {
      setToolbarVisibility(toolbar, false, undefined, false);
    }
    await PlacesUtils.bookmarks.eraseEverything();
  });
});

add_task(async function test_space_switch_keeps_bookmarks_toolbar() {
  const firstSpace = gZenWorkspaces.getActiveWorkspace();
  const bookmark = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.toolbarGuid,
    title: "gh-16167",
    url: "https://example.com/",
  });
  await TestUtils.waitForCondition(() => getToolbarButton(bookmark.title));

  const secondSpace = await gZenWorkspaces.createAndSaveWorkspace("Space 2");
  await gZenWorkspaces.changeWorkspace(firstSpace);
  const button = await TestUtils.waitForCondition(() =>
    getToolbarButton(bookmark.title)
  );

  await gZenWorkspaces.changeWorkspace(secondSpace);
  ok(
    button.isConnected,
    "The toolbar is not rebuilt when both spaces show the same bookmarks"
  );

  // Assign the bookmark to the first space, so the toolbar must change.
  const cache = gZenWorkspaces._workspaceBookmarksCache;
  const originalBookmarks = cache.bookmarks;
  cache.bookmarks = { [firstSpace.uuid]: [bookmark.guid] };
  try {
    await gZenWorkspaces.changeWorkspace(firstSpace);
    await TestUtils.waitForCondition(() => getToolbarButton(bookmark.title));
    await gZenWorkspaces.changeWorkspace(secondSpace);
    await TestUtils.waitForCondition(
      () => !getToolbarButton(bookmark.title),
      "The bookmark is hidden in a space it is not assigned to"
    );
  } finally {
    cache.bookmarks = originalBookmarks;
    await gZenWorkspaces.removeWorkspace(secondSpace.uuid);
  }
});
