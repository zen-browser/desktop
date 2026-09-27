/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const HOMEPAGES = "https://example.com/|https://example.org/";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.urlbar.open-on-startup", false]],
  });
});

add_task(async function test_fallback_opens_first_homepage() {
  // selectStartPage() only runs once per window, so use a new one.
  const win = await BrowserTestUtils.openNewBrowserWindow();
  await win.gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.urlbar.replace-newtab", false],
      ["browser.startup.homepage", HOMEPAGES],
    ],
  });

  // The tab Zen marks as empty at startup. selectStartPage() removes it and
  // falls back to selectEmptyTab().
  const tab = BrowserTestUtils.addTab(win.gBrowser, "https://example.com/", {
    skipAnimation: true,
  });
  win.gBrowser.selectedTab = tab;
  win.gZenWorkspaces._tabToRemoveForEmpty = tab;

  // selectStartPage() and selectEmptyTab() are no-ops while testing mode is
  // enabled.
  const originalTestingEnabled = win.gZenUIManager.testingEnabled;
  win.gZenUIManager.testingEnabled = false;
  try {
    await win.gZenWorkspaces.selectStartPage();
  } finally {
    win.gZenUIManager.testingEnabled = originalTestingEnabled;
  }

  const fallbackTab = win.gBrowser.selectedTab;
  Assert.notEqual(fallbackTab, tab, "A fallback homepage tab was opened");
  await TestUtils.waitForCondition(
    () => fallbackTab.linkedBrowser.currentURI.spec === "https://example.com/",
    "The fallback tab opens the first homepage URL, not the whole pref"
  );
  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
});
