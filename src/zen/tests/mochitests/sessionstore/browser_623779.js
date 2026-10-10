"use strict";

add_task(async function () {
  gBrowser.pinTab(gBrowser.selectedTab);

  let newTab = gBrowser.duplicateTab(gBrowser.selectedTab);
  await promiseTabRestored(newTab);

  ok(!newTab.pinned, "duplicating a pinned tab creates unpinned tab");
  BrowserTestUtils.removeTab(newTab);

  gBrowser.unpinTab(gBrowser.selectedTab);
});
