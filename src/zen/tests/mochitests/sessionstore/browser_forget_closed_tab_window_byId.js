/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const TEST_URLS = [
  "http://mochi.test:8888/browser/",
  "https://www.example.com/",
  "https://example.net/",
  "https://example.org/",
];

let window1, privateWin;
let tab1, privateTab;

async function openTab(window, url) {
  let tab = BrowserTestUtils.addTab(window.gBrowser, url);
  await promiseBrowserLoaded(tab.linkedBrowser, true, url);
  return tab;
}

add_setup(async function testSetup() {
  // prepare some closed state
  window1 = await BrowserTestUtils.openNewBrowserWindow();
  await openAndCloseTab(window1, TEST_URLS[0]);
  // open another non-empty tab
  tab1 = await openTab(window1, TEST_URLS[1]);

  // open a private window
  privateWin = await BrowserTestUtils.openNewBrowserWindow({ private: true });
  // open another non-empty tab
  privateTab = await openTab(privateWin, TEST_URLS[2]);
  await openAndCloseTab(privateWin, TEST_URLS[3]);

  registerCleanupFunction(async () => {
    let windows = [];
    for (let win of BrowserWindowTracker.orderedWindows) {
      if (win != window) {
        windows.push(win);
      }
    }
    await Promise.all(windows.map(BrowserTestUtils.closeWindow));
    Services.obs.notifyObservers(null, "browser:purge-session-history");
  });
});

add_task(async function closeAndForgetTabs() {
  // sanity check recently-closed tab data
  Assert.equal(
    SessionStore.getClosedTabCount(window1),
    1,
    "Only one tab closed in non-private windows"
  );
  Assert.equal(
    SessionStore.getClosedTabCount(privateWin),
    1,
    "Only one tab closed in non-private windows"
  );

  // sanity check open tabs
  Assert.equal(window1.gBrowser.tabs.length, 2, "Expected number of tabs open");
  Assert.equal(
    privateWin.gBrowser.tabs.length,
    2,
    "Expected number of tabs open"
  );

  let closedTabs = SessionStore.getClosedTabData(window1); // only non-private closed tabs
  Assert.equal(typeof closedTabs[0].closedId, "number", "closedId is a number");
  let sessionStoreUpdated = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  SessionStore.forgetClosedTabById(closedTabs[0].closedId);
  await sessionStoreUpdated;
  Assert.equal(
    SessionStore.getClosedTabCount(window1),
    0,
    "There's no more records of closed tabs"
  );

  closedTabs = SessionStore.getClosedTabData(privateWin); // only private closed tabs
  Assert.equal(typeof closedTabs[0].closedId, "number", "closedId is a number");

  Assert.throws(
    () => {
      SessionStore.forgetClosedTabById(closedTabs[0].closedId, {
        includePrivate: false,
      });
    },
    /Invalid closedId/,
    "forgetClosedWindowById should throw an exception when trying to match a closedId from a private window in non-private windows"
  );

  Assert.equal(
    SessionStore.getClosedTabCount(privateWin),
    1,
    "Still one tab closed in non-private windows"
  );

  sessionStoreUpdated = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  SessionStore.forgetClosedTabById(closedTabs[0].closedId);
  await sessionStoreUpdated;
  Assert.equal(
    SessionStore.getClosedTabCount(privateWin),
    0,
    "There's no more records of private closed tabs"
  );
});

add_task(async function closeAndForgetTabsFromTabGroups() {
  const newWin = await BrowserTestUtils.openNewBrowserWindow();

  // sanity check recently-closed tab data
  Assert.equal(SessionStore.getClosedTabCount(newWin), 0, "No tabs closed");

  let groupedTab = await openTab(newWin, TEST_URLS[1]);
  let group = newWin.gBrowser.addTabGroup([groupedTab]);
  let removePromise = BrowserTestUtils.waitForEvent(group, "TabGroupRemoved");
  newWin.gBrowser.removeTabGroup(group);
  await removePromise;
  await TabStateFlusher.flushWindow(newWin);

  await TestUtils.waitForCondition(() => {
    return SessionStore.getClosedTabCount(newWin) == 1;
  }, "Grouped tab is closed");

  let closedTabs = SessionStore.getClosedTabData(newWin);
  let sessionStoreUpdated = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  SessionStore.forgetClosedTabById(closedTabs[0].closedId);
  await sessionStoreUpdated;

  Assert.equal(
    SessionStore.getClosedTabCount(newWin),
    0,
    "Grouped tab was forgotten"
  );
});

add_task(async function closeAndForgetWindows() {
  let closedWindows;
  await BrowserTestUtils.closeWindow(window1);
  closedWindows = SessionStore.getClosedWindowData();
  Assert.equal(
    closedWindows.length,
    1,
    "There's one record for closed windows"
  );

  let sessionStoreUpdated = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  let closedWindowId = closedWindows[0].closedId;
  SessionStore.forgetClosedWindowById(closedWindowId);
  await sessionStoreUpdated;
  Assert.equal(
    SessionStore.getClosedWindowCount(),
    0,
    "There's no more records of closed windows"
  );

  await BrowserTestUtils.closeWindow(privateWin);
  await TestUtils.waitForTick();
  Assert.equal(
    SessionStore.getClosedWindowCount(),
    0,
    "Closing the private window didn't add a closed window entry"
  );
  // check a non-matching closedId throws an exception
  Assert.throws(
    () => {
      SessionStore.forgetClosedWindowById(closedWindowId);
    },
    /Invalid closedId/,
    "forgetClosedWindowById should throw an exception when given an closedId that doesnt match any closed window"
  );
});
