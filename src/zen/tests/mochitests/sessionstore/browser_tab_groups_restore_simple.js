"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_RestoreSingleGroup() {
  let win = await promiseNewWindowLoaded();
  let aboutRobotsTab = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let aboutAboutTab = BrowserTestUtils.addTab(win.gBrowser, "about:about");
  const { id: originalTabGroupId } = win.gBrowser.addTabGroup(
    [aboutRobotsTab, aboutAboutTab],
    {
      color: "blue",
      label: "about pages",
    }
  );

  await TabStateFlusher.flushWindow(win);
  await BrowserTestUtils.closeWindow(win);

  // Now restore the window
  win = SessionStore.undoCloseWindow(0);
  await BrowserTestUtils.waitForEvent(win, "SSWindowStateReady");
  await BrowserTestUtils.waitForEvent(
    win.gBrowser.tabContainer,
    "SSTabRestored"
  );

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

  let tabGroup = win.gBrowser.tabGroups[0];
  Assert.equal(
    tabGroup.tabs.length,
    2,
    "the 2 restored tabs should be in the restored tab group"
  );
  Assert.equal(
    tabGroup.label,
    "about pages",
    "tab group name should be restored"
  );
  Assert.equal(
    tabGroup.id,
    originalTabGroupId,
    "tab group ID should be restored"
  );
  Assert.equal(tabGroup.color, "blue", "tab group color should be restored");
  Assert.ok(
    !tabGroup.collapsed,
    "tab group collapsed state should be restored"
  );

  await win.gBrowser.removeTabGroup(tabGroup);
  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
});
