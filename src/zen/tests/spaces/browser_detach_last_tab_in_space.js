/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

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
    win.gZenWorkspaces.activeWorkspace,
    detachSpace,
    "The original window stays on the emptied space"
  );
  Assert.equal(
    win.gBrowser.selectedTab,
    win.gZenWorkspaces._emptyTab,
    "The emptied space shows the empty tab"
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
