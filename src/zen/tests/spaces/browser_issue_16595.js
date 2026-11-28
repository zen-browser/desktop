/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.urlbar.open-on-startup", false],
      ["zen.urlbar.replace-newtab", false],
      ["zen.window-sync.enabled", false],
      ["zen.workspaces.continue-where-left-off", false],
    ],
  });
});

// A tab as session restore leaves it: lazy, with the URL it was saved at.
async function addRestoredTab(win, url, originalURI = url) {
  const tab = BrowserTestUtils.addTab(win.gBrowser, "about:blank", {
    skipAnimation: true,
  });
  SessionStore.setTabState(
    tab,
    JSON.stringify({
      entries: [
        {
          url,
          originalURI,
          triggeringPrincipal_base64: E10SUtils.SERIALIZED_SYSTEMPRINCIPAL,
        },
      ],
      index: 1,
    })
  );
  await TestUtils.waitForCondition(
    () => JSON.parse(SessionStore.getTabState(tab)).entries[0]?.url === url,
    "The tab holds its restored session history"
  );
  tab._originalUrl = url;
  return tab;
}

// selectStartPage() only runs once per window, so every case uses a new one.
async function runStartPage(homepage, restoredTabs) {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.startup.homepage", homepage]],
  });
  const win = await BrowserTestUtils.openNewBrowserWindow();
  await win.gZenWorkspaces.promiseInitialized;

  const tabs = [];
  for (const [url, originalURI] of restoredTabs) {
    tabs.push(await addRestoredTab(win, url, originalURI));
  }
  // The homepage tab opened for this launch.
  const startTab = BrowserTestUtils.addTab(win.gBrowser, "about:blank", {
    skipAnimation: true,
  });
  win.gBrowser.selectedTab = startTab;
  Object.defineProperty(win.gBrowserInit, "uriToLoadPromise", {
    value: null,
    configurable: true,
    writable: true,
  });

  // selectStartPage() is a no-op while testing mode is enabled.
  const originalTestingEnabled = win.gZenUIManager.testingEnabled;
  win.gZenUIManager.testingEnabled = false;
  try {
    await win.gZenWorkspaces.selectStartPage();
  } finally {
    win.gZenUIManager.testingEnabled = originalTestingEnabled;
  }
  await SpecialPowers.popPrefEnv();
  return { win, tabs };
}

add_task(async function test_removes_restored_homepage_tab() {
  const { win, tabs } = await runStartPage("https://example.com/", [
    ["https://example.com/"],
    ["https://example.org/"],
  ]);
  Assert.ok(
    !win.gBrowser.tabs.includes(tabs[0]),
    "The restored copy of the homepage is removed"
  );
  Assert.ok(win.gBrowser.tabs.includes(tabs[1]), "Other tabs are kept");
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_removes_restored_tab_of_first_homepage() {
  const { win, tabs } = await runStartPage(
    "https://example.com/|https://example.org/",
    [["https://example.com/"], ["https://example.org/"]]
  );
  Assert.ok(
    !win.gBrowser.tabs.includes(tabs[0]),
    "The restored copy of the first homepage is removed"
  );
  Assert.ok(
    win.gBrowser.tabs.includes(tabs[1]),
    "Homepages that are not opened again on restore are kept"
  );
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_removes_restored_tab_of_fixed_up_homepage() {
  // "example.com" is loaded as http://example.com/ and may end up on
  // https://example.com/ after an upgrade or a redirect.
  const { win, tabs } = await runStartPage("example.com", [
    ["https://example.com/", "http://example.com/"],
  ]);
  Assert.ok(
    !win.gBrowser.tabs.includes(tabs[0]),
    "The restored copy of a homepage without a scheme is removed"
  );
  await BrowserTestUtils.closeWindow(win);
});
