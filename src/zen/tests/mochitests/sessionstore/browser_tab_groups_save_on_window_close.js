/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

forgetClosedWindows();
forgetSavedTabGroups();

add_task(async function test_saveOpenTabGroupsOnWindowClose() {
  Assert.equal(
    ss.getSavedTabGroups().length,
    0,
    "should start with no saved tab groups"
  );
  Assert.equal(
    ss.getClosedWindowData().length,
    0,
    "should start with no closed windows"
  );

  info("open a new window with 1 standalone tab and 2 tabs in a tab group");
  let win = await promiseNewWindowLoaded();
  let aboutMozillaTab = BrowserTestUtils.addTab(win.gBrowser, "about:mozilla");
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
  await Promise.all([
    BrowserTestUtils.browserLoaded(
      aboutMozillaTab.linkedBrowser,
      false,
      "about:mozilla"
    ),
    BrowserTestUtils.browserLoaded(
      aboutRobotsTab.linkedBrowser,
      false,
      "about:robots"
    ),
    BrowserTestUtils.browserLoaded(
      aboutAboutTab.linkedBrowser,
      false,
      "about:about"
    ),
  ]);

  await TabStateFlusher.flushWindow(win);

  info("close the window to make sure the tab group gets saved automatically");
  await BrowserTestUtils.closeWindow(win);

  const closedWindowData = SessionStore.getClosedWindowData();
  Assert.equal(closedWindowData.length, 1, "`win` should now be closed");
  Assert.equal(
    closedWindowData[0].groups.length,
    1,
    "should be one tab group in the closed window"
  );
  const tabGroupInClosedWindow = closedWindowData[0].groups[0];
  Assert.equal(
    tabGroupInClosedWindow.id,
    tabGroupToCloseId,
    "closed window tab group should be the one that was in the window"
  );
  Assert.equal(ss.getSavedTabGroups().length, 1, "should be 1 saved tab group");
  Assert.equal(
    ss.getSavedTabGroup(tabGroupToCloseId).id,
    tabGroupInClosedWindow.id,
    "saved tab group should be the same as the tab group in the closed window"
  );

  info(
    "reopen the closed window to make sure that the tab group reopens in the window and is no longer saved"
  );
  win = SessionStore.undoCloseWindow(0);
  await BrowserTestUtils.waitForEvent(win, "SSWindowStateReady");
  await BrowserTestUtils.waitForEvent(
    win.gBrowser.tabContainer,
    "SSTabRestored"
  );

  Assert.equal(
    win.gBrowser.tabGroups.length,
    1,
    "tab group should have been restored"
  );
  Assert.equal(
    win.gBrowser.tabGroups[0].id,
    tabGroupToCloseId,
    "restored tab group should be the one from the closed window"
  );
  Assert.equal(
    ss.getSavedTabGroups().length,
    0,
    "saved tab group should no longer be saved because it should be restored into the reopened window"
  );
  Assert.equal(
    ss.getClosedWindowData().length,
    0,
    "the closed window should have been reopened"
  );

  await TabStateFlusher.flushWindow(win);

  info("close the window again");
  await BrowserTestUtils.closeWindow(win);

  Assert.equal(
    ss.getClosedWindowData()[0].tabs.length,
    4,
    "re-closed window should have 1 new tab from the new window, 1 standalone tab, and 2 tabs in the tab group"
  );
  Assert.equal(
    ss.getClosedWindowData()[0].groups.length,
    1,
    "tab group should still be in the closed window"
  );

  info(
    "open the saved tab group into a different window, which should remove it from the closed window"
  );
  let savedGroupReopened = BrowserTestUtils.waitForEvent(
    window,
    "SSWindowStateReady"
  );
  await SessionStore.openSavedTabGroup(tabGroupToCloseId, window);
  await savedGroupReopened;

  await TabStateFlusher.flushWindow(window);

  Assert.equal(
    ss.getClosedWindowData()[0].tabs.length,
    2,
    "re-closed window should now just have 1 new tab from the new window and 1 standalone tab"
  );
  Assert.equal(
    ss.getClosedWindowData()[0].groups.length,
    0,
    "re-closed window should no longer have tab groups because we opened the saved group into a different window"
  );
  Assert.equal(
    ss.getSavedTabGroups().length,
    0,
    "saved tab group should no longer be saved because it should be restored into the main window"
  );

  info(
    "reopen the closed window, which should no longer have the saved tab group in it since it moved into a different window"
  );
  win = SessionStore.undoCloseWindow(0);
  await BrowserTestUtils.waitForEvent(win, "SSWindowStateReady");
  await BrowserTestUtils.waitForEvent(
    win.gBrowser.tabContainer,
    "SSTabRestored"
  );

  Assert.equal(
    win.gBrowser.openTabs.length,
    2,
    "the re-restored window should have 1 new tab and 1 standalone tab"
  );
  Assert.equal(
    win.gBrowser.tabGroups.length,
    0,
    "the re-restored window should have no tab group"
  );

  info(
    "move the tab group back into the window that we've been opening + closing"
  );
  let savedTabGroup = window.gBrowser.tabGroups[0];
  let savedTabRemoval = BrowserTestUtils.waitForEvent(
    savedTabGroup,
    "TabGroupRemoved"
  );
  win.gBrowser.adoptTabGroup(window.gBrowser.tabGroups[0], { elementIndex: 2 });
  await savedTabRemoval;

  Assert.equal(
    win.gBrowser.openTabs.length,
    4,
    "the re-restored window should have the tab group again after adopting it"
  );

  await TabStateFlusher.flushWindow(win);

  info(
    "close the window and forget it to make sure that the tab group will still be saved even if we forget about the closed window"
  );
  await BrowserTestUtils.closeWindow(win);
  ss.forgetClosedWindow(0);

  Assert.equal(
    ss.getClosedWindowData().length,
    0,
    "the closed window should have been forgotten"
  );
  Assert.equal(
    ss.getSavedTabGroups().length,
    1,
    "but the automatically saved tab group that was in the closed window should remain saved"
  );

  forgetClosedWindows();
  forgetSavedTabGroups();
});

