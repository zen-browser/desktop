"use strict";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  TabGroupTestUtils: "resource://testing-common/TabGroupTestUtils.sys.mjs",
});

const ORIG_STATE = SessionStore.getBrowserState();

add_task(async function test_closingTabGroupAddsClosedGroup() {
  let win = await promiseNewWindowLoaded();

  let tabs = [
    BrowserTestUtils.addTab(win.gBrowser, "https://example.com"),
    BrowserTestUtils.addTab(win.gBrowser, "https://example.com"),
    BrowserTestUtils.addTab(win.gBrowser, "https://example.com"),
  ];
  let group = win.gBrowser.addTabGroup(tabs);
  await Promise.all(
    tabs.map(async t => {
      await BrowserTestUtils.browserLoaded(t.linkedBrowser);
      await TabStateFlusher.flush(t.linkedBrowser);
    })
  );

  let windowState = ss.getWindowState(win).windows[0];
  Assert.equal(
    windowState.closedGroups.length,
    0,
    "Window state starts with no closed groups"
  );

  await lazy.TabGroupTestUtils.removeTabGroup(group);

  windowState = ss.getWindowState(win).windows[0];
  Assert.equal(
    windowState.closedGroups.length,
    1,
    "Window state gains a closed group"
  );
  Assert.equal(
    windowState.closedGroups[0].tabs.length,
    3,
    "Closed group has 3 tabs"
  );

  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_closedTabGroupSkipsNotWorthSavingTabs() {
  let win = await promiseNewWindowLoaded();

  const urls = ["https://example.com/", "about:blank"];
  const tabs = urls.map(url => BrowserTestUtils.addTab(win.gBrowser, url));
  let group = win.gBrowser.addTabGroup(tabs);
  await Promise.all(
    tabs.map(async (t, i) => {
      await BrowserTestUtils.browserLoaded(t.linkedBrowser, {
        wantLoad: urls[i],
      });
      await TabStateFlusher.flush(t.linkedBrowser);
    })
  );

  let windowState = ss.getWindowState(win).windows[0];
  Assert.equal(
    windowState.closedGroups.length,
    0,
    "Window state starts with no closed groups"
  );

  await lazy.TabGroupTestUtils.removeTabGroup(group);

  windowState = ss.getWindowState(win).windows[0];
  Assert.equal(
    windowState.closedGroups.length,
    1,
    "Window state gains a closed group"
  );
  Assert.equal(
    windowState.closedGroups[0].tabs.length,
    1,
    "Closed group has only 1 tab"
  );

  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_closedTabCountsRespectTabGroups() {
  let win = await promiseNewWindowLoaded();

  Assert.equal(
    SessionStore.getClosedTabCount(),
    0,
    "Session store starts with 0 closed tabs"
  );
  Assert.equal(
    SessionStore.getLastClosedTabCount(win),
    0,
    "Session store starts with 0 last closed tab count"
  );

  await SessionStoreTestUtils.openAndCloseTab(win, "https://example.com");

  Assert.equal(
    SessionStore.getClosedTabCount(),
    1,
    "Session store registers closed tab"
  );
  Assert.equal(
    SessionStore.getLastClosedTabCount(win),
    1,
    "Session store reports last closed tab count as 1"
  );

  // We need to have at least one "worth saving" tab open in the window at time
  // of close, or else the window will not be added to _closedWindows
  BrowserTestUtils.addTab(win.gBrowser, "https://example.com");
  let tabs = [
    BrowserTestUtils.addTab(win.gBrowser, "https://example.com"),
    BrowserTestUtils.addTab(win.gBrowser, "https://example.com"),
    BrowserTestUtils.addTab(win.gBrowser, "https://example.com"),
  ];
  let group = win.gBrowser.addTabGroup(tabs);
  await Promise.all(
    tabs.map(async t => {
      await BrowserTestUtils.browserLoaded(t.linkedBrowser);
      await TabStateFlusher.flush(t.linkedBrowser);
    })
  );

  await lazy.TabGroupTestUtils.removeTabGroup(group);

  Assert.equal(
    SessionStore.getClosedTabCount(),
    4,
    "Session store registers tabs from closed group"
  );
  Assert.equal(
    SessionStore.getLastClosedTabCount(win),
    3,
    "Session store reports last closed tab count as 3"
  );

  Assert.equal(
    SessionStore.getClosedTabCountForWindow(win),
    4,
    "Session store correctly reports closed tab count for window"
  );

  await BrowserTestUtils.closeWindow(win);

  Assert.equal(
    SessionStore.getClosedTabCountFromClosedWindows(),
    4,
    "Session store correctly reports closed tab count for closed windows"
  );

  forgetClosedWindows();
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_purgingSessionHistoryClearsClosedTabGroups() {
  let win = await promiseNewWindowLoaded();

  let tab = BrowserTestUtils.addTab(win.gBrowser, "https://example.com");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await TabStateFlusher.flush(tab.linkedBrowser);

  let group = win.gBrowser.addTabGroup([tab]);
  await lazy.TabGroupTestUtils.removeTabGroup(group);

  let windowState = ss.getWindowState(win).windows[0];
  Assert.equal(
    windowState.closedGroups.length,
    1,
    "Window state gains a closed group"
  );

  Services.obs.notifyObservers(null, "browser:purge-session-history");

  windowState = ss.getWindowState(win).windows[0];
  Assert.equal(
    windowState.closedGroups.length,
    0,
    "Session history purge removes closed groups"
  );

  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});
