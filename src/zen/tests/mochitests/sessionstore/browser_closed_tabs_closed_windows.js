/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const { TelemetryTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/TelemetryTestUtils.sys.mjs"
);
const TEST_URLS = [
  "http://mochi.test:8888/browser/",
  "https://www.example.com/",
  "https://example.net/",
  "https://example.org/",
  "about:mozilla",
  "about:robots",
];
const TOPIC_CLOSED_OBJECTS_CHANGED = "sessionstore-closed-objects-changed";
var preparedClosedIds;

add_setup(async function testSetup() {
  registerCleanupFunction(async () => {
    await promiseAllButPrimaryWindowClosed();
    Services.obs.notifyObservers(null, "browser:purge-session-history");
  });
  preparedClosedIds = await prepareClosedData();
  SimpleTest.promiseFocus(window);
});

async function prepareClosedData() {
  // prepare some closed state
  let closedIds = {};
  await openAndCloseTab(window, TEST_URLS[0]);
  closedIds.tab0 = SessionStore.getClosedTabDataForWindow(window)[0].closedId;

  const testWindow1 = await BrowserTestUtils.openNewBrowserWindow();
  // open a non-transitory, worth-keeping tab to ensure window data is saved on close
  await BrowserTestUtils.openNewForegroundTab(
    testWindow1.gBrowser,
    "about:mozilla"
  );
  await openAndCloseTab(testWindow1, TEST_URLS[1]);
  closedIds.tab1 =
    SessionStore.getClosedTabDataForWindow(testWindow1)[0].closedId;

  const testWindow2 = await BrowserTestUtils.openNewBrowserWindow();
  // open a non-transitory, worth-keeping tab to ensure window data is saved on close
  await BrowserTestUtils.openNewForegroundTab(
    testWindow2.gBrowser,
    "about:mozilla"
  );
  await openAndCloseTab(testWindow2, TEST_URLS[2]);
  closedIds.tab2 =
    SessionStore.getClosedTabDataForWindow(testWindow2)[0].closedId;
  await openAndCloseTab(testWindow2, TEST_URLS[3]);
  closedIds.tab3 =
    SessionStore.getClosedTabDataForWindow(testWindow2)[0].closedId;

  const testWindow3 = await BrowserTestUtils.openNewBrowserWindow();
  // open a non-transitory, worth-keeping tab to ensure window data is saved on close
  await BrowserTestUtils.openNewForegroundTab(
    testWindow3.gBrowser,
    "about:mozilla"
  );
  await openAndCloseTab(testWindow3, TEST_URLS[4]);
  closedIds.tab4 =
    SessionStore.getClosedTabDataForWindow(testWindow3)[0].closedId;

  // open a private window
  const privateWin = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  // open a non-transitory, worth-keeping tab to ensure window data is saved on close
  await BrowserTestUtils.openNewForegroundTab(
    privateWin.gBrowser,
    "about:mozilla"
  );
  await openAndCloseTab(privateWin, TEST_URLS[5]);
  closedIds.tab5 =
    SessionStore.getClosedTabDataForWindow(privateWin)[0].closedId;

  const testWindow6 = await BrowserTestUtils.openNewBrowserWindow();

  const testWindow7 = await BrowserTestUtils.openNewBrowserWindow();
  await openAndCloseTab(testWindow7, TEST_URLS[4]);

  await BrowserTestUtils.closeWindow(testWindow1);
  closedIds.testWindow1 = SessionStore.getClosedWindowData()[0].closedId;
  await BrowserTestUtils.closeWindow(testWindow2);

  closedIds.testWindow2 = SessionStore.getClosedWindowData()[0].closedId;
  await BrowserTestUtils.closeWindow(testWindow3);

  closedIds.testWindow3 = SessionStore.getClosedWindowData()[0].closedId;
  await BrowserTestUtils.closeWindow(privateWin);
  Assert.greater(
    closedIds.testWindow2,
    closedIds.testWindow1,
    "We got the closedIds in the expected order"
  );

  await BrowserTestUtils.closeWindow(testWindow6);
  await BrowserTestUtils.closeWindow(testWindow7);
  return closedIds;
}

// The tasks need to be run sequentially. They are broken up so the different functions
// under test and any stack traces are easier to find

add_task(async function get_closed_tabs_from_closed_windows() {
  Assert.equal(
    SessionStore.getClosedTabCount({ closedTabsFromClosedWindows: false }),
    1,
    "Expected closed tab count (in currently-open windows only)"
  );
  Assert.equal(
    SessionStore.getClosedTabCount(),
    5,
    "Expected closed tab count (in currently-open and closed windows)"
  );
  // We dont keep the closed tab from the private window
  Assert.equal(
    SessionStore.getClosedTabCountFromClosedWindows(),
    4,
    "Expected closed tab count (from closed windows)"
  );

  // Closed tabs from closed windows aren't included in the list from getClosedTabData()
  Assert.deepEqual(
    SessionStore.getClosedTabData().map(td => td.state.entries[0].url),
    ["http://mochi.test:8888/browser/"],
    "Matched closed tab data from currently open windows"
  );

  // Closed tabs from open windows or closed private windows aren't included in the list
  // from getClosedTabDataFromClosedWindows()
  Assert.deepEqual(
    SessionStore.getClosedTabDataFromClosedWindows().map(
      td => td.state.entries[0].url
    ),
    [
      "about:mozilla",
      "https://example.org/",
      "https://example.net/",
      "https://www.example.com/",
    ],
    "Matched closed tab data from currently closed windows"
  );
});

