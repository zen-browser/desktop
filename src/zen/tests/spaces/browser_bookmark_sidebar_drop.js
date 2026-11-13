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

add_task(async function test_toolbar_node_to_empty_space() {
  const space = gZenWorkspaces.activeWorkspaceElement;
  const toolbar = document.getElementById("PersonalToolbar");
  const wasCollapsed = toolbar.collapsed;
  setToolbarVisibility(toolbar, true, undefined, false);
  const bookmark = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.toolbarGuid,
    title: "Toolbar source",
    url: "https://example.com/toolbar-source",
  });
  registerCleanupFunction(async () => {
    await PlacesUtils.bookmarks.remove(bookmark);
    setToolbarVisibility(toolbar, !wasCollapsed, undefined, false);
  });
  await TestUtils.waitForCondition(
    () =>
      [...document.getElementById("PlacesToolbarItems").children].some(
        element => element._placesNode?.bookmarkGuid === bookmark.guid
      ),
    "Toolbar bookmark is rendered"
  );
  const source = [
    ...document.getElementById("PlacesToolbarItems").children,
  ].find(element => element._placesNode?.bookmarkGuid === bookmark.guid);
  Assert.ok(space.bookmarksDropHint.hidden, "Empty Space hint starts hidden");
  EventUtils.startDragSession(window, "copy");
  try {
    const [, dataTransfer] = EventUtils.synthesizeDragOver(
      source,
      space,
      [
        [
          {
            type: PLACE_TYPE,
            data: PlacesUtils.wrapNode(source._placesNode, PLACE_TYPE),
          },
        ],
      ],
      "copy",
      window
    );
    Assert.ok(
      dataTransfer.types.includes(PLACE_TYPE),
      "The drag contains a serialized toolbar Places node"
    );
    EventUtils.sendDragEvent(
      EventUtils.createDragEventObject(
        "dragenter",
        space,
        window,
        dataTransfer,
        {}
      ),
      space,
      window
    );
    Assert.ok(
      !space.bookmarksDropHint.hidden,
      "The window dragenter reveals the empty Space drop target"
    );
    const event = EventUtils.createDragEventObject(
      "dragover",
      space.bookmarksDropHint,
      window,
      dataTransfer,
      {}
    );
    const result = EventUtils.sendDragEvent(
      event,
      space.bookmarksDropHint,
      window
    );
    const effect = EventUtils.synthesizeDropAfterDragOver(
      result,
      dataTransfer,
      space.bookmarksDropHint,
      window
    );
    Assert.equal(effect, "copy", "The bookmark drop is accepted as a copy");
  } finally {
    window.windowUtils.dragSession?.endDragSession(true, 0);
  }
  await TestUtils.waitForCondition(
    () => pinnedGuids(space).includes(bookmark.guid),
    "A serialized toolbar bookmark is assigned to the empty Space"
  );
});

