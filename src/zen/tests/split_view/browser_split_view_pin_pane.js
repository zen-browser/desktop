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
  ok(!anchor.group, "Anchored tab left the split tab group");
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
      .every(group => !group.tabs.includes(anchor.id)),
    "Pinned pair is not written to the session store"
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
