/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function holdsPage(aWindow, aUrl) {
  return aWindow.gBrowser.tabs.some(
    tab =>
      tab.linkedBrowser?.currentURI?.spec === aUrl ||
      SessionStore.getTabState(tab).includes(aUrl)
  );
}

add_task(async function test_moveUnloadedTabsToNewWindow() {
  await gZenWorkspaces.promiseInitialized;

  const loadedTab = BrowserTestUtils.addTab(gBrowser, "https://example.com/1");
  const unloadedTab = BrowserTestUtils.addTab(
    gBrowser,
    "https://example.com/2"
  );
  await Promise.all([
    BrowserTestUtils.browserLoaded(loadedTab.linkedBrowser),
    BrowserTestUtils.browserLoaded(unloadedTab.linkedBrowser),
  ]);

  Assert.ok(
    gBrowser.discardBrowser(unloadedTab),
    "The second tab should be unloaded for the test to mean anything"
  );
  Assert.ok(!unloadedTab.linkedPanel, "The second tab is unloaded");

  gBrowser.selectedTab = loadedTab;
  gBrowser.addRangeToMultiSelectedTabs(loadedTab, unloadedTab);
  Assert.ok(unloadedTab.multiselected, "Both tabs are picked to be moved");

  const newWindowPromise = BrowserTestUtils.waitForNewWindow();
  gBrowser.replaceTabsWithWindow(loadedTab);
  const win = await newWindowPromise;
  await win.gZenWorkspaces.promiseInitialized;
  await new Promise(resolve => win.requestIdleCallback(resolve));

  Assert.ok(
    holdsPage(win, "https://example.com/1"),
    "The loaded tab is in the new window"
  );
  Assert.ok(
    holdsPage(win, "https://example.com/2"),
    "The unloaded tab is in the new window"
  );

  await BrowserTestUtils.closeWindow(win);
  for (const url of ["https://example.com/1", "https://example.com/2"]) {
    const tab = gBrowser.tabs.find(
      candidate => candidate.linkedBrowser?.currentURI?.spec === url
    );
    if (tab) {
      BrowserTestUtils.removeTab(tab);
    }
  }
});
