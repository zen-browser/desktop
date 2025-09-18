/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Issue_() {
  const selectedTab = gBrowser.selectedTab;
  const tab1 = BrowserTestUtils.addTab(gBrowser, 'about:blank');
  const tab2 = BrowserTestUtils.addTab(gBrowser, 'about:blank');
  const folder = await gZenFolders.createFolder([tab1, tab2], {});

  gBrowser.selectedTab = tab2;

  gBrowser.addRangeToMultiSelectedTabs(tab1, tab2);
  ok(tab1.multiselected, 'Tab 1 should be multiselected');
  ok(tab2.multiselected, 'Tab 2 should be multiselected');
  Assert.equal(gBrowser.multiSelectedTabsCount, 2, 'There should be 2 multiselected tabs');
  await new Promise((resolve) => setTimeout(resolve, 0));

  const collapseEvent = BrowserTestUtils.waitForEvent(window, 'TabGroupCollapse');
  EventUtils.synthesizeMouseAtCenter(folder.labelElement, {});
  await collapseEvent;

  gBrowser.clearMultiSelectedTabs();
  gBrowser.selectedTab = selectedTab;

  Assert.equal(folder.activeTabs.length, 2, 'Folder should have 2 active tabs');

  ok(tab1.hasAttribute('folder-active'), 'Tab 1 should be in the active folder');
  ok(tab2.hasAttribute('folder-active'), 'Tab 2 should be in the active folder');

  EventUtils.synthesizeMouseAtCenter(folder.resetButton, {});

  await new Promise((resolve) =>
    setTimeout(() => {
      ok(!tab1.hasAttribute('folder-active'), 'Tab 1 should not be in the active folder');
      ok(!tab2.hasAttribute('folder-active'), 'Tab 2 should not be in the active folder');
      resolve();
    }, 100)
  );
  await removeFolder(folder);
});
