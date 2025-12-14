/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Pinned_To_Essential() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true);

  const newTab = gBrowser.selectedTab;
  gBrowser.pinTab(newTab);

  ok(newTab.pinned, 'The tab should be pinned after calling gBrowser.pinTab()');

  gZenPinnedTabManager.addToEssentials(newTab);
  ok(
    newTab.hasAttribute('zen-essential') && newTab.parentNode.getAttribute('container') == '0',
    'New tab should be marked as essential.'
  );

  resolvePromise();

  await promise;
  await BrowserTestUtils.removeTab(newTab);
});
