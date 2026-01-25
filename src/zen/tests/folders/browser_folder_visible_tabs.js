/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Not_Visible_Collapsed() {
  const tab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const folder = await gZenFolders.createFolder([tab]);

  Assert.equal(
    folder.tabs.length,
    2,
    "Subfolder contains the tab and the empty tab created by Zen Folders"
  );
  ok(tab.visible, "Tab is visible in the folder");

  folder.collapsed = true;
  ok(!tab.visible, "Tab is not visible in the folder when collapsed");
  await removeFolder(folder);
});

add_task(async function test_Visible_Selected() {
  const originalTab = gBrowser.selectedTab;
  const tab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const folder = await gZenFolders.createFolder([tab]);

  Assert.equal(
    folder.tabs.length,
    2,
    "Subfolder contains the tab and the empty tab created by Zen Folders"
  );
  ok(tab.visible, "Tab is visible in the folder");
  gBrowser.selectedTab = tab;
  folder.collapsed = true;
  ok(tab.visible, "Tab is visible in the folder when collapsed");
  ok(tab.hasAttribute("folder-active"), "Tab is marked as active in the folder when selected");
  ok(
    tab.group.hasAttribute("has-active"),
    "Tab group is marked as active when the tab is selected"
  );
  Assert.deepEqual(
    tab.group.activeTabs,
    [tab],
    "Tab is included in the active tabs of the group when selected"
  );

  gBrowser.selectedTab = originalTab;
  await removeFolder(folder);
});

add_task(async function test_Visible_Not_Selected() {
  const originalTab = gBrowser.selectedTab;
  const tab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const folder = await gZenFolders.createFolder([tab]);

  Assert.equal(
    folder.tabs.length,
    2,
    "Subfolder contains the tab and the empty tab created by Zen Folders"
  );
  ok(tab.visible, "Tab is visible in the folder");
  gBrowser.selectedTab = tab;
  folder.collapsed = true;
  gBrowser.selectedTab = originalTab;
  ok(tab.visible, "Tab is visible in the folder when collapsed");
  ok(tab.hasAttribute("folder-active"), "Tab is marked as active in the folder when selected");
  ok(
    tab.group.hasAttribute("has-active"),
    "Tab group is marked as active when the tab is selected"
  );
  Assert.deepEqual(
    tab.group.activeTabs,
    [tab],
    "Tab is included in the active tabs of the group when selected"
  );

  await removeFolder(folder);
});
