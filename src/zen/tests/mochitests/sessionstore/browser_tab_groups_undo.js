/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_tabGroupsUndo() {
  Assert.equal(
    SessionStore.getLastClosedTabGroupId(window),
    null,
    "Should start without a last closed tab group id"
  );
  Assert.equal(
    window.gBrowser.tabGroups.length,
    0,
    "Should start with no tab groups"
  );

  let groupedTabs = [
    BrowserTestUtils.addTab(gBrowser, "https://example.com"),
    BrowserTestUtils.addTab(gBrowser, "https://example.com"),
  ];
  await Promise.all(
    groupedTabs.map(g => promiseBrowserLoaded(g.linkedBrowser))
  );

  info("Adding to tab group");
  let tabGroup = gBrowser.addTabGroup(groupedTabs);
  let tabGroupId = tabGroup.id;

  info("Waiting for tab group removed");
  let removePromise = BrowserTestUtils.waitForEvent(
    tabGroup,
    "TabGroupRemoved"
  );
  await gBrowser.removeTabGroup(tabGroup);
  await removePromise;

  await TabStateFlusher.flushWindow(window);

  info("Waiting for getLastClosedTabGroupId");
  await TestUtils.waitForCondition(
    () => SessionStore.getLastClosedTabGroupId(window) !== null
  );

  Assert.equal(
    SessionStore.getLastClosedTabGroupId(window),
    tabGroupId,
    "SessionStore saves the ID of the last closed tab group"
  );

  SessionWindowUI.undoCloseTab(window);

  Assert.equal(window.gBrowser.tabGroups.length, 1, "Tab group was restored");
  Assert.equal(
    SessionStore.getLastClosedTabGroupId(window),
    null,
    "SessionStore reset the ID of the last closed tab group"
  );

  BrowserTestUtils.removeTab(gBrowser.tabGroups[0].tabs[0]);
  Assert.equal(
    SessionStore.getLastClosedTabGroupId(window),
    null,
    "SessionStore last closed group ID is null after closing a tab within a group"
  );

  let ungroupedTab = BrowserTestUtils.addTab(gBrowser, "https://example.com");
  await promiseBrowserLoaded(ungroupedTab.linkedBrowser);
  BrowserTestUtils.removeTab(ungroupedTab);

  Assert.equal(
    SessionStore.getLastClosedTabGroupId(window),
    null,
    "SessionStore last closed group ID is null after closing a tab not in a group"
  );

  let savedGroupedTabs = [
    BrowserTestUtils.addTab(gBrowser, "https://example.com"),
    BrowserTestUtils.addTab(gBrowser, "https://example.com"),
  ];
  await Promise.all(
    savedGroupedTabs.map(g => promiseBrowserLoaded(g.linkedBrowser))
  );
  info("Adding to tab group");
  let savedTabGroup = gBrowser.addTabGroup(savedGroupedTabs);
  let savedTabGroupId = savedTabGroup.id;

  savedTabGroup.save();
  info("Waiting for tab group removed");
  removePromise = BrowserTestUtils.waitForEvent(
    savedTabGroup,
    "TabGroupRemoved"
  );
  await gBrowser.removeTabGroup(savedTabGroup);
  await removePromise;

  await TabStateFlusher.flushWindow(window);

  info("Waiting for getLastClosedTabGroupId");
  await TestUtils.waitForCondition(
    () => SessionStore.getLastClosedTabGroupId(window) !== null
  );

  Assert.equal(
    SessionStore.getLastClosedTabGroupId(window),
    savedTabGroupId,
    "SessionStore saves the ID of the last saved and closed tab group"
  );

  gBrowser.removeAllTabsBut(gBrowser.tabs[0]);
});
