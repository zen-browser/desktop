/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Glance_Next_Tab() {
  const selectedTab = gBrowser.selectedTab;
  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true, {
    skipAnimation: true,
  });
  const tabToCheck = gBrowser.selectedTab;
  gBrowser.selectedTab = selectedTab;
  await openGlanceOnTab(async (glanceTab) => {
    const next = gBrowser.tabContainer.findNextTab(glanceTab, { direction: 1 });
    Assert.equal(next, tabToCheck, 'Next glance tab should equal');
  });
  await BrowserTestUtils.removeTab(gBrowser.selectedTab);
});
