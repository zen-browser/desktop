/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Glance_Next_Tab() {
  const tabToCheck = gBrowser.selectedTab;
  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, 'https://example.com/', true, {
    skipAnimation: true,
  });
  await openGlanceOnTab(async (glanceTab) => {
    gBrowser.tabContainer.advanceSelectedTab(1);
    const nextTab = gBrowser.selectedTab;
    gBrowser.selectedTab = glanceTab;
    await new Promise((resolve) => {
      setTimeout(() => {
        Assert.equal(nextTab, tabToCheck, 'Next glance tab should equal');
        resolve();
      });
    });
  });
  await BrowserTestUtils.removeTab(gBrowser.selectedTab);
});
