/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function moveTabToFolder() {
  document.getElementById("cmd_zenMoveTabToFolder").doCommand();
}

add_task(async function test_Move_Tab_To_Folder_Shortcut_Registered() {
  ok(
    gZenKeyboardShortcutsManager._currentShortcutList?.length,
    "The keyboard shortcut registry is loaded"
  );

  const shortcut = gZenKeyboardShortcutsManager.getShortcutFromCommand(
    "cmd_zenMoveTabToFolder"
  );
  ok(shortcut, "The move to folder shortcut is registered");
  Assert.equal(
    shortcut.getKeyName().toUpperCase(),
    "F",
    "Shortcut is bound to the F key"
  );

  const modifiers = shortcut.getModifiers();
  ok(modifiers.accel, "Shortcut uses accel");
  ok(modifiers.alt, "Shortcut uses alt");
  ok(modifiers.shift, "Shortcut uses shift");

  // Accel+Alt+F on its own is "key_search2". The registry here has Firefox's
  //  own keyset merged into it, so this catches a collision with any of the
  //  141 bindings, not just the ones Zen declares.
  const conflict = gZenKeyboardShortcutsManager.checkForConflicts(
    shortcut.getKeyName(),
    modifiers,
    shortcut.getID()
  );
  ok(
    !conflict.hasConflicts,
    `Default binding is free, conflicts with: ${conflict.conflictShortcut?.getID()}`
  );
});

// Note: This task runs first of the move tasks on purpose, so that the space
// is still guaranteed to be free of folders.
add_task(async function test_Move_Tab_To_Folder_Without_Folders() {
  const selectedTab = gBrowser.selectedTab;
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  gBrowser.selectedTab = tab;

  Assert.equal(
    gZenFolders.getTargetFoldersForTabs([tab]).length,
    0,
    "The space has no folder to move the tab into"
  );

  moveTabToFolder();

  ok(!tab.group, "Tab is not grouped when the space has no folders");
  ok(!tab.pinned, "Tab is not pinned when the space has no folders");

  gBrowser.selectedTab = selectedTab;
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_Move_Tab_To_First_Folder_By_Default() {
  const selectedTab = gBrowser.selectedTab;
  const folderA = await gZenFolders.createFolder([], {
    renameFolder: false,
    label: "a",
  });
  const folderB = await gZenFolders.createFolder([], {
    renameFolder: false,
    label: "b",
  });

  // No tab has been moved into or selected inside either folder yet, so there
  //  is no last used folder and the first one of the space is used instead.
  const firstInSidebar =
    folderA.compareDocumentPosition(folderB) & Node.DOCUMENT_POSITION_FOLLOWING
      ? folderA
      : folderB;

  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  gBrowser.selectedTab = tab;

  const groupedEvent = BrowserTestUtils.waitForEvent(window, "TabGrouped");
  moveTabToFolder();
  await groupedEvent;

  Assert.equal(
    tab.group,
    firstInSidebar,
    `Tab is moved into "${firstInSidebar.label}", the first folder of the space`
  );

  gBrowser.selectedTab = selectedTab;
  BrowserTestUtils.removeTab(tab);
  await removeFolder(folderA);
  await removeFolder(folderB);
});

add_task(async function test_Move_Tab_To_Folder() {
  const selectedTab = gBrowser.selectedTab;
  const folder = await gZenFolders.createFolder([], {
    renameFolder: false,
    label: "target",
    collapsed: true,
  });

  // The collapsed state is only applied a tick after the folder is created.
  /* eslint-disable-next-line mozilla/no-arbitrary-setTimeout */
  await new Promise(resolve => setTimeout(resolve, 100));
  ok(folder.collapsed, "Folder starts out collapsed");

  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  gBrowser.selectedTab = tab;

  const groupedEvent = BrowserTestUtils.waitForEvent(window, "TabGrouped");
  moveTabToFolder();
  await groupedEvent;

  Assert.equal(tab.group, folder, "Tab is moved into the folder");
  ok(tab.pinned, "Tab is pinned once it lives inside the folder");
  ok(!folder.collapsed, "Folder is expanded so the moved tab is visible");

  gBrowser.selectedTab = selectedTab;
  BrowserTestUtils.removeTab(tab);
  await removeFolder(folder);
});

add_task(async function test_Move_Tab_To_Last_Used_Folder() {
  const selectedTab = gBrowser.selectedTab;
  const firstFolder = await gZenFolders.createFolder([], {
    renameFolder: false,
    label: "first",
  });
  const secondFolder = await gZenFolders.createFolder([], {
    renameFolder: false,
    label: "second",
  });

  const tabInFirst = BrowserTestUtils.addTab(gBrowser, "about:blank");
  gZenFolders.moveTabsToFolder(firstFolder, [tabInFirst]);
  const tabInSecond = BrowserTestUtils.addTab(gBrowser, "about:blank");
  gZenFolders.moveTabsToFolder(secondFolder, [tabInSecond]);

  // Both folders are targeted in turn, so that the assertions hold no matter
  //  which of the two comes first in the sidebar.
  const movedTabs = [];
  for (const [folder, tabInFolder] of [
    [secondFolder, tabInSecond],
    [firstFolder, tabInFirst],
  ]) {
    // Selecting a tab inside a folder makes it the last used one.
    let selectEvent = BrowserTestUtils.waitForEvent(window, "TabSelect");
    gBrowser.selectedTab = tabInFolder;
    await selectEvent;

    const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
    movedTabs.push(tab);
    selectEvent = BrowserTestUtils.waitForEvent(window, "TabSelect");
    gBrowser.selectedTab = tab;
    await selectEvent;

    const groupedEvent = BrowserTestUtils.waitForEvent(window, "TabGrouped");
    moveTabToFolder();
    await groupedEvent;

    Assert.equal(
      tab.group,
      folder,
      `Tab is moved into "${folder.label}", the last used folder`
    );
  }

  gBrowser.selectedTab = selectedTab;
  for (const tab of movedTabs) {
    BrowserTestUtils.removeTab(tab);
  }
  await removeFolder(firstFolder);
  await removeFolder(secondFolder);
});
