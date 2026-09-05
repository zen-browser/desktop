"use strict";

/**
 * This test is for the sessionstore-closed-objects-changed notifications.
 */

requestLongerTimeout(2);

const MAX_WINDOWS_UNDO_PREF = "browser.sessionstore.max_windows_undo";
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
  // Create a closed window so that when we do the purge we know to expect a notification
  await openAndCloseWindow("about:robots");

  // Forget any previous closed windows or tabs from other tests that may have
  // run in the same session.
  await awaitNotification(() =>
    Services.obs.notifyObservers(null, "browser:purge-session-history")
  );

  // Add an observer to count the number of notifications.
  Services.obs.addObserver(countingObserver, TOPIC);

  info("Opening and closing initial window.");
  await openAndCloseWindow("about:robots");
  assertNotificationCount(1);

  // Store state with a single closed window for use in later tests.
  let closedState = Cu.cloneInto(JSON.parse(ss.getBrowserState()), {});

  info("Undoing close of initial window.");
  let win = SessionStore.undoCloseWindow(0);
  await promiseDelayedStartupFinished(win);
  assertNotificationCount(2);

  // Open a second window.
  let win2 = await openWindow("about:mozilla");

  info("Closing both windows.");
  await closeWindow(win);
  assertNotificationCount(3);
  await closeWindow(win2);
  assertNotificationCount(4);

  info(`Changing the ${MAX_WINDOWS_UNDO_PREF} pref.`);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref(MAX_WINDOWS_UNDO_PREF);
  });
  await awaitNotification(() =>
    Services.prefs.setIntPref(MAX_WINDOWS_UNDO_PREF, 1)
  );
  assertNotificationCount(5);

  info("Forgetting a closed window.");
  await awaitNotification(() => SessionStore.forgetClosedWindow());
  assertNotificationCount(6);

  info("Opening and closing another window.");
  await openAndCloseWindow("about:robots");
  assertNotificationCount(7);

  info("Setting browser state to trigger change onIdleDaily.");
  let state = Cu.cloneInto(JSON.parse(ss.getBrowserState()), {});
  state._closedWindows[0].closedAt = 1;
  await promiseBrowserState(state);
  assertNotificationCount(8);

  info("Sending idle-daily");
  await awaitNotification(() =>
    Services.obs.notifyObservers(null, "idle-daily")
  );
  assertNotificationCount(9);

  info("Opening and closing another window.");
  await openAndCloseWindow("about:robots");
  assertNotificationCount(10);

  info("Purging session history.");
  await awaitNotification(() =>
    Services.obs.notifyObservers(null, "browser:purge-session-history")
  );
  assertNotificationCount(11);

  info("Setting window state.");
  win = await openWindow("about:mozilla");
  await awaitNotification(() => SessionStore.setWindowState(win, closedState));
  assertNotificationCount(12);

  Services.obs.removeObserver(countingObserver, TOPIC);
  await BrowserTestUtils.closeWindow(win);
});
