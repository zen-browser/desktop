/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Restore_Closed_Tabs() {
  const tabsToIgnore = gBrowser.tabs;
  const selected = gBrowser.selectedTab;
  const tabsToClose = [];
  for (let i = 0; i < 3; i++) {
    const tab = await BrowserTestUtils.openNewForegroundTab(
      window.gBrowser,
      `data:text/html,<title>tab${i}</title>`,
      true,
      { skipAnimation: true }
    );
    tabsToClose.push(tab);
  }
  gBrowser.selectedTab = tabsToClose[1];
  await TabStateFlusher.flushWindow(window);
  Assert.equal(
    gBrowser.tabs.length,
    5, // 1 initial tab + 3 new tabs
    'There should be four tabs after opening three new tabs'
  );
  gBrowser.removeTabs(tabsToClose);
  gBrowser.selectedTab = selected;
  await TabStateFlusher.flushWindow(window);
  await new Promise((resolve) => {
    Assert.equal(
      gBrowser.selectedTab,
      selected,
      'Current tab should still be selected after closing tabs'
    );
    Assert.equal(gBrowser.tabs.length, 2, 'There should be one tab left after closing all tabs');
    SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
    ok(!selected.selected, 'Current tab should not be selected after restore');
    Assert.equal(
      gBrowser.tabs.length,
      4, // 3 restored tabs + 1 for empty tab
      'There should be four tabs after restoring closed tabs'
    );
    resolve();
  });
  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'about:blank', true, {
    skipAnimation: true,
  });
  for (const tab of gBrowser.tabs.filter((t) => !tabsToIgnore.includes(t))) {
    await BrowserTestUtils.removeTab(tab);
  }
});
