/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function makeSplit(...tabs) {
  const activated = BrowserTestUtils.waitForEvent(
    window,
    "ZenViewSplitter:SplitViewActivated"
  );
  gZenViewSplitter.splitTabs(tabs, "grid");
  await activated;
  await new Promise(resolve => setTimeout(resolve, 100));
  return tabs[0].group;
}

// A split group is one tree node: its inner tabs aren't independent nodes, and
// nesting it parents/indents the whole split as a single row.
add_task(async function test_split_group_nests_and_indents_as_one_node() {
  const parent = await addNormalTab();
  const a = await addNormalTab();
  const b = await addNormalTab();
  const group = await makeSplit(a, b);

  Assert.ok(
    group?.hasAttribute("split-view-group"),
    "a split-view group was formed"
  );
  Assert.equal(
    gZenTabTree.treeNodeFor(a),
    group,
    "a split tab resolves to its group node"
  );
  Assert.ok(gZenTabTree.isTreeEligible(group), "the split group is a tree node");
  Assert.ok(
    !gZenTabTree.isTreeEligible(a),
    "an inner split tab is not an independent node"
  );

  Assert.ok(gZenTabTree.nestTab(group, parent), "the split group nests");
  Assert.equal(
    gZenTabTree.getParent(group),
    parent,
    "the split group is parented to the tab"
  );
  Assert.equal(gZenTabTree.getLevel(group), 1, "the split group is at level 1");
  Assert.equal(
    group.style.getPropertyValue("--zen-folder-indent"),
    "14px",
    "the split group element is indented one step"
  );

  gZenTabTree.setCollapsed(parent, true);
  Assert.ok(
    group.hasAttribute("zen-tree-hidden"),
    "collapsing the parent hides the whole split node"
  );
  gZenTabTree.setCollapsed(parent, false);
  Assert.ok(
    !group.hasAttribute("zen-tree-hidden"),
    "expanding shows the split node again"
  );

  await cleanupTabs(a, b, parent);
});

// A split group can itself be a parent.
add_task(async function test_tab_nests_under_split_group() {
  const a = await addNormalTab();
  const b = await addNormalTab();
  const child = await addNormalTab();
  const group = await makeSplit(a, b);

  Assert.ok(
    gZenTabTree.nestTab(child, group),
    "a tab nests under the split group"
  );
  Assert.equal(
    gZenTabTree.getParent(child),
    group,
    "the child is parented to the split node"
  );
  Assert.equal(gZenTabTree.getLevel(child), 1, "the child sits at level 1");
  Assert.ok(
    group.hasAttribute("zen-tree-parent"),
    "the split group is marked as a parent"
  );
  Assert.ok(
    group.querySelector(":scope > .zen-tree-twisty"),
    "the split group renders a collapse twisty"
  );

  await cleanupTabs(a, b, child);
});

// Dissolving a nested split promotes its children to the split's parent.
add_task(async function test_unsplitting_promotes_children() {
  const root = await addNormalTab();
  const a = await addNormalTab();
  const b = await addNormalTab();
  const child = await addNormalTab();
  const group = await makeSplit(a, b);

  gZenTabTree.nestTab(group, root);
  gZenTabTree.nestTab(child, group);
  Assert.equal(
    gZenTabTree.getParent(child),
    group,
    "the child starts under the split node"
  );

  BrowserTestUtils.removeTab(b);
  await TestUtils.waitForCondition(
    () => gZenTabTree.getParent(child) === root,
    "the child promotes to the split's parent once the split dissolves"
  );
  Assert.equal(gZenTabTree.getParent(child), root, "child reparented to root");

  await cleanupTabs(a, child, root);
});
