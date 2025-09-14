/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: 'resource://testing-common/UrlbarTestUtils.sys.mjs',
});

add_task(async function test_Search_Pinned_Title() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const customLabel = 'ZEN ROCKS';

  await BrowserTestUtils.withNewTab({ gBrowser, url: 'https://example.com/1' }, async (browser) => {
    const tab = gBrowser.getTabForBrowser(browser);
    tab.addEventListener(
      'ZenPinnedTabCreated',
      async function () {
        const pinTabID = tab.getAttribute('zen-pin-id');
        ok(pinTabID, 'The tab should have a zen-pin-id attribute after being pinned');

        await gZenPinnedTabManager.updatePinTitle(tab, customLabel, true);

        const pinnedTabs = await ZenPinnedTabsStorage.getPins();
        const pinObject = pinnedTabs.find((pin) => pin.uuid === pinTabID);
        Assert.equal(pinObject.title, customLabel, 'The pin object should have the correct title');

        await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/2', true);

        await UrlbarTestUtils.promiseAutocompleteResultPopup({
          window,
          value: customLabel,
          waitForFocus: SimpleTest.waitForFocus,
        });

        const total = UrlbarTestUtils.getResultCount(window);
        info(`Found ${total} matches`);

        const result = await UrlbarTestUtils.getDetailsOfResultAt(window, 1);

        const url = result?.url;
        Assert.equal(
          url,
          'https://example.com/1',
          `Should have the found result '${url}' in the expected list of entries`
        );
        Assert.equal(
          result?.title,
          customLabel,
          `Should have the found result '${result?.title}' in the expected list of entries`
        );

        BrowserTestUtils.removeTab(gBrowser.selectedTab);
        resolvePromise();
      },
      { once: true }
    );
    gBrowser.pinTab(tab);
    await promise;
  });
});
