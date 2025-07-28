/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Basic_Split_View_Duplication() {
  const [normal, pinned] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
  ]);
  const pinEvent = BrowserTestUtils.waitForEvent(pinned, 'TabPinned');
  gBrowser.pinTab(pinned);
  await pinEvent;
  Assert.ok(
    gBrowser.tabs.length === 4, // empty + initial + 2 split tabs
    'There should be four tabs after pinning the second tab'
  );
  await createSplitView([normal, pinned], 'grid');
  ok(!pinned.group, 'The pinned tab should not be in a split group after duplication');
  ok(
    normal.group.hasAttribute('split-view-group'),
    'The normal tab should be in a split group after duplication'
  );
  const group = normal.group;
  for (const tab of group.tabs) {
    Assert.ok(!tab.pinned, 'All tabs in the split group should not be pinned after duplication');
    Assert.ok(
      tab.splitView,
      'All tabs in the split group should be in a split view after duplication'
    );
  }
  Assert.ok(!group.pinned, 'The split group should not be pinned after duplication');
  for (const tab of [pinned, ...group.tabs]) {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_Split_View_Duplication_Both_Pinned() {
  const [tab1, tab2] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
  ]);
  const pinEvent1 = BrowserTestUtils.waitForEvent(tab1, 'TabPinned');
  const pinEvent2 = BrowserTestUtils.waitForEvent(tab2, 'TabPinned');
  gBrowser.pinTab(tab1);
  gBrowser.pinTab(tab2);
  await Promise.all([pinEvent1, pinEvent2]);
  Assert.ok(
    gBrowser.tabs.length === 4, // empty + initial + 2 split tabs
    'There should be four tabs after pinning both tabs'
  );
  await createSplitView([tab1, tab2], 'grid');
  ok(tab1.group, 'The first pinned tab should be in a split group after duplication');
  ok(
    tab2.group === tab1.group,
    'The second pinned tab should be in the same split group after duplication'
  );
  Assert.equal(
    gBrowser.tabs.length,
    4,
    'There should not be any duplicate tabs after pinning both tabs'
  );
  for (const tab of tab1.group.tabs) {
    Assert.ok(tab.pinned, 'All tabs in the split group should be pinned after duplication');
    Assert.ok(
      tab.splitView,
      'All tabs in the split group should be in a split view after duplication'
    );
  }
  Assert.ok(tab1.group.pinned, 'The split group should be pinned after duplication of both tabs');
  for (const tab of tab1.group.tabs) {
    await BrowserTestUtils.removeTab(tab);
  }
  await BrowserTestUtils.removeTab(tab2);
  await BrowserTestUtils.removeTab(tab1);
});

add_task(async function test_Split_View_Duplication_Pinned_Essential() {
  const existingTabs = gBrowser.tabs;
  const [pinned, essential] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
  ]);
  const pinEvent = BrowserTestUtils.waitForEvent(pinned, 'TabPinned');
  gBrowser.pinTab(pinned);
  await pinEvent;
  gZenPinnedTabManager.addToEssentials(essential);
  Assert.ok(
    gBrowser.tabs.length === 4, // empty + initial + 2 split tabs
    'There should be four tabs after pinning the first tab and adding the second to essentials'
  );
  await createSplitView([pinned, essential], 'grid');
  ok(
    gBrowser.tabs.length === 4 + 2,
    'There should be six tabs after creating a split view with the pinned and essential tabs'
  );
  ok(
    !pinned.group,
    'The pinned tab should not be in a split group after duplication with an essential tab'
  );
  ok(
    !essential.group,
    'The essential tab should not be in a split group after duplication with a pinned tab'
  );
  for (const tab of gBrowser.tabs) {
    if (existingTabs.includes(tab)) {
      continue; // Skip if the tab was already present before the test
    }
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_Split_View_Duplication_Essential() {
  const existingTabs = gBrowser.tabs;
  const essentials = await Promise.all(
    [...Array(2)].map((_, i) => addTabTo(gBrowser, getUrlForNthTab(i + 1)))
  );
  essentials.forEach((tab) => {
    gZenPinnedTabManager.addToEssentials(tab);
  });
  ok(
    gBrowser.tabs.length === 4, // empty + initial + 2 essential tabs
    'There should be four tabs after adding two essential tabs'
  );
  await createSplitView(essentials, 'grid');
  ok(
    gBrowser.tabs.length === 4 + 2,
    'There should be six tabs after creating a split view with two essential tabs'
  );
  for (const tab of essentials) {
    ok(!tab.group, 'Each essential tab should not be in a split group after duplication');
    ok(!tab.splitView, 'Each essential tab should not be in a split view after duplication');
  }
  for (const tab of gBrowser.tabs) {
    if (existingTabs.includes(tab)) {
      continue; // Skip if the tab was already present before the test
    }
    await BrowserTestUtils.removeTab(tab);
  }
});
