/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Remove_Pinned() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true);

  const newTab = gBrowser.selectedTab;
  newTab.addEventListener(
    'ZenPinnedTabCreated',
    async function (event) {
      ok(newTab.pinned, 'The tab should be pinned after calling gBrowser.pinTab()');

      const pinTabID = newTab.getAttribute('zen-pin-id');
      ok(pinTabID, 'The tab should have a zen-pin-id attribute after being pinned');

      const pins = await ZenPinnedTabsStorage.getPins();
      const pinObject = pins.find((pin) => pin.uuid === pinTabID);
      ok(pinObject, 'The pin object should exist in the ZenPinnedTabsStorage');
      newTab.addEventListener(
        'ZenPinnedTabRemoved',
        async function (event) {
          const pins = await ZenPinnedTabsStorage.getPins();
          const pinObject = pins.find((pin) => pin.uuid === pinTabID);
          ok(
            !pinObject,
            'The pin object should not exist in the ZenPinnedTabsStorage after removal'
          );
          ok(
            !newTab.hasAttribute('zen-pin-id'),
            'The tab should not have a zen-pin-id attribute after removal'
          );
          ok(!newTab.pinned, 'The tab should not be pinned after removal');
          resolvePromise();
        },
        { once: true }
      );
      gBrowser.unpinTab(newTab);
    },
    { once: true }
  );
  gBrowser.pinTab(newTab);

  await promise;
  await BrowserTestUtils.removeTab(newTab);
});
