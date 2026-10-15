/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_removeAllTabsBut_default_save_tab_groups() {
  let win = await promiseNewWindowLoaded();
  let tab1 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let tab2 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let tab3 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");

  let tabGroup = win.gBrowser.addTabGroup([tab2, tab3]);
  let tabGroupId = tabGroup.id;

  await TabStateFlusher.flushWindow(win);

  Assert.equal(
    SessionStore.getSavedTabGroups().length,
    0,
    "should not be any saved tab groups to start"
  );
  Assert.equal(
    SessionStore.getClosedTabGroups(win).length,
    0,
    "should not be any closed tab groups to start"
  );
  Assert.equal(
    SessionStore.getClosedTabDataForWindow(win).length,
    0,
    "should not be any closed tabs"
  );

  win.gBrowser.removeAllTabsBut(tab1);

  await TestUtils.waitForCondition(
    () => win.gBrowser.tabs.length == 1,
    "waiting for other tabs to close"
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
  Assert.equal(
    SessionStore.getClosedTabGroups(win).length,
    0,
    "should only have saved the tab group, not deleted it"
  );
  Assert.equal(
    SessionStore.getClosedTabDataForWindow(win).length,
    0,
    "should not be any closed tabs"
  );

  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
  forgetSavedTabGroups();
});

add_task(async function test_removeAllTabsBut_suppress_saving_tab_groups() {
  let win = await promiseNewWindowLoaded();
  let tab1 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let tab2 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let tab3 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");

  win.gBrowser.addTabGroup([tab2, tab3]);

  await TabStateFlusher.flushWindow(win);

  Assert.equal(
    SessionStore.getSavedTabGroups().length,
    0,
    "should not be any saved tab groups to start"
  );
  Assert.equal(
    SessionStore.getClosedTabGroups(win).length,
    0,
    "should not be any closed tab groups to start"
  );
  Assert.equal(
    SessionStore.getClosedTabDataForWindow(win).length,
    0,
    "should not be any closed tabs"
  );

  win.gBrowser.removeAllTabsBut(tab1, { skipSessionStore: true });

  await TestUtils.waitForCondition(
    () => win.gBrowser.tabs.length == 1,
    "waiting for other tabs to close"
  );

  await TabStateFlusher.flushWindow(win);

  Assert.equal(
    SessionStore.getSavedTabGroups().length,
    0,
    "should not have saved the tab group"
  );
  Assert.equal(
    SessionStore.getClosedTabGroups(win),
    0,
    "should still not have any deleted tab groups"
  );
  Assert.equal(
    SessionStore.getClosedTabDataForWindow(win).length,
    0,
    "should be 0 closed tabs"
  );

  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
  forgetSavedTabGroups();
});
