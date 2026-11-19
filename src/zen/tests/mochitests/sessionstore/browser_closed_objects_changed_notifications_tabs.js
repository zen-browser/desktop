"use strict";

/**
 * This test is for the sessionstore-closed-objects-changed notifications.
 */

const MAX_TABS_UNDO_PREF = "browser.sessionstore.max_tabs_undo";
const TOPIC = "sessionstore-closed-objects-changed";

let notificationsCount = 0;

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
  await awaitNotification(() => BrowserTestUtils.closeWindow(win));
}

async function openAndCloseWindow(url) {
  let win = await openWindow(url);
  await closeWindow(win);
}

async function openTab(window, url) {
  let tab = await BrowserTestUtils.openNewForegroundTab(window.gBrowser, url);
  await TabStateFlusher.flush(tab.linkedBrowser);
  return tab;
}

async function openAndCloseTab(window, url) {
  let tab = await openTab(window, url);
  await promiseRemoveTabAndSessionState(tab);
}

function countingObserver() {
  notificationsCount++;
}

function assertNotificationCount(count) {
  is(
    notificationsCount,
    count,
    "The expected number of notifications was received."
  );
}

async function awaitNotification(callback) {
  let notification = TestUtils.topicObserved(TOPIC);
  executeSoon(callback);
  await notification;
}

add_task(async function test_closedObjectsChangedNotifications() {
  // Create a closed window so that when we do the purge we can expect a notification.
  await openAndCloseWindow("about:robots");

  // Forget any previous closed windows or tabs from other tests that may have
  // run in the same session.
  await awaitNotification(() =>
    Services.obs.notifyObservers(null, "browser:purge-session-history")
  );

  // Add an observer to count the number of notifications.
  Services.obs.addObserver(countingObserver, TOPIC);

  // Open a new window.
  let win = await openWindow("about:robots");

  info("Opening and closing a tab.");
  await openAndCloseTab(win, "about:mozilla");
  assertNotificationCount(1);

  info("Opening and closing a second tab.");
  await openAndCloseTab(win, "about:mozilla");
  assertNotificationCount(2);

  info(`Changing the ${MAX_TABS_UNDO_PREF} pref.`);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref(MAX_TABS_UNDO_PREF);
  });
  await awaitNotification(() =>
    Services.prefs.setIntPref(MAX_TABS_UNDO_PREF, 1)
  );
  assertNotificationCount(3);

  info("Undoing close of remaining closed tab.");
  let tab = SessionStore.undoCloseTab(win, 0);
  await promiseTabRestored(tab);
  assertNotificationCount(4);

  info("Closing tab again.");
  await promiseRemoveTabAndSessionState(tab);
  assertNotificationCount(5);

  info("Purging session history.");
  await awaitNotification(() =>
    Services.obs.notifyObservers(null, "browser:purge-session-history")
  );
  assertNotificationCount(6);

  info("Opening and closing another tab.");
  await openAndCloseTab(win, "http://example.com/");
  assertNotificationCount(7);

  info("Purging domain data with no matches.");
  Services.obs.notifyObservers(
    null,
    "browser:purge-session-history-for-domain",
    "mozilla.com"
  );
  assertNotificationCount(7);

  info("Purging domain data with matches.");
  await awaitNotification(() =>
    Services.obs.notifyObservers(
      null,
      "browser:purge-session-history-for-domain",
      "example.com"
    )
  );
  assertNotificationCount(8);

  info("Opening and closing another tab.");
  await openAndCloseTab(win, "http://example.com/");
  assertNotificationCount(9);

  await closeWindow(win);
  assertNotificationCount(10);

  Services.obs.removeObserver(countingObserver, TOPIC);
});
