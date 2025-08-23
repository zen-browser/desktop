/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

// Keep in sync with the default value for `zen.folders.max-subfolders`
const TEST_MAX_FOLDERS = 5;

add_task(async function test_Max_Subfolders() {
  const folder = await gZenFolders.createFolder([], {
    renameFolder: false,
  });

  const subfolderItem = document.getElementById('context_zenFolderNewSubfolder');
  debugger;
  let currentFolder = folder;
  for (let i = 1; i < TEST_MAX_FOLDERS; i++) {
    await openFolderContextMenu(currentFolder);
    ok(subfolderItem.getAttribute('disabled') !== 'true', `Subfolder item should be enabled`);
    const folderCreateEvent = BrowserTestUtils.waitForEvent(window, 'TabGroupCreate');
    EventUtils.synthesizeMouseAtCenter(subfolderItem, {});
    await folderCreateEvent;
    const items = currentFolder.allItems;
    Assert.equal(items.length, 2, `Folder should have 2 items`);
    ok(gBrowser.isTabGroup(items[1]), `Item should be a tab group`);
    currentFolder = items[1];
  }

  await openFolderContextMenu(currentFolder);
  Assert.equal(
    subfolderItem.getAttribute('disabled'),
    'true',
    `Subfolder item should be disabled after reaching max subfolders`
  );

  document.getElementById('zenFolderActions').hidePopup();

  await removeFolder(folder);
});
