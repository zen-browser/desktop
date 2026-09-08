/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_removeTabsToTheEnd_saves_tab_groups() {
  let win = await promiseNewWindowLoaded();
  let tab1 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let tab2 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let tab3 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");

  let tabGroup = win.gBrowser.addTabGroup([tab2, tab3], { insertBefore: tab2 });
  let tabGroupId = tabGroup.id;

  await TabStateFlusher.flushWindow(win);

  Assert.equal(
    win.gBrowser.tabs.length,
    4,
    "should be 4 tabs: 1 tab from new window and 3 tabs just created"
  );
  Assert.equal(
    SessionStore.getSavedTabGroups().length,
    0,
    "should not be any saved tab groups to start"
  );

  win.gBrowser.removeTabsToTheEndFrom(tab1);

  await TestUtils.waitForCondition(
    () => win.gBrowser.tabs.length == 2,
    "waiting for tabs to the end to close"
  );

  await TabStateFlusher.flushWindow(win);

  Assert.equal(
    SessionStore.getSavedTabGroups().length,
    1,
    "should have saved a tab group"
  );
  Assert.ok(
    SessionStore.getSavedTabGroup(tabGroupId),
    "should have saved the tab group that was closed"
  );

  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
  forgetSavedTabGroups();
});

add_task(
  async function test_removeTabsToTheEnd_only_saves_when_whole_tab_group_removed() {
    let win = await promiseNewWindowLoaded();
    let tab1 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
    let tab2 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
    BrowserTestUtils.addTab(win.gBrowser, "about:robots");

    let tabGroup = win.gBrowser.addTabGroup([tab1, tab2], {
      insertBefore: tab1,
    });

    await TabStateFlusher.flushWindow(win);

    Assert.equal(
      win.gBrowser.tabs.length,
      4,
      "should be 4 tabs: 1 tab from new window and 3 tabs just created"
    );
    Assert.equal(
      SessionStore.getSavedTabGroups().length,
      0,
      "should not be any saved tab groups to start"
    );

    win.gBrowser.removeTabsToTheEndFrom(tab1);

    await TestUtils.waitForCondition(
      () => win.gBrowser.tabs.length == 2,
      "waiting for tabs to the end to close"
    );

    await TabStateFlusher.flushWindow(win);

    Assert.equal(
      SessionStore.getSavedTabGroups().length,
      0,
      "should not have saved a tab group because one did not close"
    );
    Assert.deepEqual(
      win.gBrowser.tabGroups,
      [tabGroup],
      "tab group should still exist in the tab strip"
    );
    Assert.deepEqual(
      tabGroup.tabs,
      [tab1],
      "tab group should just have one tab left"
    );

    await win.gBrowser.removeTabGroup(tabGroup);
    await BrowserTestUtils.closeWindow(win);
    forgetClosedWindows();
    forgetSavedTabGroups();
  }
);