/**
 * A closing window should not save its tab group if the window was closed
 * in response to moving that tab group
 */
add_task(async function test_dontSaveAfterAdoptingGroup() {
  let win = await promiseNewWindowLoaded();
  let state = ss.getCurrentState();
  Assert.ok(!state.savedGroups.length, "savedGroups starts empty");

  let tab1 = BrowserTestUtils.addTab(win.gBrowser, "about:mozilla");
  await BrowserTestUtils.browserLoaded(tab1.linkedBrowser);
  await TabStateFlusher.flush(tab1.linkedBrowser);
  let group1 = win.gBrowser.addTabGroup([tab1]);
  await BrowserTestUtils.removeTab(win.gBrowser.tabs[0]);
  let windowUnloaded = BrowserTestUtils.waitForEvent(win, "unload");
  gBrowser.adoptTabGroup(group1);
  await windowUnloaded;
  state = ss.getCurrentState();
  Assert.ok(!state.savedGroups.length, "savedGroups is still empty");
});

add_task(async function test_dontSaveAfterDeletingLastGroupInWindow() {
  let win = await promiseNewWindowLoaded();
  let state = ss.getCurrentState();
  Assert.ok(!state.savedGroups.length, "savedGroups starts empty");
  let tab1 = BrowserTestUtils.addTab(win.gBrowser, "about:mozilla");
  await BrowserTestUtils.browserLoaded(tab1.linkedBrowser);
  await TabStateFlusher.flush(tab1.linkedBrowser);
  let group1 = win.gBrowser.addTabGroup([tab1]);
  await BrowserTestUtils.removeTab(win.gBrowser.tabs[0]);
  let windowUnloaded = BrowserTestUtils.waitForEvent(win, "unload");
  win.gBrowser.removeTabGroup(group1);
  await windowUnloaded;
  state = ss.getCurrentState();
  Assert.ok(!state.savedGroups.length, "savedGroups is still empty");
});
