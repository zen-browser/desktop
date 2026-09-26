/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const HOMEPAGES = "https://example.com/|https://example.org/";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.urlbar.open-on-startup", false]],
  });
});

// selectStartPage() only runs once per window, so every case uses a new one.
async function runStartPage(startupURI, prefs) {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  await win.gZenWorkspaces.promiseInitialized;
  if (prefs) {
    await SpecialPowers.pushPrefEnv({ set: prefs });
  }

  // The tab Zen marks as empty at startup, which Firefox then loads the first
  // startup URL into.
  const tab = BrowserTestUtils.addTab(win.gBrowser, "https://example.com/", {
    skipAnimation: true,
  });
  win.gBrowser.selectedTab = tab;
  win.gZenWorkspaces._tabToRemoveForEmpty = tab;
  Object.defineProperty(win.gBrowserInit, "uriToLoadPromise", {
    value: startupURI,
    configurable: true,
    writable: true,
  });

  // selectStartPage() and selectEmptyTab() are no-ops while testing mode is
  // enabled.
  const originalTestingEnabled = win.gZenUIManager.testingEnabled;
  win.gZenUIManager.testingEnabled = false;
  try {
    await win.gZenWorkspaces.selectStartPage();
  } finally {
    win.gZenUIManager.testingEnabled = originalTestingEnabled;
  }
  return { win, tab };
}

add_task(async function test_keeps_first_homepage_tab() {
  const { win, tab } = await runStartPage(HOMEPAGES);
  Assert.ok(
    win.gBrowser.tabs.includes(tab),
    "The tab holding the first homepage URL was kept"
  );
  Assert.equal(
    win.gBrowser.selectedTab,
    tab,
    "The first homepage tab is selected"
  );
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_removes_tab_without_startup_page() {
  const { win, tab } = await runStartPage(null);
  Assert.ok(
    !win.gBrowser.tabs.includes(tab),
    "The empty startup tab is still removed when nothing was loaded into it"
  );
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_fallback_opens_first_homepage() {
  const { win, tab } = await runStartPage(null, [
    ["zen.urlbar.replace-newtab", false],
    ["browser.startup.homepage", HOMEPAGES],
  ]);
  const fallbackTab = win.gBrowser.selectedTab;
  Assert.notEqual(fallbackTab, tab, "A fallback homepage tab was opened");
  await TestUtils.waitForCondition(
    () => fallbackTab.linkedBrowser.currentURI.spec === "https://example.com/",
    "The fallback tab opens the first homepage URL, not the whole pref"
  );
  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
});
