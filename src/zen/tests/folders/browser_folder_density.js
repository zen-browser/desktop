/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Folder_Density() {
  const tab = gBrowser.selectedTab;
  const folder = await gZenFolders.createFolder([], {
    renameFolder: false,
  });

  let tabRect = tab.getBoundingClientRect();
  let folderRect = folder.labelElement.parentElement.getBoundingClientRect();
  Assert.equal(tabRect.height, folderRect.height, 'Folder height matches tab height');
  Assert.equal(tabRect.width, folderRect.width, 'Folder width matches tab width');

  gUIDensity.update(gUIDensity.MODE_TOUCH);

  tabRect = tab.getBoundingClientRect();
  folderRect = folder.getBoundingClientRect();
  Assert.equal(tabRect.height, folderRect.height, 'Folder height matches tab height');
  Assert.equal(tabRect.width, folderRect.width, 'Folder width matches tab width');

  gUIDensity.update();
  await removeFolder(folder);
});
