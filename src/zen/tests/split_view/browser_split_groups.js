/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Basic_Split_Groups() {
  await basicSplitNTabs(async (tabs) => {
    ok(tabs[0].group.hasAttribute('split-view-group'), 'The first tab should be in a split group');
    Assert.equal(tabs[0].group.tabs.length, 2, 'The first split group should contain two tabs');
  });
});

add_task(async function test_Basic_Split_Groups_Pinning() {
  await basicSplitNTabs(async (tabs) => {
    const group = tabs[0].group;
    ok(group.hasAttribute('split-view-group'), 'The first tab should be in a split group');
    const pinEvent = BrowserTestUtils.waitForEvent(tabs[0], 'TabPinned');
    gBrowser.pinTab(tabs[0]);
    await pinEvent;
    for (const tab of tabs) {
      ok(tab.pinned, 'All tabs in the split group should be pinned after pinning the first tab');
      ok(
        tab.group === group,
        'All tabs in the split group should remain in the same group after pinning'
      );
    }
    ok(group.pinned, 'The split group should be pinned after pinning a tab');
    const unpinEvent = BrowserTestUtils.waitForEvent(tabs[0], 'TabUnpinned');
    gBrowser.unpinTab(tabs[0]);
    await unpinEvent;
    for (const tab of tabs) {
      ok(
        !tab.pinned,
        'All tabs in the split group should be unpinned after unpinning the first tab'
      );
      ok(
        tab.group === group,
        'All tabs in the split group should remain in the same group after unpinning'
      );
    }
    ok(!group.pinned, 'The split group should be unpinned after unpinning a tab');
  });
});

add_task(async function test_Basic_Unsplit_Group_Removed() {
  let group;
  await basicSplitNTabs(async (tabs) => {
    group = tabs[0].group;
  });
  ok(group, 'The split group should exist');
  ok(!group.parentNode, 'The split group should be removed from the DOM after unsplitting');
});
