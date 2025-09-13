/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

/**
 * Tests tab navigation between loaded/unloaded tabs based on user preference
 */

const URL1 = 'http://example.com/page/1';
const URL2 = 'http://example.com/page/2_unloaded';
const URL3 = 'http://example.com/page/3';

// Helper function to create a normal loaded tab
async function createLoadedTab(url) {
  info(`Creating loaded tab predictably with URL ${url}`);
  const tab = BrowserTestUtils.addTab(gBrowser, url, {
    inBackground: true,
  });

  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  return tab;
}

function createUnloadedTab(url) {
  const tab = BrowserTestUtils.addTab(gBrowser, url, {
    inBackground: true,
    skipAnimation: true,
  });

  tab.linkedBrowser.setAttribute('pending', 'true');
  tab.setAttribute('pending', 'true');

  info(`New unloaded tab created at index ${gBrowser.tabs.indexOf(tab)} with URL ${url}`);
  return tab;
}

function resetPreferences() {
  Services.prefs.clearUserPref('zen.tabs.unloaded-navigation-mode');
}

async function waitForTabSelection(expectedTab) {
  await BrowserTestUtils.waitForCondition(
    () => gBrowser.selectedTab === expectedTab,
    'Waiting for tab to be selected'
  );
}

add_setup(async () => {
  resetPreferences();
});

add_task(async function test_basic_unloaded_navigation() {
  info('Basic test to verify the test infrastructure works');

  const tab1 = await createLoadedTab(URL1);
  const tab2 = createUnloadedTab(URL2);

  ok(tab1, 'Loaded tab should be created');
  ok(tab2, 'Unloaded tab should be created');
  is(tab2.hasAttribute('pending'), true, 'Tab should have pending attribute');
  is(tab1.hasAttribute('pending'), false, 'Loaded tab should not have pending attribute');

  BrowserTestUtils.removeTab(tab1);
  BrowserTestUtils.removeTab(tab2);
});

