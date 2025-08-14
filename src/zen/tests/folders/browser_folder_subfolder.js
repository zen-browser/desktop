/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Create_Folder() {
  const tab = BrowserTestUtils.addTab(gBrowser, 'data:text/html,tab1');
  const tab2 = BrowserTestUtils.addTab(gBrowser, 'data:text/html,tab2');
  const subfolder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
    label: 'subfolder',
  });
  const parent = await gZenFolders.createFolder([tab2], {
    renameFolder: false,
    label: 'parent',
  });
  parent.tabs[0].after(subfolder);

  Assert.equal(parent, subfolder.group, 'Parent folder is set correctly');
  Assert.equal(
    subfolder.tabs.length,
    2,
    'Subfolder contains the tab and the empty tab created by Zen Folders'
  );
  Assert.equal(parent.tabs.length, 4, 'Parent folder contains the subfolder');
  const removeEvent = BrowserTestUtils.waitForEvent(window, 'TabGroupRemoved');
  parent.delete();
  await removeEvent;
});
