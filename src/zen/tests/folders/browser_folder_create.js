/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Create_Folder() {
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const folder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
    label: "test",
  });
  ok(folder, "Folder created successfully");
  Assert.equal(
    folder.tabs.length,
    2,
    "Folder contains the tab and the empty tab created by Zen Folders"
  );
  ok(tab.pinned, "Tab is pinned after folder creation");
  Assert.equal(folder.label, "test", "Folder label is set correctly");
  ok(!folder.collapsed, "Folder is expanded after creation");
  await removeFolder(folder);
  Assert.equal(folder.tabs.length, 0, "Folder is empty after deletion");
  ok(!folder.parentElement, "Folder is removed from the DOM");
  ok(tab.closing, "Tab is closing after folder deletion");
});
