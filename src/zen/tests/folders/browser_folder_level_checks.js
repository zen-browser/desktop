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

  Assert.equal(parent.level, 0, "Parent folder should be at level 0");
  Assert.equal(subfolder.level, 1, "Subfolder should be at level 1");

  await removeFolder(parent);
});