add_task(async function test_unloaded_navigation_always_mode() {
  info("Testing navigation with 'always' mode (includes unloaded tabs)");

  await SpecialPowers.pushPrefEnv({
    set: [['zen.tabs.unloaded-navigation-mode', 'always']],
  });

  const navigateAndAssert = async (direction, expectedTab, message) => {
    gBrowser.tabContainer.advanceSelectedTab(direction, false);
    await TestUtils.waitForTick();
    info(
      `After navigating by ${direction}, selected tab is at index ${gBrowser.tabs.indexOf(gBrowser.selectedTab)}`
    );
    is(gBrowser.selectedTab, expectedTab, message);
  };

  const loadedTab = await createLoadedTab(URL1);
  const unloadedTab = createUnloadedTab(URL2);
  const initialIndex = gBrowser.tabs.indexOf(loadedTab);

  gBrowser.selectedTab = loadedTab;
  await waitForTabSelection(loadedTab);

  await navigateAndAssert(
    1,
    gBrowser.tabs[initialIndex + 1],
    'Should navigate forward to the next tab (unloaded)'
  );

  await navigateAndAssert(-1, loadedTab, 'Should navigate backward to the previous tab (loaded)');

  BrowserTestUtils.removeTab(loadedTab);
  BrowserTestUtils.removeTab(unloadedTab);

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_unloaded_navigation_never_mode() {
  info("Testing navigation with 'never' mode (skips unloaded tabs) using URL comparison");

  await SpecialPowers.pushPrefEnv({
    set: [['zen.tabs.unloaded-navigation-mode', 'never']],
  });

  await TestUtils.waitForTick();

  /**
   * Helper to test navigation scenarios. Each run is isolated by creating and
   * then cleaning up its own set of tabs.
   */
  async function runNavTest({ setup, startIndex, direction, expectedURL, description }) {
    info(`Running test: ${description}`);

    let allTestTabs = [];
    try {
      // Create all the tabs required for this specific test scenario
      for (const tabConfig of setup) {
        let newTab;
        if (tabConfig.type === 'loaded') {
          newTab = await createLoadedTab(tabConfig.url);
        } else {
          newTab = createUnloadedTab(tabConfig.url);
        }
        allTestTabs.push(newTab);
      }

      // put tabs in ascending order for the tests to make sense
      for (let i = 0; i < allTestTabs.length; i++) {
        const targetIndex = gBrowser.tabs.length - allTestTabs.length + i;
        gBrowser.moveTabTo(allTestTabs[i], targetIndex);
      }

      //trimming unnecessary about:blanks
      for (let i = gBrowser.tabs.length - 1; i >= 0; i--) {
        const tab = gBrowser.tabs[i];
        if (
          tab.linkedBrowser.currentURI.spec === 'about:blank' &&
          tab.visible &&
          !tab.hasAttribute('pending') &&
          !allTestTabs.includes(tab)
        ) {
          gBrowser.removeTab(tab);
        }
      }

      const startTab = allTestTabs[startIndex];
      gBrowser.selectedTab = startTab;
      await waitForTabSelection(startTab);

      const startURL = gBrowser.selectedTab.linkedBrowser.currentURI.spec;
      const startTabIndex = gBrowser.tabs.indexOf(gBrowser.selectedTab);

      info(`Starting navigation from tab index ${startTabIndex}, direction ${direction}`);

      gBrowser.tabContainer.advanceSelectedTab(direction, false);
      await TestUtils.waitForTick();

      const finalURL = gBrowser.selectedTab.linkedBrowser.currentURI.spec;
      const finalTabIndex = gBrowser.tabs.indexOf(gBrowser.selectedTab);

      info(
        `--> Navigation result: Started on tab ${startTabIndex} [${startURL}], ended on tab ${finalTabIndex} [${finalURL}]`
      );

      is(finalURL, expectedURL, description);
    } finally {
      // just remove all tabs created for a specific test run before moving on to the next. Trying to 'KISS'
      for (const tab of allTestTabs) {
        if (tab && tab.isConnected) {
          BrowserTestUtils.removeTab(tab);
        }
      }
    }
  }

  // test scenarios
  await runNavTest({
    setup: [
      { type: 'loaded', url: URL1 },
      { type: 'unloaded', url: URL2 },
      { type: 'loaded', url: URL3 },
    ],
    startIndex: 0,
    direction: 1,
    expectedURL: URL3,
    description: 'Should skip one unloaded tab and land on the correct URL.',
  });

  await runNavTest({
    setup: [
      { type: 'loaded', url: URL1 },
      { type: 'unloaded', url: URL2 },
      { type: 'loaded', url: URL3 },
    ],
    startIndex: 2,
    direction: -1,
    expectedURL: URL1,
    description: 'Should skip one unloaded tab backward and land on the correct URL.',
  });

  await runNavTest({
    setup: [
      { type: 'loaded', url: URL1 },
      { type: 'unloaded', url: URL2 },
      { type: 'unloaded', url: URL2 },
      { type: 'loaded', url: URL3 },
    ],
    startIndex: 0,
    direction: 1,
    expectedURL: URL3,
    description: 'Should skip multiple unloaded tabs and land on the correct URL.',
  });

  await runNavTest({
    setup: [
      { type: 'loaded', url: URL1 },
      { type: 'unloaded', url: URL2 },
      { type: 'unloaded', url: URL2 },
    ],
    startIndex: 0,
    direction: 1,
    expectedURL: URL1,
    description: 'Should not move if there is no next loaded tab.',
  });

  await runNavTest({
    setup: [
      { type: 'loaded', url: URL1 },
      { type: 'unloaded', url: URL2 },
      { type: 'loaded', url: URL3 },
    ],
    startIndex: 2,
    direction: -1,
    expectedURL: URL1,
    description: "Should wrap around to the first loaded tab's URL.",
  });

  await SpecialPowers.popPrefEnv();
});

registerCleanupFunction(() => {
  resetPreferences();
});
