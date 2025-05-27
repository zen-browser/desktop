/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Check_ScrollBox_Overflow() {
  const scrollbox = gZenWorkspaces.activeScrollbox;
  scrollbox.smoothScroll = false;
  const tabsToRemove = [];
  while (!scrollbox.overflowing) {
    await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true);
    tabsToRemove.push(gBrowser.selectedTab);
  }

  // An extra tab to ensure the scrollbox is overflowing
  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true);
  tabsToRemove.push(gBrowser.selectedTab);

  ok(scrollbox.overflowing, 'The scrollbox should be overflowing after opening enough tabs');

  ok(scrollbox.scrollPosition === 0, 'The scrollbox should be scrolled to the top');

  gBrowser.selectedTab = gBrowser.tabs[gBrowser.tabs.length - 1];
  await new Promise((resolve) => {
    setTimeout(() => {
      Assert.greater(scrollbox.scrollPosition, 0, 'The scrollbox should be scrolled to the bottom');
      resolve();
    }, 200);
  });

  gBrowser.selectedTab = gBrowser.visibleTabs[0];
  await new Promise((resolve) => {
    setTimeout(() => {
      // TODO: Use a real scroll position check instead of a hardcoded value
      Assert.less(scrollbox.scrollPosition, 60, 'The scrollbox should be scrolled to the top');
      resolve();
    }, 200);
  });

  for (const tab of tabsToRemove) {
    await BrowserTestUtils.removeTab(tab);
  }
});
