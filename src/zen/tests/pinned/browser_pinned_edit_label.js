/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Create_Pinned() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const customLabel = 'Test Label';

  await BrowserTestUtils.withNewTab({ gBrowser, url: 'https://example.com/' }, async (browser) => {
    const tab = gBrowser.getTabForBrowser(browser);
    tab.addEventListener(
      'ZenPinnedTabCreated',
      async function (event) {
        ok(tab.pinned, 'The tab should be pinned after calling gBrowser.pinTab()');

        const pinTabID = tab.getAttribute('zen-pin-id');
        ok(pinTabID, 'The tab should have a zen-pin-id attribute after being pinned');

        await gZenPinnedTabManager.updatePinTitle(tab, customLabel, true);

        const pinnedTabs = await ZenPinnedTabsStorage.getPins();
        const pinObject = pinnedTabs.find((pin) => pin.uuid === pinTabID);
        Assert.equal(pinObject.title, customLabel, 'The pin object should have the correct title');
        Assert.equal(
          pinObject.url,
          'https://example.com/',
          'The pin object should have the correct URL'
        );

        resolvePromise();
      },
      { once: true }
    );
    gBrowser.pinTab(tab);
    await promise;
  });
});
