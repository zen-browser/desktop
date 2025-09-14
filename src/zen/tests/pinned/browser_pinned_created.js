/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Create_Pinned() {
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

      try {
        const pins = await ZenPinnedTabsStorage.getPins();
        const pinObject = pins.find((pin) => pin.uuid === pinTabID);
        ok(pinObject, 'The pin object should exist in the ZenPinnedTabsStorage');
        Assert.equal(
          pinObject.url,
          'https://example.com/',
          'The pin object should have the correct URL'
        );
        Assert.equal(
          pinObject.workspaceUuid,
          gZenWorkspaces.activeWorkspace,
          'The pin object should have the correct workspace UUID'
        );
      } catch (error) {
        ok(false, 'Error while checking the pin object in ZenPinnedTabsStorage: ' + error);
      }

      resolvePromise();
    },
    { once: true }
  );
  gBrowser.pinTab(newTab);

  await promise;
  await BrowserTestUtils.removeTab(newTab);
});
