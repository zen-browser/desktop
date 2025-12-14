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
  gBrowser.pinTab(newTab);

  ok(newTab.pinned, 'The tab should be pinned after calling gBrowser.pinTab()');

  try {
    const pinObject = newTab.__zenPinnedInitialState;
    ok(pinObject, 'The pin object should exist in the ZenPinnedTabsStorage');
    Assert.equal(
      pinObject.entry.url,
      'https://example.com/',
      'The pin object should have the correct URL'
    );
  } catch (error) {
    ok(false, 'Error while checking the pin object in ZenPinnedTabsStorage: ' + error);
  }

  resolvePromise();

  await promise;
  await BrowserTestUtils.removeTab(newTab);
});
