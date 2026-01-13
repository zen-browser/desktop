/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Glance_Prev_Tab() {
  await openGlanceOnTab(async (glanceTab) => {
    await BrowserTestUtils.openNewForegroundTab(window.gBrowser, "https://example.com/", true, {
      skipAnimation: true,
    });
    const tabToCheck = gBrowser.selectedTab;
    gBrowser.selectedTab = glanceTab;
    gBrowser.tabContainer.advanceSelectedTab(-1);
    const prevTab = gBrowser.selectedTab;
    gBrowser.selectedTab = glanceTab;
    await new Promise((resolve) => {
      setTimeout(() => {
        Assert.equal(prevTab, tabToCheck, "Previous glance tab should equal");
        resolve();
      });
    });
    await BrowserTestUtils.removeTab(tabToCheck);
  });
});
