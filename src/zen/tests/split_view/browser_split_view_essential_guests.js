/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// An essential split with an ordinary tab joins the split as a guest: it
// stays in Essentials, is not duplicated, and keeps its page.

async function addEssential(n) {
  const tab = await addTabTo(gBrowser, getUrlForNthTab(n));
  gZenPinnedTabManager.addToEssentials(tab);
  ok(tab.hasAttribute("zen-essential"), "The tab is an essential");
  return tab;
}

async function cleanUp(tabs) {
  for (const tab of tabs) {
    if (!tab.closing && tab.isConnected) {
      await BrowserTestUtils.removeTab(tab);
    }
  }
}

add_task(async function test_essential_joins_as_guest() {
  const essential = await addEssential(1);
  const member = await addTabTo(gBrowser, getUrlForNthTab(2));
  const tabCount = gBrowser.tabs.length;
  const innerWindowID = essential.linkedBrowser.innerWindowID;

  await createSplitView([essential, member], "vsep");

  Assert.equal(gBrowser.tabs.length, tabCount, "No tab was duplicated");
  const split = gZenViewSplitter.getSplitForTab(essential);
  ok(split, "The essential is in a split");
  Assert.strictEqual(
    gZenViewSplitter.getSplitForTab(member),
    split,
    "Both tabs are in the same split"
  );
  ok(essential.hasAttribute("zen-essential"), "It is still an essential");
  ok(!essential.group, "The guest is not in the split's tab group");
  Assert.strictEqual(
    gZenViewSplitter.getMemberGroup(split),
    member.group,
    "The member is in the split's tab group"
  );
  Assert.equal(
    essential.linkedBrowser.innerWindowID,
    innerWindowID,
    "The essential kept its page"
  );

  await cleanUp([member, essential]);
});

add_task(async function test_split_with_guest_survives_restore() {
  const essential = await addEssential(1);
  const member = await addTabTo(gBrowser, getUrlForNthTab(2));
  await createSplitView([essential, member], "vsep");

  const data = gZenViewSplitter.storeDataForSessionStore();
  const saved = data.find(entry => entry.tabs.includes(essential.id));
  ok(saved, "The saved split lists the guest");

  // Forget the split but keep its tab group, as a restart would: tabs come
  // back without split state, groups come back from the session.
  gZenViewSplitter.deactivateCurrentSplitView();
  const split = gZenViewSplitter.getSplitForTab(essential);
  gZenViewSplitter._data.splice(gZenViewSplitter._data.indexOf(split), 1);
  for (const tab of split.tabs) {
    gZenViewSplitter.resetTabState(tab, true);
  }
  ok(!gZenViewSplitter.getSplitForTab(essential), "The split is forgotten");

  gZenViewSplitter.restoreDataFromSessionStore([saved]);
  const restored = gZenViewSplitter.getSplitForTab(essential);
  ok(restored, "The guest is back in the restored split");
  ok(restored.tabs.includes(member), "So is the member");
  ok(essential.hasAttribute("zen-essential"), "It is still an essential");

  await cleanUp([member, essential]);
});

add_task(async function test_last_member_leaving_dissolves_split() {
  const essential1 = await addEssential(1);
  const essential2 = await addEssential(2);
  const member = await addTabTo(gBrowser, getUrlForNthTab(3));
  await createSplitView([essential1, essential2, member], "vsep");
  const tabCount = gBrowser.tabs.length;

  await BrowserTestUtils.removeTab(member);

  ok(
    !gZenViewSplitter.getSplitForTab(essential1) &&
      !gZenViewSplitter.getSplitForTab(essential2),
    "Guests alone don't keep the split"
  );
  Assert.equal(
    gBrowser.tabs.length,
    tabCount - 1,
    "Only the member closed; the guests were not duplicated"
  );
  for (const essential of [essential1, essential2]) {
    ok(essential.hasAttribute("zen-essential"), "Guest is still an essential");
    ok(!essential.splitView, "Guest is no longer marked as split");
  }

  await cleanUp([essential1, essential2]);
});

add_task(async function test_guest_leaves_split_when_removed_from_essentials() {
  const essential = await addEssential(1);
  const member1 = await addTabTo(gBrowser, getUrlForNthTab(2));
  const member2 = await addTabTo(gBrowser, getUrlForNthTab(3));
  await createSplitView([essential, member1, member2], "vsep");

  gZenPinnedTabManager.removeEssentials(essential);

  ok(
    !gZenViewSplitter.getSplitForTab(essential),
    "The former essential left the split"
  );
  const split = gZenViewSplitter.getSplitForTab(member1);
  ok(split, "The members' split remains");
  Assert.equal(split.tabs.length, 2, "With just the two members");

  await cleanUp([member1, member2, essential]);
});

add_task(async function test_guest_shown_alone_outside_its_space() {
  const essential = await addEssential(1);
  const member = await addTabTo(gBrowser, getUrlForNthTab(2));
  await createSplitView([essential, member], "vsep");
  const firstSpace = gZenWorkspaces.activeWorkspace;

  // Creating a space also switches to it.
  const secondSpace =
    await gZenWorkspaces.createAndSaveWorkspace("Guest Split Space");
  gBrowser.selectedTab = essential;

  Assert.equal(
    gZenWorkspaces.activeWorkspace,
    secondSpace.uuid,
    "Selecting the essential did not switch spaces"
  );
  Assert.equal(
    gZenViewSplitter.currentView,
    -1,
    "Its split is not shown in another space"
  );
  ok(
    !essential.linkedBrowser
      .closest(".browserSidebarContainer")
      .hasAttribute("is-zen-split"),
    "The essential is shown as a single tab"
  );
  ok(gZenViewSplitter.getSplitForTab(essential), "It is still in its split");

  await gZenWorkspaces.changeWorkspace(
    gZenWorkspaces.getWorkspaceFromId(firstSpace)
  );
  await gZenWorkspaces.removeWorkspace(secondSpace.uuid);
  await cleanUp([member, essential]);
});
