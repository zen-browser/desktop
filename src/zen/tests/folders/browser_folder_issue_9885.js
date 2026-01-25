/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Issue_9885() {
  const subfolder = await gZenFolders.createFolder([], {
    renameFolder: false,
    label: "subfolder",
  });
  const parent = await gZenFolders.createFolder([], {
    renameFolder: false,
    label: "parent",
  });
  parent.tabs[0].after(subfolder);

  Assert.equal(parent, subfolder.group, "Parent folder is set correctly");

  ok(!subfolder.collapsed, "Subfolder should not be collapsed by default");
  ok(!parent.collapsed, "Parent folder should not be collapsed by default");

  subfolder.labelElement.click();
  ok(subfolder.collapsed, "Subfolder should be collapsed after clicking on it");
  ok(!parent.collapsed, "Parent folder should be collapsed after clicking on subfolder");

  await removeFolder(subfolder);
  await removeFolder(parent);
});
