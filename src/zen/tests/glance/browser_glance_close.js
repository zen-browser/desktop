/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Glance_Basic_Close() {
  const currentTab = gBrowser.selectedTab;
  await openGlanceOnTab(async (glanceTab) => {
    ok(
      currentTab.hasAttribute('glance-id'),
      'The glance tab should have the zen-glance-tab attribute'
    );
    await BrowserTestUtils.removeTab(glanceTab);
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
    ok(
      !currentTab.hasAttribute('glance-id'),
      'The glance tab should not have the zen-glance-tab attribute'
    );
    await BrowserTestUtils.removeTab(glanceTab);
  }, false);
});
