/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TOGGLE_DELAY = 90;

function folderHeight(folder) {
  return folder.getBoundingClientRect().height;
}

async function waitForFolderSettled(folder, message) {
  let previous = null;
  await TestUtils.waitForCondition(() => {
    const height = folderHeight(folder);
    const settled = previous !== null && Math.abs(height - previous) < 1;
    previous = height;
    return settled;
  }, message);
}

add_task(async function test_Issue_15522() {
  const tab1 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const tab2 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const folder = await gZenFolders.createFolder([tab1, tab2], {
    renameFolder: false,
    label: "folder",
  });
  await waitForFolderSettled(folder, "Folder should be done opening");
  const expandedHeight = folderHeight(folder);

  folder.collapsed = true;
  await waitForFolderSettled(folder, "Folder should be done collapsing");
  const collapsedHeight = folderHeight(folder);
  Assert.less(
    collapsedHeight,
    expandedHeight,
    "Collapsing the folder should hide its tabs"
  );

  folder.collapsed = false;
  await waitForFolderSettled(folder, "Folder should be done expanding");
  Assert.lessOrEqual(
    Math.abs(folderHeight(folder) - expandedHeight),
    1,
    "Expanding the folder should show its tabs again"
  );

  folder.collapsed = true;
  await new Promise(resolve => setTimeout(resolve, TOGGLE_DELAY));
  folder.collapsed = false;
  await new Promise(resolve => setTimeout(resolve, TOGGLE_DELAY));
  folder.collapsed = true;

  await waitForFolderSettled(folder, "Folder should be done collapsing");
  ok(folder.collapsed, "Folder should be collapsed after spamming toggles");
  Assert.lessOrEqual(
    Math.abs(folderHeight(folder) - collapsedHeight),
    1,
    "Folder should be fully collapsed instead of stuck half open"
  );

  await removeFolder(folder);
});