add_task(async function test_places_drop_on_tab_strip() {
  const source = [
    ...document.getElementById("PlacesToolbarItems").children,
  ].find(element => element._placesNode?.title === "Toolbar source");
  const target = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const bookmark = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.unfiledGuid,
    title: "Tab strip drop",
    url: "https://example.com/tab-strip-drop",
  });
  registerCleanupFunction(() => PlacesUtils.bookmarks.remove(bookmark));
  const tabsBefore = new Set(gBrowser.tabs);
  let dropReceived = false;
  const listener = () => {
    dropReceived = true;
  };
  target.addEventListener("drop", listener, { once: true, capture: true });
  try {
    EventUtils.synthesizeDrop(
      source,
      target,
      [
        [
          { type: PLACE_TYPE, data: placePayload(bookmark) },
          {
            type: "text/x-moz-url",
            data: `${bookmark.url.href}\n${bookmark.title}`,
          },
        ],
      ],
      "link",
      window
    );
    Assert.ok(dropReceived, "The native tab drop event was received");
    await TestUtils.waitForCondition(
      () =>
        [...gBrowser.tabs].some(
          tab => tab.linkedBrowser.currentURI.spec === bookmark.url.href
        ),
      "The dropped bookmark navigates a disposable tab"
    );
  } finally {
    target.removeEventListener("drop", listener);
    if (gBrowser.tabs.includes(target)) {
      await BrowserTestUtils.removeTab(target);
    }
    for (const addedTab of gBrowser.tabs) {
      if (!tabsBefore.has(addedTab)) {
        await BrowserTestUtils.removeTab(addedTab);
      }
    }
  }
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

  const shortcutOnly = await PlacesUtils.bookmarks.insert({
    parentGuid: folder.guid,
    title: "Folder shortcut only",
    url: "https://example.com/folder-shortcut-only",
  });
  dropPlaces(space, [
    JSON.stringify({
      type: PLACE_TYPE,
      itemGuid: PlacesUtils.bookmarks.toolbarGuid,
      concreteGuid: folder.guid,
      uri: `place:parent=${folder.guid}`,
      instanceId: PlacesUtils.instanceId,
    }),
  ]);
  await TestUtils.waitForCondition(
    () => pinnedGuids(space).includes(shortcutOnly.guid),
    "A folder-shortcut payload pins bookmarks through concreteGuid"
  );

  const item = space.bookmarksContainer.querySelector(
    `[data-guid="${single.guid}"]`
  );
  const currentURI = gBrowser.selectedBrowser.currentURI.spec;
  const nativeOpenNodeWithEvent = PlacesUIUtils.openNodeWithEvent;
  const openedNodes = [];
  PlacesUIUtils.openNodeWithEvent = (node, event) => {
    openedNodes.push({ node, event });
  };
  try {
    item.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 2 }));
    Assert.equal(openedNodes.length, 0, "Right-click does not open a bookmark");

    item.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    Assert.equal(openedNodes.length, 1, "Left-click opens through Places");
    Assert.equal(openedNodes[0].node.bookmarkGuid, single.guid);

    const middleClick = new MouseEvent("auxclick", {
      bubbles: true,
      cancelable: true,
      button: 1,
    });
    item.dispatchEvent(middleClick);
    Assert.equal(openedNodes.length, 2, "Middle-click opens through Places");
    Assert.ok(middleClick.defaultPrevented, "Middle-click is consumed");
  } finally {
    PlacesUIUtils.openNodeWithEvent = nativeOpenNodeWithEvent;
  }

  const popup = document.getElementById("zenSpaceBookmarkContext");
  const shown = BrowserTestUtils.waitForEvent(popup, "popupshown");
  EventUtils.synthesizeMouseAtCenter(
    item,
    { type: "contextmenu", button: 2 },
    window
  );
  await shown;
  Assert.equal(
    gBrowser.selectedBrowser.currentURI.spec,
    currentURI,
    "Right-click does not navigate the current tab"
  );
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

add_task(async function test_bookmark_refresh_ignores_unassigned_changes() {
  const space = gZenWorkspaces.activeWorkspaceElement;
  const assigned = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.unfiledGuid,
    title: "Assigned refresh test",
    url: "https://example.com/assigned-refresh-test",
  });
  const unrelated = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.unfiledGuid,
    title: "Unrelated refresh test",
    url: "https://example.com/unrelated-refresh-test",
  });
  registerCleanupFunction(async () => {
    await PlacesUtils.bookmarks.remove(assigned);
    await PlacesUtils.bookmarks.remove(unrelated);
  });
  await ZenWorkspaceBookmarksStorage.addBookmarksToWorkspace(
    [assigned.guid],
    space.id
  );
  await new Promise(resolve => setTimeout(resolve, 100));

  const refresh = space.refreshBookmarks;
  let refreshCount = 0;
  space.refreshBookmarks = function () {
    refreshCount++;
    return refresh.call(this);
  };
  registerCleanupFunction(() => {
    space.refreshBookmarks = refresh;
  });

  await PlacesUtils.bookmarks.update({
    guid: unrelated.guid,
    title: "Unrelated changed",
  });
  await new Promise(resolve => setTimeout(resolve, 100));
  Assert.equal(refreshCount, 0, "Unassigned bookmark edits are ignored");

  await Promise.all(
    ["Assigned changed 1", "Assigned changed 2", "Assigned changed 3"].map(
      title => PlacesUtils.bookmarks.update({ guid: assigned.guid, title })
    )
  );
  await new Promise(resolve => setTimeout(resolve, 100));
  Assert.equal(
    refreshCount,
    1,
    "Changes to an assigned bookmark are coalesced"
  );
});
