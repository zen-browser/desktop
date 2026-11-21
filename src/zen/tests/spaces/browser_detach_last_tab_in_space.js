/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);

// A window that closes with its last tab selects its empty tab first, and the
// extensions tab tracker can then reject on that tab.
PromiseTestUtils.allowMatchingRejectionsGlobally(
  /Cannot attach ID to a tab in a closed window/
);

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.window-sync.enabled", false]],
  });
});

add_task(async function test_detach_last_tab_in_space_keeps_window() {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  await win.gZenWorkspaces.promiseInitialized;

  const otherSpaceTab = BrowserTestUtils.addTab(
    win.gBrowser,
    "https://example.com/",
    { skipAnimation: true }
  );
  await win.gZenWorkspaces.createAndSaveWorkspace("Detach Space");
  const detachSpace = win.gZenWorkspaces.activeWorkspace;
  const onlyTab = BrowserTestUtils.addTab(
    win.gBrowser,
    "https://example.org/",
    {
      skipAnimation: true,
    }
  );
  win.gBrowser.selectedTab = onlyTab;
  await BrowserTestUtils.browserLoaded(onlyTab.linkedBrowser);

  const newWindowPromise = BrowserTestUtils.waitForNewWindow();
  win.gBrowser.replaceTabsWithWindow(onlyTab);
  const detachedWin = await newWindowPromise;
  await TestUtils.waitForCondition(
    () => win.closed || !onlyTab.isConnected,
    "The detached tab leaves the original window"
  );

  Assert.ok(!win.closed, "The original window stays open");
  Assert.ok(
    win.gZenWorkspaces.allStoredTabs.includes(otherSpaceTab),
    "The tab in the other space is still in the original window"
  );
  Assert.equal(
    detachedWin.gBrowser.selectedBrowser.currentURI.spec,
    "https://example.org/",
    "The new window holds the detached tab"
  );

  await BrowserTestUtils.closeWindow(detachedWin);
  if (!win.closed) {
    await win.gZenWorkspaces.removeWorkspace(detachSpace);
    await BrowserTestUtils.closeWindow(win);
  }
});

add_task(async function test_detach_only_tab_keeps_window() {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  await win.gZenWorkspaces.promiseInitialized;

  const onlyTab = win.gBrowser.selectedTab;
  await BrowserTestUtils.loadURIString({
    browser: onlyTab.linkedBrowser,
    uriString: "https://example.org/",
  });

  const newWindowPromise = BrowserTestUtils.waitForNewWindow();
  win.gBrowser.replaceTabsWithWindow(onlyTab);
  const detachedWin = await newWindowPromise;
  await TestUtils.waitForCondition(
    () => win.closed || !onlyTab.isConnected,
    "The detached tab leaves the original window"
  );

  Assert.ok(!win.closed, "The original window stays open");
  Assert.equal(
    win.gBrowser.selectedTab,
    win.gZenWorkspaces._emptyTab,
    "The original window shows the empty tab"
  );
  Assert.equal(
    detachedWin.gBrowser.selectedBrowser.currentURI.spec,
    "https://example.org/",
    "The new window holds the detached tab"
  );

  await BrowserTestUtils.closeWindow(detachedWin);
  if (!win.closed) {
    await BrowserTestUtils.closeWindow(win);
  }
});

// A window opened by a detach is unsynced, and unsynced windows close with
// their last tab.
add_task(async function test_move_only_tab_of_unsynced_window_closes_it() {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  await win.gZenWorkspaces.promiseInitialized;

  const tab = BrowserTestUtils.addTab(win.gBrowser, "https://example.org/", {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  const newWindowPromise = BrowserTestUtils.waitForNewWindow();
  win.gBrowser.replaceTabsWithWindow(tab);
  const unsyncedWin = await newWindowPromise;
  await TestUtils.waitForCondition(
    () => !tab.isConnected,
    "The detached tab leaves the original window"
  );
  Assert.ok(
    !unsyncedWin.gZenWorkspaces.currentWindowIsSyncing,
    "The detached window is unsynced"
  );

  win.gBrowser.adoptTab(unsyncedWin.gBrowser.selectedTab, {
    selectTab: true,
  });
  await TestUtils.waitForCondition(
    () => unsyncedWin.closed,
    "The unsynced window closes with its only tab"
  );
  Assert.equal(
    win.gBrowser.selectedBrowser.currentURI.spec,
    "https://example.org/",
    "The original window holds the tab again"
  );

  await BrowserTestUtils.closeWindow(win);
});
