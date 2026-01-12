/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Folder_Multiselected_Tabs() {
  const selectedTab = gBrowser.selectedTab;
  const tab1 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const tab2 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const folder = await gZenFolders.createFolder([tab1], {});

  gBrowser.addRangeToMultiSelectedTabs(tab1, tab2);
  ok(tab1.multiselected, "Tab 1 should be multiselected");
  ok(tab2.multiselected, "Tab 2 should be multiselected");
  Assert.greater(gBrowser.multiSelectedTabsCount, 1, "There should be 2 multiselected tabs");

  const collapseEvent = BrowserTestUtils.waitForEvent(window, "TabGroupCollapse");
  folder.collapsed = true;
  await collapseEvent;

  ok(tab2.multiselected, "Tab 2 should not be multiselected");
  Assert.equal(gBrowser.multiSelectedTabsCount, 3, "There should be 3 multiselected tabs");

  for (const t of [tab1, tab2]) {
    BrowserTestUtils.removeTab(t);
  }

  gBrowser.selectedTab = selectedTab;
  await removeFolder(folder);
});
