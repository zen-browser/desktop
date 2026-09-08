"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_SaveTabGroups() {
  let win = await promiseNewWindowLoaded();
  let state = ss.getCurrentState(win);
  Assert.equal(
    state.savedGroups.length,
    0,
    "savedGroups starts in initial state"
  );

  let tab1 = BrowserTestUtils.addTab(win.gBrowser, "about:mozilla?foo");
  await BrowserTestUtils.browserLoaded(tab1.linkedBrowser);
  await TabStateFlusher.flush(tab1.linkedBrowser);
  let group1 = win.gBrowser.addTabGroup([tab1]);
  ss.addSavedTabGroup(group1);

  let tab2 = BrowserTestUtils.addTab(win.gBrowser, "about:mozilla?bar");
  await BrowserTestUtils.browserLoaded(tab2.linkedBrowser);
  await TabStateFlusher.flush(tab2.linkedBrowser);
  let group2 = win.gBrowser.addTabGroup([tab2]);
  ss.addSavedTabGroup(group2);

  state = ss.getCurrentState();

  Assert.equal(state.savedGroups.length, 2, "savedGroups has 2 groups");
  Assert.equal(state.savedGroups[0].id, group1.id, "group1 is in savedGroups");
  Assert.equal(state.savedGroups[0].tabs.length, 1, "group1 has 1 tab");
  Assert.equal(state.savedGroups[1].id, group2.id, "group2 is in savedGroups");
  Assert.equal(state.savedGroups[1].tabs.length, 1, "group2 has 1 tab");

  ss.forgetSavedTabGroup(group1.id);
  await win.gBrowser.removeTabGroup(group1);
  state = ss.getCurrentState();

  Assert.equal(state.savedGroups.length, 1, "savedGroups has 1 group");
  Assert.equal(state.savedGroups[0].id, group2.id, "group2 is in savedGroups");
  Assert.equal(state.savedGroups[0].tabs.length, 1, "group2 still has 1 tab");

  ss.forgetSavedTabGroup(group2.id);
  await win.gBrowser.removeTabGroup(group2);
  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
});

/**
 * Newtabs with no history are considered unimportant and are ignored by
 * sessionstore. Groups of unimportant tabs should also be ignored.
 */
add_task(async function test_ignoreUnimportantTabGroups() {
  let win = await promiseNewWindowLoaded();
  let state = ss.getCurrentState(win);
  Assert.equal(state.savedGroups.length, 0, "savedGroups starts empty");

  let tab1 = BrowserTestUtils.addTab(win.gBrowser, "about:newtab");
  await BrowserTestUtils.browserLoaded(tab1.linkedBrowser);
  await TabStateFlusher.flush(tab1.linkedBrowser);
  let group1 = win.gBrowser.addTabGroup([tab1]);
  ss.addSavedTabGroup(group1);

  state = ss.getCurrentState();
  Assert.equal(state.savedGroups.length, 0, "savedGroups is still empty");

  await win.gBrowser.removeTabGroup(group1);
  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
});

add_task(async function test_refuseToSaveGroupsInPrivateWindows() {
  const privateWin = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });

  let tab = BrowserTestUtils.addTab(privateWin.gBrowser, "about:newtab");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await TabStateFlusher.flush(tab.linkedBrowser);
  let group = privateWin.gBrowser.addTabGroup([tab]);

  Assert.throws(
    () => {
      ss.addSavedTabGroup(group);
    },
    /Refusing to save tab group/,
    "addSavedTabGroup throws exception when trying to save a tab group from a private window"
  );
  await BrowserTestUtils.closeWindow(privateWin);
  forgetClosedWindows();
});
