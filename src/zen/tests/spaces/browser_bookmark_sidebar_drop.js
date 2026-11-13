/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PLACE_TYPE = "text/x-moz-place";

function placePayload(info) {
  return JSON.stringify({
    type: info.placeType ?? PlacesUtils.TYPE_X_MOZ_PLACE,
    itemGuid: info.guid,
    uri: info.url?.href,
    title: info.title,
    instanceId: PlacesUtils.instanceId,
  });
}

function dropPlaces(space, payloads) {
  space.setBookmarkDropReady(true);
  const target = space.bookmarksContainer.hidden
    ? space.bookmarksDropHint
    : space.bookmarksContainer;
  EventUtils.synthesizeDrop(
    target,
    target,
    [payloads.map(data => ({ type: PLACE_TYPE, data }))],
    "copy",
    window
  );
}

function pinnedGuids(space) {
  return [
    ...space.bookmarksContainer.querySelectorAll(
      ".zen-workspace-bookmark-item"
    ),
  ].map(item => item.getAttribute("data-guid"));
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.spaces.bookmarks-in-sidebar", true]],
  });
  await gZenWorkspaces.promiseInitialized;
  await ZenWorkspaceBookmarksStorage.promiseInitialized;
});

add_task(async function test_drop_bookmark_folder_and_remove() {
  const space = gZenWorkspaces.activeWorkspaceElement;
  const folder = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.unfiledGuid,
    type: PlacesUtils.bookmarks.TYPE_FOLDER,
    title: "Drop folder",
  });
  const inFolder = await PlacesUtils.bookmarks.insert({
    parentGuid: folder.guid,
    title: "In folder",
    url: "https://example.com/in-folder",
  });
  const single = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.unfiledGuid,
    title: "Single",
    url: "https://example.com/single",
  });
  registerCleanupFunction(async () => {
    await PlacesUtils.bookmarks.remove(folder);
    await PlacesUtils.bookmarks.remove(single);
  });
  const tabCount = gBrowser.tabs.length;

  dropPlaces(space, [placePayload(single)]);
  await TestUtils.waitForCondition(
    () => pinnedGuids(space).includes(single.guid),
    "The dropped bookmark is pinned to the Space"
  );
  Assert.equal(gBrowser.tabs.length, tabCount, "No tab is opened by the drop");

  dropPlaces(space, [
    placePayload({
      guid: folder.guid,
      title: folder.title,
      placeType: PlacesUtils.TYPE_X_MOZ_PLACE_CONTAINER,
    }),
  ]);
  await TestUtils.waitForCondition(
    () => pinnedGuids(space).includes(inFolder.guid),
    "Dropping a folder pins the bookmarks inside it"
  );
  Assert.ok(
    !pinnedGuids(space).includes(folder.guid),
    "The folder itself is not pinned"
  );
  Assert.equal(
    (await PlacesUtils.bookmarks.fetch(inFolder.guid)).parentGuid,
    folder.guid,
    "The bookmark stays in its folder"
  );

  const item = space.bookmarksContainer.querySelector(
    `[data-guid="${single.guid}"]`
  );
  const popup = document.getElementById("zenSpaceBookmarkContext");
  const shown = BrowserTestUtils.waitForEvent(popup, "popupshown");
  EventUtils.synthesizeMouseAtCenter(
    item,
    { type: "contextmenu", button: 2 },
    window
  );
  await shown;
  popup.activateItem(document.getElementById("context_zenSpaceBookmarkRemove"));
  await TestUtils.waitForCondition(
    () => !pinnedGuids(space).includes(single.guid),
    "Remove from Space unpins the bookmark"
  );
  Assert.ok(
    await PlacesUtils.bookmarks.fetch(single.guid),
    "The bookmark itself is kept"
  );
});

add_task(async function test_reject_history_entries() {
  const space = gZenWorkspaces.activeWorkspaceElement;
  const before = pinnedGuids(space);
  const tabCount = gBrowser.tabs.length;
  // History entries have no bookmark GUID.
  dropPlaces(space, [
    JSON.stringify({
      type: PlacesUtils.TYPE_X_MOZ_PLACE,
      uri: "https://example.com/history",
      title: "History",
    }),
  ]);
  await new Promise(resolve => requestAnimationFrame(resolve));
  await new Promise(resolve => requestAnimationFrame(resolve));
  Assert.deepEqual(pinnedGuids(space), before, "Nothing is pinned");
  Assert.equal(gBrowser.tabs.length, tabCount, "No tab is opened either");
});
