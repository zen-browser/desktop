/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Create_Folder() {
  const tab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const tab2 = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab2");
  const subfolder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
    label: "subfolder",
  });
  const parent = await gZenFolders.createFolder([tab2], {
    renameFolder: false,
    label: "parent",
  });
  parent.tabs[0].after(subfolder);

  Assert.equal(parent, subfolder.group, "Parent folder is set correctly");
  Assert.equal(
    subfolder.tabs.length,
    2,
    "Subfolder contains the tab and the empty tab created by Zen Folders"
  );
  Assert.equal(parent.tabs.length, 4, "Parent folder contains the subfolder");
  await removeFolder(subfolder);
  await removeFolder(parent);
});

add_task(async function test_Collapsed_Subfolder_Stays_Collapsed() {
  const originalTab = gBrowser.selectedTab;
  const activeTab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const hiddenTab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab2");
  const parentTab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab3");
  const subfolder = await gZenFolders.createFolder([activeTab, hiddenTab], {
    renameFolder: false,
    label: "subfolder",
  });
  const parent = await gZenFolders.createFolder([parentTab], {
    renameFolder: false,
    label: "parent",
  });
  parentTab.after(subfolder);
  gBrowser.selectedTab = activeTab;
  await new Promise(resolve => setTimeout(resolve, 0));

  const height = tab => tab.getBoundingClientRect().height;

  subfolder.collapsed = true;
  await TestUtils.waitForCondition(
    () => !height(hiddenTab),
    "Unselected tab is hidden when the subfolder collapses"
  );

  parent.collapsed = true;
  await TestUtils.waitForCondition(
    () => !height(parentTab),
    "Parent tab is hidden when the parent folder collapses"
  );

  parent.collapsed = false;
  await TestUtils.waitForCondition(
    () => height(parentTab) && !parent.hasAttribute("has-active"),
    "Parent folder is expanded again"
  );
  await TestUtils.waitForTick();

  ok(subfolder.collapsed, "Subfolder is still collapsed");
  ok(height(activeTab), "Active tab of the subfolder is still visible");
  Assert.equal(
    height(hiddenTab),
    0,
    "Unselected tab of the collapsed subfolder stays hidden"
  );

  gBrowser.selectedTab = originalTab;
  await removeFolder(subfolder);
  await removeFolder(parent);
});

add_task(async function test_Spam_Toggle_Parent_Folder() {
  const originalTab = gBrowser.selectedTab;
  const activeTab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const hiddenTab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab2");
  const parentTab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab3");
  const subfolder = await gZenFolders.createFolder([activeTab, hiddenTab], {
    renameFolder: false,
    label: "subfolder",
  });
  const parent = await gZenFolders.createFolder([parentTab], {
    renameFolder: false,
    label: "parent",
  });
  parentTab.after(subfolder);
  gBrowser.selectedTab = activeTab;
  // createFolder sets the initial collapsed state on a timeout.
  await new Promise(resolve => setTimeout(resolve, 0));

  const height = tab => tab.getBoundingClientRect().height;
  const indent = tab => tab.style.getPropertyValue("--zen-folder-indent");

  subfolder.collapsed = true;
  await TestUtils.waitForCondition(
    () => !height(hiddenTab),
    "Unselected tab is hidden when the subfolder collapses"
  );

  for (let i = 0; i < 3; i++) {
    parent.collapsed = !parent.collapsed;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  await TestUtils.waitForCondition(
    () => !height(parentTab),
    "Parent tab is hidden when the parent folder ends up collapsed"
  );

  ok(parent.collapsed, "Parent folder is collapsed");
  ok(parent.hasAttribute("has-active"), "Parent folder is still active");
  Assert.deepEqual(parent.activeTabs, [activeTab], "Active tab is kept");
  ok(height(activeTab), "Active tab is still visible");
  Assert.equal(indent(activeTab), "0px", "Active tab lost its indentation");
  Assert.equal(height(hiddenTab), 0, "Unselected tab stays hidden");

  for (let i = 0; i < 3; i++) {
    parent.collapsed = !parent.collapsed;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  await TestUtils.waitForCondition(
    () => height(parentTab),
    "Parent tab is visible when the parent folder ends up expanded"
  );

  ok(!parent.hasAttribute("has-active"), "Parent folder is not active");
  ok(subfolder.hasAttribute("has-active"), "Subfolder is still active");
  Assert.equal(indent(activeTab), "14px", "Active tab is indented again");
  Assert.equal(height(hiddenTab), 0, "Unselected tab stays hidden");

  gBrowser.selectedTab = originalTab;
  await removeFolder(subfolder);
  await removeFolder(parent);
});

add_task(async function test_Select_All_Tabs_Expands_Subfolder() {
  const originalTab = gBrowser.selectedTab;
  const tab1 = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const tab2 = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab2");
  const tab3 = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab3");
  const subfolder = await gZenFolders.createFolder([tab2, tab3], {
    renameFolder: false,
    label: "subfolder",
  });
  const parent = await gZenFolders.createFolder([tab1], {
    renameFolder: false,
    label: "parent",
  });
  tab1.after(subfolder);
  await new Promise(resolve => setTimeout(resolve, 0));

  const height = tab => tab.getBoundingClientRect().height;

  subfolder.collapsed = true;
  gBrowser.selectedTab = tab1;
  parent.collapsed = true;
  await TestUtils.waitForCondition(
    () => !height(tab2) && !height(tab3),
    "Subfolder tabs are hidden when the parent folder collapses"
  );

  gBrowser.selectedTab = tab3;
  await TestUtils.waitForCondition(
    () => height(tab3) && !parent.collapsed,
    "Parent folder is expanded when tab 3 is selected"
  );
  await TestUtils.waitForCondition(
    () => !height(tab2),
    "Tab 2 stays hidden inside of the collapsed subfolder"
  );
  ok(!parent.hasAttribute("has-active"), "Parent folder is not active");
  ok(subfolder.collapsed, "Subfolder is still collapsed");
  ok(subfolder.hasAttribute("has-active"), "Subfolder is active");
  Assert.deepEqual(subfolder.activeTabs, [tab3], "Tab 3 is the active tab");
  ok(!tab1.hasAttribute("folder-active"), "Tab 1 is not folder-active");

  gBrowser.selectedTab = tab2;
  await TestUtils.waitForCondition(
    () => height(tab2),
    "Tab 2 is visible when selected"
  );
  ok(!parent.collapsed, "Parent folder is expanded");
  ok(!subfolder.collapsed, "Subfolder is expanded");
  ok(!parent.hasAttribute("has-active"), "Parent folder is not active");
  ok(!subfolder.hasAttribute("has-active"), "Subfolder is not active");
  for (const tab of [tab1, tab2, tab3]) {
    ok(!tab.hasAttribute("folder-active"), "Tab is not folder-active");
  }

  gBrowser.selectedTab = originalTab;
  await removeFolder(subfolder);
  await removeFolder(parent);
});
