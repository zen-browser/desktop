/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

async function openAndCloseGlance() {
  await openGlanceOnTab(async (glanceTab) => {
    ok(
      glanceTab.hasAttribute('zen-glance-tab'),
      'The glance tab should have the zen-glance-tab attribute'
    );
  });
}

add_task(async function test_Glance_Close_No_Tabs() {
  const currentTab = gBrowser.selectedTab;
  await openAndCloseGlance();
  Assert.equal(gBrowser.selectedTab, currentTab, 'The original tab should be selected');
  ok(currentTab.selected, 'The original tab should be visually selected');
});

add_task(async function test_Glance_Close_With_Next_Tab() {
  const originalTab = gBrowser.selectedTab;
  await BrowserTestUtils.withNewTab(
    { url: 'http://example.com', gBrowser, waitForLoad: false },
    async function () {
      const selectedTab = gBrowser.selectedTab;
      Assert.notEqual(selectedTab, originalTab, 'A new tab should be selected');
      await openAndCloseGlance();
      Assert.equal(gBrowser.selectedTab, selectedTab, 'The new tab should still be selected');
      ok(selectedTab.selected, 'The new tab should be visually selected');

      gBrowser.selectedTab = originalTab;
    }
  );
});
