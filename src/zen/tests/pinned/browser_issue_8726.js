/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

const { TabStateFlusher } = ChromeUtils.importESModule(
  'resource:///modules/sessionstore/TabStateFlusher.sys.mjs'
);

add_task(async function test_Restore_Pinned_Tab() {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: 'https://example.com/',
    },
    async function (browser) {
      let tab = gBrowser.getTabForBrowser(browser);
      gBrowser.pinTab(tab);
      ok(tab.pinned, 'The tab should be pinned after being created');
      await BrowserTestUtils.removeTab(tab);
      await TabStateFlusher.flushWindow(window);
      SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
      tab = gBrowser.selectedTab;
      ok(tab.pinned, 'The tab should be pinned after restore');
      ok(
        tab.parentElement.closest('.zen-workspace-pinned-tabs-section'),
        'The tab should be in the pinned tabs section after restore'
      );
      await BrowserTestUtils.removeTab(tab);
    }
  );
});

add_task(async function test_Restore_Essential_Tab() {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: 'https://example.com/',
    },
    async function (browser) {
      let tab = gBrowser.getTabForBrowser(browser);
      gZenPinnedTabManager.addToEssentials(tab);
      ok(
        tab.hasAttribute('zen-essential'),
        'The tab should be marked as essential after being created'
      );
      await BrowserTestUtils.removeTab(tab);
      await TabStateFlusher.flushWindow(window);
      SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
      tab = gBrowser.selectedTab;
      ok(tab.hasAttribute('zen-essential'), 'The tab should be marked as essential after restore');
      ok(
        tab.parentElement.closest('.zen-essentials-container'),
        'The tab should be in the essentials tabs section after restore'
      );
      await BrowserTestUtils.removeTab(tab);
    }
  );
});
