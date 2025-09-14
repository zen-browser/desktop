/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Pinned_Reorder_Changed_Label() {
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

  const customLabel = 'Test Label';

  const newTab = gBrowser.selectedTab;
  newTab.addEventListener(
    'ZenPinnedTabCreated',
    async function (event) {
      ok(newTab.pinned, 'The tab should be pinned after calling gBrowser.pinTab()');

      const pinTabID = newTab.getAttribute('zen-pin-id');
      ok(pinTabID, 'The tab should have a zen-pin-id attribute after being pinned');

      await gZenPinnedTabManager.updatePinTitle(newTab, customLabel, true);

      const pins = await ZenPinnedTabsStorage.getPins();
      const pinObject = pins.find((pin) => pin.uuid === pinTabID);

      newTab.addEventListener(
        'ZenPinnedTabMoved',
        async function (event) {
          const pins = await ZenPinnedTabsStorage.getPins();
          const pinObject = pins.find((pin) => pin.uuid === pinTabID);
          Assert.equal(
            pinObject.title,
            customLabel,
            'The pin object should have the correct title'
          );
          Assert.equal(
            pinObject.position,
            2,
            'The pin object should have the correct position after moving'
          );
          resolvePromise();
        },
        { once: true }
      );
      gBrowser.moveTabTo(newTab, { tabIndex: 2 });
    },
    { once: true }
  );
  gBrowser.pinTab(newTab);

  await promise;
  for (const tab of tabsToRemove) {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_Pinned_Reorder_Changed_Label() {
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

  const customLabel = 'Test Label';

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
          await gZenPinnedTabManager.updatePinTitle(newTab, customLabel, true);
          const pins = await ZenPinnedTabsStorage.getPins();
          const pinObject = pins.find((pin) => pin.uuid === pinTabID);
          Assert.equal(
            pinObject.title,
            customLabel,
            'The pin object should have the correct title'
          );
          Assert.equal(
            pinObject.position,
            1,
            'The pin object should have the correct position after moving'
          );
          resolvePromise();
        },
        { once: true }
      );
      gBrowser.moveTabTo(newTab, { tabIndex: 1 });
    },
    { once: true }
  );
  gBrowser.pinTab(newTab);

  await promise;
  for (const tab of tabsToRemove) {
    await BrowserTestUtils.removeTab(tab);
  }
});
