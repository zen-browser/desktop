/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_restoreClosedTabGroupFromSameWindow() {
  let win = await promiseNewWindowLoaded();
  let aboutRobotsTab = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let aboutAboutTab = BrowserTestUtils.addTab(win.gBrowser, "about:about");
  const tabGroupToClose = win.gBrowser.addTabGroup(
    [aboutRobotsTab, aboutAboutTab],
    {
      color: "blue",
      label: "about pages",
    }
  );
  const tabGroupToCloseId = tabGroupToClose.id;

  await TabStateFlusher.flushWindow(win);

  Assert.equal(
    win.gBrowser.tabs.length,
    3,
    "there should be 2 new tabs + 1 initial tab from the new window"
  );

  let removePromise = BrowserTestUtils.waitForEvent(
    tabGroupToClose,
    "TabGroupRemoved"
  );
  win.gBrowser.removeTabGroup(tabGroupToClose);
  await removePromise;

  Assert.ok(
    !win.gBrowser.tabGroups.length,
    "closed tab group should not be in the tab strip"
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
  const restoredTabGroup = SessionStore.undoCloseTabGroup(
    win,
    tabGroupToCloseId,
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
    tabGroupToCloseId,
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
  forgetClosedWindows();
});