add_task(async function forget_closed_tabs_from_closed_windows() {
  // forget the most recent tab we closed in testWindow1
  let closedObjectsChanged = TestUtils.topicObserved(
    TOPIC_CLOSED_OBJECTS_CHANGED
  );
  info(
    "Calling forgetClosedTab with window sourceClosedId: " +
      preparedClosedIds.testWindow1
  );
  SessionStore.forgetClosedTab(
    { sourceClosedId: preparedClosedIds.testWindow1 },
    0
  );
  await closedObjectsChanged;
  Assert.deepEqual(
    SessionStore.getClosedTabDataFromClosedWindows().map(
      td => td.state.entries[0].url
    ),
    [
      "about:mozilla",
      "https://example.org/",
      "https://example.net/",
      // "https://www.example.com/" from testWindow1 was forgotten and should be removed
    ],
    "Closed tab forgotten"
  );

  // forget a closed window that had closed tabs
  let closedTabCount = SessionStore.getClosedTabCountFromClosedWindows();
  closedObjectsChanged = TestUtils.topicObserved(TOPIC_CLOSED_OBJECTS_CHANGED);
  SessionStore.forgetClosedWindowById(preparedClosedIds.testWindow3);
  await closedObjectsChanged;
  Assert.equal(
    SessionStore.getClosedTabCountFromClosedWindows(),
    closedTabCount - 1,
    "The closed tab is gone when we forget the closed window it was in"
  );
});

add_task(async function expected_exceptions_closed_tabs_from_closed_windows() {
  // testWindow3 was forgotten, attempting to undoClose its tabs should throw
  Assert.throws(
    () =>
      SessionStore.undoClosedTabFromClosedWindow(
        { sourceClosedId: preparedClosedIds.testWindow3 },
        preparedClosedIds.tab4
      ),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window or source for undoClosedTabFromClosedWindow throws"
  );
  // tab1 was forgotten, attempting to undoClose it should throw
  Assert.throws(
    () =>
      SessionStore.undoClosedTabFromClosedWindow(
        { sourceClosedId: preparedClosedIds.testWindow1 },
        preparedClosedIds.tab1
      ),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid tab closedId for undoClosedTabFromClosedWindow throws"
  );

  // testWindow3 was forgotten, attempting to forget its tabs should throw
  Assert.throws(
    () =>
      SessionStore.forgetClosedTab(
        { sourceClosedId: preparedClosedIds.testWindow3 },
        preparedClosedIds.tab4
      ),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window or source for forgetClosedTab throws"
  );

  // tab1 was forgotten, attempting to forget it again should throw
  Assert.throws(
    () =>
      SessionStore.undoClosedTabFromClosedWindow(
        { sourceClosedId: preparedClosedIds.testWindow3 },
        preparedClosedIds.tab4
      ),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window for undoClosedTabFromClosedWindow throws"
  );
});

add_task(async function undo_closed_tabs_from_closed_windows() {
  const openTabsCount = gBrowser.tabs.length;

  // undo most recently closed tab from a closed window using a window closedId
  let closedObjectsChanged = TestUtils.topicObserved(
    TOPIC_CLOSED_OBJECTS_CHANGED
  );
  let restoredTab1 = SessionStore.undoCloseTab(
    { sourceClosedId: preparedClosedIds.testWindow2 },
    0,
    window
  );
  await BrowserTestUtils.waitForEvent(
    window.gBrowser.tabContainer,
    "SSTabRestored"
  );
  await closedObjectsChanged;
  Assert.equal(
    window.gBrowser.tabs.length,
    openTabsCount + 1,
    "The closed tab was restored"
  );
  Assert.equal(
    restoredTab1.linkedBrowser.currentURI.spec,
    "https://example.org/",
    "The re-opened tab had the expected URL"
  );
  Assert.deepEqual(
    SessionStore.getClosedTabDataFromClosedWindows().map(
      td => td.state.entries[0].url
    ),
    [
      "https://example.net/",
      // "https://example.org/" from testWindow2 got reopened and should be removed
    ],
    "Re-opened tabs not listed in closed tabs"
  );

  // use undoClosedTabFromClosedWindows to reference the closed tab by closedId
  closedObjectsChanged = TestUtils.topicObserved(TOPIC_CLOSED_OBJECTS_CHANGED);
  let restoredTab2 = SessionStore.undoClosedTabFromClosedWindow(
    { sourceClosedId: preparedClosedIds.testWindow2 },
    preparedClosedIds.tab2,
    window
  );
  await BrowserTestUtils.waitForEvent(
    window.gBrowser.tabContainer,
    "SSTabRestored"
  );
  await closedObjectsChanged;
  Assert.equal(
    window.gBrowser.tabs.length,
    openTabsCount + 2,
    "The closed tab was restored"
  );
  Assert.equal(
    restoredTab2.linkedBrowser.currentURI.spec,
    "https://example.net/",
    "The re-opened tab had the expected URL"
  );

  Assert.deepEqual(
    SessionStore.getClosedTabDataFromClosedWindows().map(
      td => td.state.entries[0].url
    ),
    [
      // "https://example.org/" from testWindow2 got reopened and should be removed
    ],
    "Re-opened tabs not listed in closed tabs"
  );

  // clean up the re-opened tabs
  for (let tab of [restoredTab1, restoredTab2]) {
    await TabStateFlusher.flush(tab.linkedBrowser);
    let sessionUpdatePromise = BrowserTestUtils.waitForSessionStoreUpdate(tab);
    BrowserTestUtils.removeTab(tab);
    await sessionUpdatePromise;
  }
});
