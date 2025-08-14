/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Basic_Toggle() {
  const folder = await gZenFolders.createFolder([], {
    renameFolder: false,
    label: 'subfolder',
  });

  ok(!folder.collapsed, 'Folder should not be collapsed by default');

  folder.labelElement.click();
  ok(folder.collapsed, 'Folder should be collapsed after clicking on it');

  folder.labelElement.click();
  ok(!folder.collapsed, 'Folder should be expanded after clicking on it again');

  const removeEvent = BrowserTestUtils.waitForEvent(folder, 'TabGroupRemoved');
  folder.delete();
  await removeEvent;
});
