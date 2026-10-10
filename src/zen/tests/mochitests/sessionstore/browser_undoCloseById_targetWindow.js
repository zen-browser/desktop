"use strict";

/**
 * This test verifies SessionStore.undoCloseById behavior when passed the targetWindow argument
 */

async function openWindow(url) {
  let win = await promiseNewWindowLoaded();
  let flags = Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY;
  BrowserTestUtils.startLoadingURIString(win.gBrowser.selectedBrowser, url, {
    flags,
  });
  await promiseBrowserLoaded(win.gBrowser.selectedBrowser, true, url);
  return win;
}

async function closeWindow(win) {
  TestUtils.waitForTick();
  let sessionStoreUpdated = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  await BrowserTestUtils.closeWindow(win);
  await sessionStoreUpdated;
}

function forgetTabsAndWindows() {
  // Clear the lists of closed windows and tabs.
  forgetClosedWindows();
  while (SessionStore.getClosedTabCount(window)) {
    SessionStore.forgetClosedTab(window, 0);
  }
}

add_task(async function test_undoCloseById_with_targetWindow() {
  forgetTabsAndWindows();
  // Test that a tab closed in (currently open) window B, will correctly be opened in target window A.
  // And that the closed record should be correctly removed from window B
  const winA = window;
  // Open a new window.
  const winB = await openWindow("about:robots");
  await SimpleTest.promiseFocus(winB);
  // Open and close a tab in the 2nd window
  await openAndCloseTab(winB, "about:mozilla");
  is(
    SessionStore.lastClosedObjectType,
    "tab",
    "The last closed object is a tab"
  );
  // Record the first closedId created.
  const closedId = SessionStore.getClosedTabData(winB)[0].closedId;
  let tabRestored = BrowserTestUtils.waitForNewTab(
    winA.gBrowser,
    "about:mozilla"
  );

  // Restore the tab into the first window, not the window it was closed in
  SessionStore.undoCloseById(closedId, undefined, winA);
  await tabRestored;
  is(winA.gBrowser.selectedBrowser.currentURI.spec, "about:mozilla");

  // Verify the closed tab data is removed from the source window
  is(
    SessionStore.getClosedTabData(winB).length,
    0,
    "Record removed from the source window's closed tab data"
  );

  BrowserTestUtils.removeTab(winA.gBrowser.selectedTab);
  await closeWindow(winB);
});

add_task(async function test_undoCloseById_with_nonExistent_targetWindow() {
  // Test that restoring a tab to a non-existent targetWindow throws
  forgetTabsAndWindows();
  await openAndCloseTab(window, "about:mozilla");
  is(
    SessionStore.lastClosedObjectType,
    "tab",
    "The last closed object is a tab"
  );
  // Record the first closedId created.
  const closedId = SessionStore.getClosedTabData(window)[0].closedId;

  // get a reference to a window that will be closed
  const newWin = await BrowserTestUtils.openNewBrowserWindow();
  await SimpleTest.promiseFocus(newWin);
  await BrowserTestUtils.closeWindow(newWin);

  // Expect an exception trying to restore a tab to a non-existent window
  Assert.throws(() => {
    SessionStore.undoCloseById(closedId, undefined, newWin);
  }, /NS_ERROR_ILLEGAL_VALUE/);
});
