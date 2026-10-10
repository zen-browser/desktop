/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();
const SITE = "https://example.com/";

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

// Test for closed tabs and tab groups in an open window
add_task(async function test_closedTabsPurgeDomainData() {
  let win = await promiseNewWindowLoaded();

  let tabs = [
    BrowserTestUtils.addTab(win.gBrowser, "about:mozilla"),
    BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
    BrowserTestUtils.addTab(win.gBrowser, SITE),
  ];
  let tabsInGroup = [
    BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
    BrowserTestUtils.addTab(win.gBrowser, SITE),
  ];

  let allTabs = [...tabs, ...tabsInGroup];
  await Promise.all(
    allTabs.map(async t => {
      await promiseBrowserLoaded(t.linkedBrowser);
    })
  );
  let tabGroup = win.gBrowser.addTabGroup(tabsInGroup);

  await TabStateFlusher.flushWindow(win);

  tabs.forEach(t => {
    win.gBrowser.removeTab(t);
  });
  let removePromise = BrowserTestUtils.waitForEvent(
    tabGroup,
    "TabGroupRemoved"
  );
  win.gBrowser.removeTabGroup(tabGroup);
  await removePromise;

  let state = ss.getWindowState(win).windows[0];
  Assert.equal(
    state._closedTabs.length,
    3,
    "Closed tabs state has all closed tabs"
  );
  Assert.equal(
    state.closedGroups[0].tabs.length,
    2,
    "Closed tab group state has all closed tabs"
  );

  // Purge session history for domain
  Services.obs.notifyObservers(
    null,
    "browser:purge-session-history-for-domain",
    "example.com"
  );

  state = ss.getWindowState(win).windows[0];
  Assert.equal(state._closedTabs.length, 2, "Closed tab list has one less tab");
  Assert.equal(
    state.closedGroups[0].tabs.length,
    1,
    "Closed tab group tab list has one less tab"
  );

  state._closedTabs.forEach((tab, index) => {
    Assert.notEqual(
      tab.state.entries[0].url,
      SITE,
      `Closed tab ${index} does not contain purged site`
    );
  });
  state.closedGroups[0].tabs.forEach((tab, index) => {
    Assert.notEqual(
      tab.state.entries[0].url,
      SITE,
      `Closed tab ${index} in group does not contain purged site`
    );
  });

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_closedTabsInClosedWindowsPurgeDomainData() {
  let win = await promiseNewWindowLoaded();

  let openTabs = [
    BrowserTestUtils.addTab(win.gBrowser, "about:mozilla"),
    BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
    BrowserTestUtils.addTab(win.gBrowser, SITE),
  ];
  let tabsInOpenGroup = [
    BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
    BrowserTestUtils.addTab(win.gBrowser, SITE),
  ];
  let closedTabs = [
    BrowserTestUtils.addTab(win.gBrowser, "about:mozilla"),
    BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
    BrowserTestUtils.addTab(win.gBrowser, SITE),
  ];
  let tabsInClosedGroup = [
    BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
    BrowserTestUtils.addTab(win.gBrowser, SITE),
  ];

  let allTabs = [
    ...openTabs,
    ...tabsInOpenGroup,
    ...closedTabs,
    ...tabsInClosedGroup,
  ];
  await Promise.all(
    allTabs.map(async t => {
      await promiseBrowserLoaded(t.linkedBrowser);
    })
  );
  win.gBrowser.addTabGroup(tabsInOpenGroup);
  let closedTabGroup = win.gBrowser.addTabGroup(tabsInClosedGroup);

  await TabStateFlusher.flushWindow(win);

  closedTabs.forEach(t => {
    win.gBrowser.removeTab(t);
  });
  let removePromise = BrowserTestUtils.waitForEvent(
    closedTabGroup,
    "TabGroupRemoved"
  );
  win.gBrowser.removeTabGroup(closedTabGroup);
  await removePromise;

  await BrowserTestUtils.closeWindow(win);

  let state = ss.getClosedWindowData()[0];
  Assert.equal(state.tabs.length, 6, "Open tabs state has all tabs");
  Assert.equal(
    state._closedTabs.length,
    3,
    "Closed tabs state has all closed tabs"
  );
  Assert.equal(
    state.closedGroups[0].tabs.length,
    2,
    "Closed tab group state has all closed tabs"
  );

  // Purge session history for domain
  Services.obs.notifyObservers(
    null,
    "browser:purge-session-history-for-domain",
    "example.com"
  );

  state = ss.getClosedWindowData()[0];
  Assert.equal(
    state.tabs.length,
    4,
    "Open tabs state loses ungrouped and grouped site tab"
  );
  Assert.equal(state._closedTabs.length, 2, "Closed tabs state loses a tab");
  Assert.equal(
    state.closedGroups[0].tabs.length,
    1,
    "Closed tab group state loses a tab"
  );

  state.tabs.forEach((tab, index) => {
    Assert.notEqual(
      tab.entries[0].url,
      SITE,
      `Open tab ${index} does not contain purged site`
    );
  });
  state._closedTabs.forEach((tab, index) => {
    Assert.notEqual(
      tab.state.entries[0].url,
      SITE,
      `Closed tab ${index} does not contain purged site`
    );
  });
  state.closedGroups[0].tabs.forEach((tab, index) => {
    Assert.notEqual(
      tab.state.entries[0].url,
      SITE,
      `Closed tab ${index} in group does not contain purged site`
    );
  });
});
