/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// A tab created in one space and then added to a tab group that lives in
// another space (what an extension's tabs.group() does while the user is in a
// different space) must take the group's space. Otherwise selecting it from
// the group switches to the tab's old space, where it isn't shown.
add_task(async function test_tab_grouped_into_other_space_takes_group_space() {
  const spaceA = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Grouped tab space B");
  const spaceB = gZenWorkspaces
    .getWorkspaces()
    .find(space => space.uuid !== spaceA).uuid;
  await gZenWorkspaces.changeWorkspaceWithID(spaceA);

  const first = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  const group = gBrowser.addTabGroup([first], {
    insertBefore: first,
    label: "Agent",
  });
  Assert.equal(
    first.getAttribute("zen-workspace-id"),
    spaceA,
    "The first tab is in space A"
  );

  await gZenWorkspaces.changeWorkspaceWithID(spaceB);
  const second = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  Assert.equal(
    second.getAttribute("zen-workspace-id"),
    spaceB,
    "A tab opened while in space B starts in space B"
  );

  group.addTabs([second]);
  Assert.equal(second.group, group, "The second tab joined the group");
  Assert.equal(
    second.getAttribute("zen-workspace-id"),
    spaceA,
    "The grouped tab takes the space of its group"
  );

  await gZenWorkspaces.changeWorkspaceWithID(spaceA);
  gBrowser.selectedTab = second;
  Assert.equal(
    gBrowser.selectedTab,
    second,
    "Selecting the grouped tab from space A keeps it selected"
  );
  Assert.equal(
    gZenWorkspaces.activeWorkspace,
    spaceA,
    "Selecting it does not switch spaces"
  );

  BrowserTestUtils.removeTab(first);
  BrowserTestUtils.removeTab(second);
  await gZenWorkspaces.removeWorkspace(spaceB);
});
