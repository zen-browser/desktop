/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_restoreSavedTabGroupToSameWindow() {
  let win = await promiseNewWindowLoaded();
  let aboutRobotsTab = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let aboutAboutTab = BrowserTestUtils.addTab(win.gBrowser, "about:about");
  const tabGroupToSave = win.gBrowser.addTabGroup(
    [aboutRobotsTab, aboutAboutTab],
    {
      color: "blue",
      label: "about pages",
    }
  );
  const tabGroupToSaveId = tabGroupToSave.id;

  await TabStateFlusher.flushWindow(win);

  tabGroupToSave.save();
  let removePromise = BrowserTestUtils.waitForEvent(
    tabGroupToSave,
    "TabGroupRemoved"
  );
  win.gBrowser.removeTabGroup(tabGroupToSave);
  await removePromise;

  Assert.ok(
    !win.gBrowser.tabGroups.length,
    "saved tab group should not be in the tab strip"
  );
  Assert.ok(
    !win.gBrowser.tabs.includes(aboutRobotsTab),
    "about:robots tab should not be in the tab strip"
  );
  Assert.ok(
    !win.gBrowser.tabs.includes(aboutAboutTab),
    "about:about tab should not be in the tab strip"
  );

  await TabStateFlusher.flushWindow(win);

  let restorePromise = BrowserTestUtils.waitForEvent(win, "SSWindowStateReady");
  const restoredTabGroup = SessionStore.openSavedTabGroup(
    tabGroupToSaveId,
    win
  );
  await restorePromise;

  Assert.equal(
    win.gBrowser.tabs.length,
    3,
    "there should be 2 tabs restored + 1 initial tab from the new window"
  );
  Assert.equal(
    win.gBrowser.tabGroups.length,
    1,
    "there should be 1 tab group restored"
  );
  Assert.equal(
    win.gBrowser.selectedTab,
    restoredTabGroup.tabs[0],
    "first tab of the group is selected"
  );
  Assert.equal(
    restoredTabGroup.tabs.length,
    2,
    "the 2 restored tabs should be in the restored tab group"
  );
  Assert.equal(
    restoredTabGroup.label,
    "about pages",
    "tab group name should be restored"
  );
  Assert.equal(
    restoredTabGroup.id,
    tabGroupToSaveId,
    "tab group ID should be restored"
  );
  Assert.equal(
    restoredTabGroup.color,
    "blue",
    "tab group color should be restored"
  );
  Assert.ok(
    !restoredTabGroup.collapsed,
    "tab group collapsed state should be restored"
  );

  await BrowserTestUtils.closeWindow(win);
  forgetSavedTabGroups();
});

add_task(async function test_restoreSavedTabGroupToAnotherWindow() {
  let win = await promiseNewWindowLoaded();
  let aboutRobotsTab = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let aboutAboutTab = BrowserTestUtils.addTab(win.gBrowser, "about:about");
  const tabGroupToSave = win.gBrowser.addTabGroup(
    [aboutRobotsTab, aboutAboutTab],
    {
      color: "blue",
      label: "about pages",
    }
  );
  const tabGroupToSaveId = tabGroupToSave.id;

  await Promise.allSettled([
    TabStateFlusher.flush(aboutRobotsTab.linkedBrowser),
    TabStateFlusher.flush(aboutAboutTab.linkedBrowser),
  ]);
  tabGroupToSave.save();

  await TabStateFlusher.flushWindow(win);

  let removePromise = BrowserTestUtils.waitForEvent(
    tabGroupToSave,
    "TabGroupRemoved"
  );
  win.gBrowser.removeTabGroup(tabGroupToSave);
  await removePromise;

  await TabStateFlusher.flushWindow(win);

  let win2 = await promiseNewWindowLoaded();

  let restorePromise = BrowserTestUtils.waitForEvent(
    win2,
    "SSWindowStateReady"
  );
  const restoredTabGroup = SessionStore.openSavedTabGroup(
    tabGroupToSaveId,
    win2
  );
  await restorePromise;

  Assert.equal(
    win2.gBrowser.tabs.length,
    3,
    "there should be 2 tabs restored + 1 initial tab from the new window"
  );
  Assert.equal(
    win2.gBrowser.tabGroups.length,
    1,
    "there should be 1 tab group restored"
  );

  Assert.equal(
    restoredTabGroup.tabs.length,
    2,
    "the 2 restored tabs should be in the restored tab group"
  );
  Assert.equal(
    restoredTabGroup.label,
    "about pages",
    "tab group name should be restored"
  );
  Assert.equal(
    restoredTabGroup.id,
    tabGroupToSaveId,
    "tab group ID should be restored"
  );
  Assert.equal(
    restoredTabGroup.color,
    "blue",
    "tab group color should be restored"
  );
  Assert.ok(
    !restoredTabGroup.collapsed,
    "tab group collapsed state should be restored"
  );

  await BrowserTestUtils.closeWindow(win2);
  await BrowserTestUtils.closeWindow(win);
  forgetSavedTabGroups();
  forgetClosedWindows();
});
