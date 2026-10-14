/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Dragging a folder by its label over unpinned tabs is rejected by
// #applyDragoverIndicator. It used to return its values in the wrong order
// there, so the drop threw "dropElement.hasAttribute is not a function".
// An uncaught error fails the test, so getting through the drop is the check.
add_task(async function test_drag_folder_label_over_unpinned_tab() {
  const pinnedTab = await addTabTo(gBrowser);
  const folder = await gZenFolders.createFolder([pinnedTab], {
    renameFolder: false,
    label: "folder",
  });
  const unpinnedTab1 = await addTabTo(gBrowser);
  const unpinnedTab2 = await addTabTo(gBrowser);
  Assert.ok(!unpinnedTab1.pinned, "Target tab should not be pinned");

  const pinnedTabIndex = pinnedTab._tPos;
  const rect = unpinnedTab2.getBoundingClientRect();
  EventUtils.synthesizeDrop(
    folder.labelElement,
    unpinnedTab2,
    null,
    "move",
    window,
    window,
    {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
  );
  // Ensure dnd suppression is cleared.
  EventUtils.synthesizeMouseAtCenter(unpinnedTab2, { type: "mouseup" });
  await TestUtils.waitForTick();

  Assert.ok(folder.isConnected, "Folder should still exist");
  Assert.equal(
    pinnedTab._tPos,
    pinnedTabIndex,
    "Folder should stay where it was"
  );
  Assert.equal(pinnedTab.group, folder, "Tab should still be in the folder");
  Assert.ok(pinnedTab.pinned, "Tab inside the folder should stay pinned");
  Assert.ok(
    !gBrowser.tabContainer.hasAttribute("movingtab"),
    "The drag should be finished"
  );

  await removeFolder(folder);
  BrowserTestUtils.removeTab(unpinnedTab1);
  BrowserTestUtils.removeTab(unpinnedTab2);
});
