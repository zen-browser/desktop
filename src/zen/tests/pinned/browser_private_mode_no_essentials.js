/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Private_Mode_No_Essentials() {
  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true);
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

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

        let privateWindow = await BrowserTestUtils.openNewBrowserWindow({
          private: true,
        });
        await privateWindow.gZenWorkspaces.promiseInitialized;
        ok(
          !privateWindow.gBrowser.tabs.some((tab) => tab.pinned),
          'Private window should not have any pinned tabs initially'
        );

        await BrowserTestUtils.closeWindow(privateWindow);
      } catch (error) {
        ok(false, 'Error while checking the pin object in ZenPinnedTabsStorage: ' + error);
      }
      resolvePromise();
    },
    { once: true }
  );
  gZenPinnedTabManager.addToEssentials(newTab);

  await promise;
  await BrowserTestUtils.removeTab(newTab);
});
