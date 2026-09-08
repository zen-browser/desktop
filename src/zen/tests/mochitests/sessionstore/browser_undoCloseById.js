/* eslint-disable mozilla/no-arbitrary-setTimeout */
"use strict";

/**
 * This test is for the undoCloseById function.
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
  await BrowserTestUtils.closeWindow(win);
  // Wait 20 ms to allow SessionStorage a chance to register the closed window.
  await new Promise(resolve => setTimeout(resolve, 20));
}

function getLastClosedTabData(win) {
  const closedTabs = SessionStore.getClosedTabData(win);
  return closedTabs[closedTabs.length - 1];
}

add_task(async function test_undoCloseById() {
  // Clear the lists of closed windows and tabs.
  forgetClosedWindows();
  for (const win of SessionStore.getWindows()) {
    while (SessionStore.getClosedTabCountForWindow(win)) {
      SessionStore.forgetClosedTab(win, 0);
    }
  }
  SessionStore.resetNextClosedId();

  // Open a new window.
  let win = await openWindow("about:robots");

  // Open and close a tab.
  await openAndCloseTab(win, "about:mozilla");
  is(
    SessionStore.lastClosedObjectType,
    "tab",
    "The last closed object is a tab"
  );

  // Record the first closedId created.
  is(1, SessionStore.getClosedTabCount(), "We have 1 closed tab");
  let initialClosedId = SessionStore.getClosedTabDataForWindow(win)[0].closedId;

  // Open and close another window.
  let win2 = await openWindow("about:mozilla");
  await closeWindow(win2); // closedId == initialClosedId + 1
  is(
    SessionStore.lastClosedObjectType,
    "window",
    "The last closed object is a window"
  );

  // Open and close another tab in the first window.
  await openAndCloseTab(win, "about:robots"); // closedId == initialClosedId + 2
  is(
    SessionStore.lastClosedObjectType,
    "tab",
    "The last closed object is a tab"
  );

  // Undo closing the second tab.
  let tab = SessionStore.undoCloseById(initialClosedId + 2);
  await promiseBrowserLoaded(tab.linkedBrowser);
  is(
    tab.linkedBrowser.currentURI.spec,
    "about:robots",
    "The expected tab was re-opened"
  );

  let notTab = SessionStore.undoCloseById(initialClosedId + 2);
  is(notTab, undefined, "Re-opened tab cannot be unClosed again by closedId");

  // Now the last closed object should be a window again.
  is(
    SessionStore.lastClosedObjectType,
    "window",
    "The last closed object is a window"
  );

  // Undo closing the first tab.
  let tab2 = SessionStore.undoCloseById(initialClosedId);
  await promiseBrowserLoaded(tab2.linkedBrowser);
  is(
    tab2.linkedBrowser.currentURI.spec,
    "about:mozilla",
    "The expected tab was re-opened"
  );

  // Close the two tabs we re-opened.
  await promiseRemoveTabAndSessionState(tab); // closedId == initialClosedId + 3
  is(
    SessionStore.lastClosedObjectType,
    "tab",
    "The last closed object is a tab"
  );
  await promiseRemoveTabAndSessionState(tab2); // closedId == initialClosedId + 4
  is(
    SessionStore.lastClosedObjectType,
    "tab",
    "The last closed object is a tab"
  );

  // Open another new window.
  let win3 = await openWindow("about:mozilla");

  // Close both windows.
  await closeWindow(win); // closedId == initialClosedId + 5
  is(
    SessionStore.lastClosedObjectType,
    "window",
    "The last closed object is a window"
  );
  await closeWindow(win3); // closedId == initialClosedId + 6
  is(
    SessionStore.lastClosedObjectType,
    "window",
    "The last closed object is a window"
  );

  // Undo closing the second window.
  win = SessionStore.undoCloseById(initialClosedId + 6);
  await BrowserTestUtils.waitForEvent(win, "load");

  // Make sure we wait until this window is restored.
  await BrowserTestUtils.waitForEvent(
    win.gBrowser.tabContainer,
    "SSTabRestored"
  );

  is(
    win.gBrowser.selectedBrowser.currentURI.spec,
    "about:mozilla",
    "The expected window was re-opened"
  );

  let notWin = SessionStore.undoCloseById(initialClosedId + 6);
  is(
    notWin,
    undefined,
    "Re-opened window cannot be unClosed again by closedId"
  );

  // Close the window again.
  await closeWindow(win);
  is(
    SessionStore.lastClosedObjectType,
    "window",
    "The last closed object is a window"
  );

  // Undo closing the first window.
  win = SessionStore.undoCloseById(initialClosedId + 5);

  await BrowserTestUtils.waitForEvent(win, "load");

  // Make sure we wait until this window is restored.
  await BrowserTestUtils.waitForEvent(
    win.gBrowser.tabContainer,
    "SSTabRestored"
  );

  is(
    win.gBrowser.selectedBrowser.currentURI.spec,
    "about:robots",
    "The expected window was re-opened"
  );

  // Close the window again.
  await closeWindow(win);
  is(
    SessionStore.lastClosedObjectType,
    "window",
    "The last closed object is a window"
  );
});
