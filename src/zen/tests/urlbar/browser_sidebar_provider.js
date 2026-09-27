/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarShared: "chrome://browser/content/urlbar/UrlbarShared.mjs",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
  SessionSaver:
    "moz-src:///browser/components/sessionstore/SessionSaver.sys.mjs",
  TabStateFlusher:
    "moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs",
});

const PROVIDER_NAME = "ZenUrlbarProviderSidebar";
const TAB_URL = "https://example.com/";

async function collectSidebarData() {
  await TabStateFlusher.flushWindow(window);
  await SessionSaver.run();
}

async function searchSidebarRows(value) {
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus,
    value,
  });
  const rows = [];
  for (let index = 0; index < UrlbarTestUtils.getResultCount(window); index++) {
    const { result } = await UrlbarTestUtils.getRowAt(window, index);
    if (result.providerName == PROVIDER_NAME) {
      rows.push({ index, result });
    }
  }
  return rows;
}

async function addLabelledTab(label) {
  const tab = BrowserTestUtils.addTab(gBrowser, TAB_URL, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  tab.zenStaticLabel = label;
  gBrowser._setTabLabel(tab, label);
  return tab;
}

async function removeFolder(folder) {
  const removeEvent = BrowserTestUtils.waitForEvent(folder, "TabGroupRemoved");
  folder.delete();
  await removeEvent;
}

add_task(async function test_custom_label_is_searchable() {
  const tab = await addLabelledTab("Quarterly zeninvoices");
  await collectSidebarData();

  const rows = await searchSidebarRows("zeninvoices quarterly");
  Assert.equal(rows.length, 1, "The renamed tab is the only match");
  const { result } = rows[0];
  Assert.equal(result.type, UrlbarShared.RESULT_TYPE.TAB_SWITCH);
  Assert.equal(result.payload.url, TAB_URL);
  Assert.equal(
    result.payload.title,
    "Quarterly zeninvoices",
    "The custom label is shown instead of the page title"
  );

  Assert.deepEqual(
    await searchSidebarRows("zeninvoices yearly"),
    [],
    "Every token needs to be part of the label"
  );

  await UrlbarTestUtils.promisePopupClose(window);
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_current_tab_is_not_suggested() {
  const tab = await addLabelledTab("zencurrenttab");
  gBrowser.selectedTab = tab;
  await collectSidebarData();

  Assert.deepEqual(
    await searchSidebarRows("zencurrenttab"),
    [],
    "There is no point in switching to the tab we are already in"
  );

  await UrlbarTestUtils.promisePopupClose(window);
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_stale_sidebar_url_is_not_suggested() {
  const tab = await addLabelledTab("zenstaletab");
  await collectSidebarData();

  BrowserTestUtils.startLoadingURIString(
    tab.linkedBrowser,
    "https://example.org/"
  );
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  Assert.deepEqual(
    await searchSidebarRows("zenstaletab"),
    [],
    "A url that is not open anymore must not be offered as switch to tab"
  );

  await UrlbarTestUtils.promisePopupClose(window);
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_only_active_space_tabs() {
  const originalSpace = gZenWorkspaces.activeWorkspace;
  const tab = await addLabelledTab("zenotherspace");
  await gZenWorkspaces.createAndSaveWorkspace("Sidebar Provider Space");
  Assert.notEqual(
    gZenWorkspaces.activeWorkspace,
    originalSpace,
    "The new space is the active one"
  );
  await collectSidebarData();

  Assert.deepEqual(
    await searchSidebarRows("zenotherspace"),
    [],
    "Tabs from other spaces are not matched"
  );
  await UrlbarTestUtils.promisePopupClose(window);

  await gZenWorkspaces.removeWorkspace(gZenWorkspaces.activeWorkspace);
  Assert.equal(gZenWorkspaces.activeWorkspace, originalSpace);
  await collectSidebarData();

  const rows = await searchSidebarRows("zenotherspace");
  Assert.equal(rows.length, 1, "The tab is matched again in its own space");

  await UrlbarTestUtils.promisePopupClose(window);
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_folders_path_and_ranking() {
  const tab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const tab2 = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab2");
  const subfolder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
    label: "zenfold archive notes",
  });
  const parent = await gZenFolders.createFolder([tab2], {
    renameFolder: false,
    label: "zenfold",
  });
  parent.tabs[0].after(subfolder);
  await collectSidebarData();

  const rows = await searchSidebarRows("zenfold");
  Assert.equal(rows.length, 2, "Both folders are matched");
  for (const { result } of rows) {
    Assert.equal(result.type, UrlbarShared.RESULT_TYPE.DYNAMIC);
  }
  const [best, worst] = rows;
  const space = gZenWorkspaces.getWorkspaceFromId(
    gZenWorkspaces.activeWorkspace
  );
  Assert.equal(best.result.payload.zenFolderId, parent.id);
  Assert.equal(
    best.result.payload.path,
    [space.name, "zenfold"].join(" / "),
    "A root folder only shows its space and name"
  );
  Assert.equal(best.index, 1, "A full match sits right below the heuristic");
  Assert.equal(worst.result.payload.zenFolderId, subfolder.id);
  Assert.equal(
    worst.result.payload.path,
    [space.name, "zenfold", "zenfold archive notes"].join(" / "),
    "A subfolder shows every parent folder"
  );
  Assert.greater(
    worst.index,
    best.index,
    "The weaker the match, the further down the folder goes"
  );

  await UrlbarTestUtils.promisePopupClose(window);
  await removeFolder(subfolder);
  await removeFolder(parent);
});

add_task(async function test_picking_a_folder_reveals_it() {
  const tab = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab1");
  const tab2 = BrowserTestUtils.addTab(gBrowser, "data:text/html,tab2");
  const subfolder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
    label: "zenreveal",
  });
  const parent = await gZenFolders.createFolder([tab2], {
    renameFolder: false,
    label: "parent",
  });
  parent.tabs[0].after(subfolder);
  subfolder.collapsed = true;
  parent.collapsed = true;
  await collectSidebarData();

  const rows = await searchSidebarRows("zenreveal");
  Assert.equal(rows.length, 1, "The subfolder is matched");
  UrlbarTestUtils.setSelectedRowIndex(window, rows[0].index);
  await UrlbarTestUtils.promisePopupClose(window, () =>
    EventUtils.synthesizeKey("KEY_Enter")
  );

  await TestUtils.waitForCondition(
    () => !parent.collapsed && !subfolder.collapsed,
    "The folder and its parent get expanded"
  );

  await removeFolder(subfolder);
  await removeFolder(parent);
});
