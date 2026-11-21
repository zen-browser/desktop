/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function anchoredGroup() {
  return gZenViewSplitter._data.find(group => group.anchored);
}

async function selectAndWait(tab) {
  gBrowser.selectedTab = tab;
  await TestUtils.waitForTick();
}

add_task(async function test_Pinned_Pane_Follows_Tab_Switches() {
  const [anchor, first, second, third] = await Promise.all(
    [1, 2, 3, 4].map(i => addTabTo(gBrowser, getUrlForNthTab(i)))
  );
  await createSplitView([anchor, first], "vsep");

  gZenViewSplitter.toggleAnchoredTab(anchor);
  await TestUtils.waitForTick();

  Assert.equal(gZenViewSplitter._anchoredTab, anchor, "Anchor is set");
  ok(
    anchor.group?.hasAttribute("split-view-group") &&
      anchor.group === first.group,
    "Pinned pair is shown as a split group in the sidebar"
  );
  Assert.deepEqual(
    anchoredGroup()?.tabs,
    [anchor, first],
    "Anchor is paired with the other tab of the split"
  );

  await selectAndWait(second);
  ok(gZenViewSplitter.splitViewActive, "Split view stays active");
  Assert.deepEqual(
    anchoredGroup().tabs,
    [anchor, second],
    "Newly selected tab replaces the previous partner"
  );
  ok(!first.splitView, "Previous partner is no longer split");
  ok(!first.group, "Previous partner left the sidebar split group");
  Assert.equal(
    anchor.group,
    second.group,
    "Pinned tab moved into a split group with the new partner"
  );
  Assert.equal(
    document.querySelectorAll('.browserSidebarContainer[zen-split="true"]')
      .length,
    2,
    "Exactly two panels are shown"
  );

  await selectAndWait(third);
  Assert.deepEqual(
    anchoredGroup().tabs,
    [anchor, third],
    "Pairing follows every tab switch"
  );

  Assert.ok(
    gZenViewSplitter
      .storeDataForSessionStore()
      .some(
        group => group.tabs.includes(anchor.id) && group.tabs.includes(third.id)
      ),
    "Pinned pair is saved, so it comes back as a regular split"
  );

  // Closing the partner keeps the anchor around.
  await BrowserTestUtils.removeTab(third);
  await TestUtils.waitForTick();
  Assert.equal(gZenViewSplitter._anchoredTab, anchor, "Anchor survives");

  await selectAndWait(first);
  Assert.deepEqual(
    anchoredGroup().tabs,
    [anchor, first],
    "Anchor pairs again after its partner closed"
  );

  gZenViewSplitter.toggleAnchoredTab(anchor);
  await TestUtils.waitForTick();
  Assert.equal(gZenViewSplitter._anchoredTab, null, "Anchor is cleared");
  ok(!anchoredGroup(), "Pinned pair is gone");
  ok(gZenViewSplitter.splitViewActive, "The pair stays as a regular split");
  ok(
    anchor.group?.hasAttribute("split-view-group") &&
      anchor.group === first.group,
    "Both tabs are now in a regular split view group"
  );

  await selectAndWait(second);
  ok(!gZenViewSplitter.splitViewActive, "Switching tabs no longer pairs");

  for (const tab of [anchor, first, second]) {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_Closing_Anchor_Clears_It() {
  const [anchor, other] = await Promise.all(
    [1, 2].map(i => addTabTo(gBrowser, getUrlForNthTab(i)))
  );
  await createSplitView([anchor, other], "vsep");
  gZenViewSplitter.toggleAnchoredTab(anchor);
  await TestUtils.waitForTick();

  await BrowserTestUtils.removeTab(anchor);
  await TestUtils.waitForTick();
  Assert.equal(gZenViewSplitter._anchoredTab, null, "Anchor is cleared");
  ok(!anchoredGroup(), "No pinned pair is left behind");

  await BrowserTestUtils.removeTab(other);
});

add_task(async function test_Adding_Tab_Turns_Pair_Into_Split() {
  const [anchor, other, extra] = await Promise.all(
    [1, 2, 3].map(i => addTabTo(gBrowser, getUrlForNthTab(i)))
  );
  await createSplitView([anchor, other], "vsep");
  gZenViewSplitter.toggleAnchoredTab(anchor);
  await TestUtils.waitForTick();

  const group = gZenViewSplitter.splitTabs([other, extra]);
  ok(group && !group.anchored, "A regular split was created");
  Assert.equal(group.tabs.length, 3, "All three tabs are in the split");
  Assert.equal(gZenViewSplitter._anchoredTab, null, "Anchor is cleared");

  for (const tab of [anchor, other, extra]) {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_Unpin_Split_Out() {
  const [anchor, other] = await Promise.all(
    [1, 2].map(i => addTabTo(gBrowser, getUrlForNthTab(i)))
  );
  await createSplitView([anchor, other], "vsep");
  gZenViewSplitter.toggleAnchoredTab(anchor);
  await TestUtils.waitForTick();

  gZenViewSplitter.unpinAnchoredTab({ keepSplit: false });
  await TestUtils.waitForTick();
  Assert.equal(gZenViewSplitter._anchoredTab, null, "Anchor is cleared");
  ok(!gZenViewSplitter.splitViewActive, "No split view is left");
  ok(!anchor.splitView && !other.splitView, "Both tabs are split out");

  for (const tab of [anchor, other]) {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_Unpin_Keeps_Panel_Order() {
  const [left, right] = await Promise.all(
    [1, 2].map(i => addTabTo(gBrowser, getUrlForNthTab(i)))
  );
  await createSplitView([left, right], "vsep");
  gZenViewSplitter.toggleAnchoredTab(left);
  await TestUtils.waitForTick();

  gZenViewSplitter.unpinAnchoredTab();
  await TestUtils.waitForTick();
  const group = gZenViewSplitter._data[gZenViewSplitter.currentView];
  Assert.deepEqual(
    group.layoutTree.children.map(child => child.tab),
    [left, right],
    "Panels keep their sides after unpinning"
  );

  for (const tab of [left, right]) {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_Switch_Pin_Within_Pair() {
  const [left, right] = await Promise.all(
    [1, 2].map(i => addTabTo(gBrowser, getUrlForNthTab(i)))
  );
  await createSplitView([left, right], "vsep");
  gZenViewSplitter.toggleAnchoredTab(left);
  await TestUtils.waitForTick();
  const pair = anchoredGroup();

  gZenViewSplitter.toggleAnchoredTab(right);
  await TestUtils.waitForTick();
  Assert.equal(gZenViewSplitter._anchoredTab, right, "Pin moved");
  ok(!left.hasAttribute("zen-split-anchored"), "Old tab is no longer pinned");
  Assert.equal(anchoredGroup(), pair, "Same pair, nothing was unsplit");
  ok(gZenViewSplitter.splitViewActive, "Split view stays active");
  Assert.deepEqual(
    pair.layoutTree.children.map(child => child.tab),
    [left, right],
    "Panels keep their sides"
  );

  gZenViewSplitter.unpinAnchoredTab();
  for (const tab of [left, right]) {
    await BrowserTestUtils.removeTab(tab);
  }
});
