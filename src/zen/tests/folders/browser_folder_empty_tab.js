/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Empty_Tab_First() {
  const tab = gBrowser.selectedTab;

  const [tab1, tab2] = await Promise.all([addTabTo(gBrowser), addTabTo(gBrowser)]);
  const folder = await gZenFolders.createFolder([tab1], {
    renameFolder: false,
  });

  Assert.equal(folder.tabs.length, 2, 'Folder should contain the original tab');
  ok(folder.tabs[0].hasAttribute('zen-empty-tab'), 'First tab should be an empty tab');

  folder.appendChild(tab2);
  Assert.equal(folder.tabs.length, 3, 'Folder should contain the second tab');
  ok(folder.tabs[0].hasAttribute('zen-empty-tab'), 'First tab should be an empty tab');

  await removeFolder(folder);
});
