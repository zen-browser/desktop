/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  globalActions: "resource:///modules/ZenUBGlobalActions.sys.mjs",
});

const COLLAPSE_ALL = "zen:global-action-collapse-all-folders";
const EXPAND_ALL = "zen:global-action-expand-all-folders";

function findAction(commandId) {
  return globalActions.find(action => action.commandId === commandId);
}

async function createNestedFolders() {
  const parentTab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const childTab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab2");
  const siblingTab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab3");
  const subfolder = await gZenFolders.createFolder([childTab], {
    renameFolder: false,
    label: "subfolder",
  });
  const parent = await gZenFolders.createFolder([parentTab], {
    renameFolder: false,
    label: "parent",
  });
  const sibling = await gZenFolders.createFolder([siblingTab], {
    renameFolder: false,
    label: "sibling",
  });
  parentTab.after(subfolder);
  // createFolder sets the initial collapsed state on a timeout.
  await new Promise(resolve => setTimeout(resolve, 0));

  return { parent, subfolder, sibling, childTab, siblingTab };
}

add_task(async function test_Collapse_And_Expand_All_Folders() {
  const { parent, subfolder, sibling, childTab, siblingTab } =
    await createNestedFolders();
  const folders = [parent, subfolder, sibling];

  Assert.deepEqual(
    gZenFolders.activeSpaceFolders,
    [parent, subfolder, sibling],
    "The active space lists every folder, parents before their children"
  );
  ok(
    findAction(COLLAPSE_ALL).isAvailable(window),
    "Collapse all is available while a folder is expanded"
  );
  ok(
    !findAction(EXPAND_ALL).isAvailable(window),
    "Expand all is unavailable while every folder is expanded"
  );

  await gZenFolders.collapseAllFolders();

  for (const folder of folders) {
    ok(folder.collapsed, `Folder "${folder.label}" is collapsed`);
  }
  for (const tab of [childTab, siblingTab]) {
    Assert.equal(
      tab.getBoundingClientRect().height,
      0,
      "Tab of a collapsed folder is hidden"
    );
  }
  ok(
    !findAction(COLLAPSE_ALL).isAvailable(window),
    "Collapse all is unavailable once every folder is collapsed"
  );
  ok(
    findAction(EXPAND_ALL).isAvailable(window),
    "Expand all is available while a folder is collapsed"
  );

  await gZenFolders.expandAllFolders();

  for (const folder of folders) {
    ok(!folder.collapsed, `Folder "${folder.label}" is expanded again`);
  }
  for (const tab of [childTab, siblingTab]) {
    ok(tab.getBoundingClientRect().height, "Tab is visible again");
  }

  await removeFolder(subfolder);
  await removeFolder(parent);
  await removeFolder(sibling);
});

add_task(async function test_Collapse_And_Expand_All_Folders_Icons() {
  for (const commandId of [COLLAPSE_ALL, EXPAND_ALL]) {
    const { icon } = findAction(commandId);
    const response = await fetch(icon);
    ok(response.ok, `The icon of ${commandId} resolves: ${icon}`);
  }
});

add_task(async function test_Collapse_And_Expand_All_Folders_Actions() {
  const { parent, subfolder, sibling } = await createNestedFolders();
  const folders = [parent, subfolder, sibling];

  await findAction(COLLAPSE_ALL).command(window);
  ok(
    folders.every(folder => folder.collapsed),
    "Every folder collapses through the collapse all action"
  );

  await findAction(EXPAND_ALL).command(window);
  ok(
    folders.every(folder => !folder.collapsed),
    "Every folder expands through the expand all action"
  );

  await removeFolder(subfolder);
  await removeFolder(parent);
  await removeFolder(sibling);
});
