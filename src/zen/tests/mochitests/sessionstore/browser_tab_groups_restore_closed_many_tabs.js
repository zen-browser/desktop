/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { TabGroupTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/TabGroupTestUtils.sys.mjs"
);

// Ensure that a closed tab group will record all of its tabs into session state
// without being constrained by the `browser.sessionstore.max_tabs_undo` pref
// which normally limits the number of closed tabs that we retain in state.

const ORIG_STATE = SessionStore.getBrowserState();

const maxTabsUndo = Services.prefs.getIntPref(
  "browser.sessionstore.max_tabs_undo"
);
const numberOfTabsToTest = maxTabsUndo + 5;

registerCleanupFunction(async () => {
  forgetClosedWindows();
  forgetSavedTabGroups();
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_restoreClosedTabGroupWithManyTabs() {
  let win = await promiseNewWindowLoaded();
  let tabs = [];
  let tabUrls = [];
  for (let i = 1; i <= numberOfTabsToTest; i++) {
    let tab = BrowserTestUtils.addTab(
      win.gBrowser,
      `https://example.com/?${i}`
    );
    tabUrls.push(`https://example.com/?${i}`);
    tabs.push(tab);
  }
  await Promise.all(
    tabs.map(tab => BrowserTestUtils.browserLoaded(tab.linkedBrowser))
  );

  const tabGroupToClose = win.gBrowser.addTabGroup(tabs, {
    color: "blue",
    label: "many tabs",
  });
  const tabGroupToCloseId = tabGroupToClose.id;

  Assert.equal(
    win.gBrowser.tabs.length,
    numberOfTabsToTest + 1,
    `there should be ${numberOfTabsToTest} new tabs + 1 initial tab from the new window`
  );
  for (let i = 1; i <= numberOfTabsToTest; i++) {
    Assert.equal(
      tabGroupToClose.tabs[i - 1].linkedBrowser.currentURI.spec,
      tabUrls[i - 1],
      `confirmed order of tab ${i} in the group`
    );
  }

  await TabStateFlusher.flushWindow(win);

  await TabGroupTestUtils.removeTabGroup(tabGroupToClose);

  Assert.ok(
    !win.gBrowser.tabGroups.length,
    "closed tab group should not be in the tab strip"
  );

  let closedTabGroups = ss.getClosedTabGroups(win);
  Assert.equal(
    closedTabGroups.length,
    1,
    "one closed tab group should be in session state"
  );
  let closedTabGroup = closedTabGroups[0];
  Assert.equal(
    closedTabGroup.id,
    tabGroupToCloseId,
    "the tab group we closed should be in session state"
  );
  Assert.equal(
    closedTabGroup.tabs.length,
    numberOfTabsToTest,
    "the closed tab group should contain all of the tabs"
  );
  for (let i = 1; i <= numberOfTabsToTest; i++) {
    Assert.equal(
      closedTabGroup.tabs[i - 1].state.entries[0].url,
      tabUrls[i - 1],
      `the closed tab group tab ${i} should preserve its order in the group`
    );
  }

  let restorePromise = BrowserTestUtils.waitForEvent(win, "SSWindowStateReady");
  let undoTabGroup = SessionStore.undoCloseTabGroup(
    win,
    tabGroupToCloseId,
    win
  );
  await restorePromise;
  await Promise.all(
    undoTabGroup.tabs.map(tab =>
      BrowserTestUtils.browserLoaded(tab.linkedBrowser)
    )
  );

  Assert.equal(
    win.gBrowser.tabs.length,
    numberOfTabsToTest + 1,
    `there should be ${numberOfTabsToTest} tabs restored + 1 initial tab from the new window`
  );
  for (let i = 1; i <= numberOfTabsToTest; i++) {
    Assert.equal(
      undoTabGroup.tabs[i - 1].linkedBrowser.currentURI.spec,
      tabUrls[i - 1],
      `the undo tab ${i} should preserve its order in the group`
    );
  }

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_restoreSavedTabGroupWithManyTabs() {
  let win = await promiseNewWindowLoaded();
  let tabs = [];
  let tabUrls = [];
  for (let i = 1; i <= numberOfTabsToTest; i++) {
    let tab = BrowserTestUtils.addTab(
      win.gBrowser,
      `https://example.com/?${i}`
    );
    tabUrls.push(`https://example.com/?${i}`);
    tabs.push(tab);
  }
  await Promise.all(
    tabs.map(tab => BrowserTestUtils.browserLoaded(tab.linkedBrowser))
  );

  const tabGroupToSaveAndClose = win.gBrowser.addTabGroup(tabs, {
    color: "blue",
    label: "many tabs",
  });
  const tabGroupToSaveAndCloseId = tabGroupToSaveAndClose.id;

  Assert.equal(
    win.gBrowser.tabs.length,
    numberOfTabsToTest + 1,
    `there should be ${numberOfTabsToTest} new tabs + 1 initial tab from the new window`
  );
  for (let i = 1; i <= numberOfTabsToTest; i++) {
    Assert.equal(
      tabGroupToSaveAndClose.tabs[i - 1].linkedBrowser.currentURI.spec,
      tabUrls[i - 1],
      `confirmed order of tab ${i} in the group`
    );
  }

  await TabGroupTestUtils.saveAndCloseTabGroup(tabGroupToSaveAndClose);

  Assert.ok(
    !win.gBrowser.tabGroups.length,
    "closed tab group should not be in the tab strip"
  );

  let savedGroupData = SessionStore.getSavedTabGroup(tabGroupToSaveAndCloseId);
  for (let i = 1; i <= numberOfTabsToTest; i++) {
    Assert.equal(
      savedGroupData.tabs[i - 1].state.entries[0].url,
      tabUrls[i - 1],
      `the saved tab group tab ${i} should preserve its order in the group`
    );
  }

  let restorePromise = BrowserTestUtils.waitForEvent(win, "SSWindowStateReady");
  let savedTabGroup = SessionStore.openSavedTabGroup(
    tabGroupToSaveAndCloseId,
    win
  );
  await restorePromise;
  await Promise.all(
    savedTabGroup.tabs.map(tab =>
      BrowserTestUtils.browserLoaded(tab.linkedBrowser)
    )
  );

  Assert.equal(
    win.gBrowser.tabs.length,
    numberOfTabsToTest + 1,
    `there should be ${numberOfTabsToTest} tabs restored + 1 initial tab from the new window`
  );
  for (let i = 1; i <= numberOfTabsToTest; i++) {
    Assert.equal(
      savedTabGroup.tabs[i - 1].linkedBrowser.currentURI.spec,
      tabUrls[i - 1],
      `restored tab ${i} should preserve its order in the group`
    );
  }

  await BrowserTestUtils.closeWindow(win);
});
