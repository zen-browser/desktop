/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_restoreTabToGroup() {
  let groupedTabs = [
    BrowserTestUtils.addTab(gBrowser, "about:mozilla"),
    BrowserTestUtils.addTab(gBrowser, "about:robots"),
  ];
  let tabToRestore = groupedTabs[1];
  await Promise.all(
    groupedTabs.map(g => promiseBrowserLoaded(g.linkedBrowser))
  );
  let tabGroup = gBrowser.addTabGroup(groupedTabs);

  await SessionStoreTestUtils.closeTab(tabToRestore);

  Assert.equal(tabGroup.tabs.length, 1, "Tab group only has one tab");

  await TabStateFlusher.flushWindow(window);

  let tabRestoredEvent = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "SSTabRestored"
  );
  SessionStore.undoCloseTab(window);
  await tabRestoredEvent;

  Assert.equal(tabGroup.tabs.length, 2, "Tab group has two tabs");
  let restoredTab = tabGroup.tabs.at(-1);
  Assert.equal(
    restoredTab.linkedBrowser.currentURI.spec,
    "about:robots",
    "Closed tab exists in group"
  );
  BrowserTestUtils.removeTab(restoredTab);

  // remove the other tab in the group so it gets deleted
  await SessionStoreTestUtils.closeTab(tabGroup.tabs[0]);

  tabRestoredEvent = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "SSTabRestored"
  );
  SessionStore.undoCloseTab(window, 0);
  await tabRestoredEvent;

  restoredTab = gBrowser.tabs.at(-1);
  Assert.ok(
    !restoredTab.group,
    "Tab was not restored to the group because the group was removed"
  );

  forgetClosedTabs(window);
});
