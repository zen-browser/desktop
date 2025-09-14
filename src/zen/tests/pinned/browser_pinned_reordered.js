/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Create_Pinned() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const tabsToRemove = [];
  for (let i = 0; i < 3; i++) {
    await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true);
    gBrowser.pinTab(gBrowser.selectedTab);
    tabsToRemove.push(gBrowser.selectedTab);
  }

  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true);
  tabsToRemove.push(gBrowser.selectedTab);

  const newTab = gBrowser.selectedTab;
  newTab.addEventListener(
    'ZenPinnedTabCreated',
    async function (event) {
      ok(newTab.pinned, 'The tab should be pinned after calling gBrowser.pinTab()');

      const pinTabID = newTab.getAttribute('zen-pin-id');
      ok(pinTabID, 'The tab should have a zen-pin-id attribute after being pinned');

      const pins = await ZenPinnedTabsStorage.getPins();
      const pinObject = pins.find((pin) => pin.uuid === pinTabID);
      const startIndex = pinObject.position;
      Assert.greater(startIndex, 0, 'The pin object should have the correct start index');

      resolvePromise();
    },
    { once: true }
  );
  gBrowser.pinTab(newTab);

  await promise;
  for (const tab of tabsToRemove) {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_Create_Pinned() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const tabsToRemove = [];
  for (let i = 0; i < 3; i++) {
    await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true);
    gBrowser.pinTab(gBrowser.selectedTab);
    tabsToRemove.push(gBrowser.selectedTab);
  }

  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true);
  tabsToRemove.push(gBrowser.selectedTab);

  const newTab = gBrowser.selectedTab;
  newTab.addEventListener(
    'ZenPinnedTabCreated',
    async function (event) {
      ok(newTab.pinned, 'The tab should be pinned after calling gBrowser.pinTab()');

      const pinTabID = newTab.getAttribute('zen-pin-id');
      ok(pinTabID, 'The tab should have a zen-pin-id attribute after being pinned');

      newTab.addEventListener(
        'ZenPinnedTabMoved',
        async function (event) {
          const pins = await ZenPinnedTabsStorage.getPins();
          const pinObject = pins.find((pin) => pin.uuid === pinTabID);
          Assert.equal(
            pinObject.position,
            0,
            'The pin object should have the correct position after moving'
          );
          resolvePromise();
        },
        { once: true }
      );
      gBrowser.moveTabTo(newTab, { tabIndex: 0 });
    },
    { once: true }
  );
  gBrowser.pinTab(newTab);

  await promise;
  for (const tab of tabsToRemove) {
    await BrowserTestUtils.removeTab(tab);
  }
});
