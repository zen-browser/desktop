/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_collapse_hides_descendants() {
  const parent = await addNormalTab();
  const child = await addNormalTab();
  const grandchild = await addNormalTab();
  gZenTabTree.nestTab(child, parent);
  gZenTabTree.nestTab(grandchild, child);

  gZenTabTree.setCollapsed(parent, true);
  ok(parent._zenTreeCollapsed, "parent flagged collapsed");
  ok(parent.hasAttribute("zen-tree-collapsed"), "collapsed attribute set");
  ok(child.hasAttribute("zen-tree-hidden"), "child hidden");
  ok(grandchild.hasAttribute("zen-tree-hidden"), "grandchild hidden");

  gZenTabTree.setCollapsed(parent, false);
  ok(!parent._zenTreeCollapsed, "parent expanded");
  ok(!child.hasAttribute("zen-tree-hidden"), "child shown");
  ok(!grandchild.hasAttribute("zen-tree-hidden"), "grandchild shown");

  await cleanupTabs(parent, child, grandchild);
});

add_task(async function test_collapse_moves_active_selection_to_ancestor() {
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(child, parent);

  gBrowser.selectedTab = child;
  gZenTabTree.setCollapsed(parent, true);
  Assert.equal(
    gBrowser.selectedTab,
    parent,
    "selection moved to nearest visible ancestor when active tab hidden"
  );

  gZenTabTree.setCollapsed(parent, false);
  await cleanupTabs(parent, child);
});

// Nested collapse: a descendant is hidden if ANY ancestor is collapsed, so
// expanding one level keeps a deeper collapsed branch hidden.
add_task(async function test_nested_collapse_partial_expand() {
  const a = await addNormalTab();
  const b = await addNormalTab();
  const c = await addNormalTab();
  gZenTabTree.nestTab(b, a); // a > b
  gZenTabTree.nestTab(c, b); // b > c

  gZenTabTree.toggleCollapse(b);
  ok(b._zenTreeCollapsed, "toggleCollapse collapses the inner node b");
  ok(!b.hasAttribute("zen-tree-hidden"), "b itself stays visible");
  ok(c.hasAttribute("zen-tree-hidden"), "c hides under collapsed b");

  gZenTabTree.toggleCollapse(a);
  ok(b.hasAttribute("zen-tree-hidden"), "b hides under collapsed a");

  gZenTabTree.toggleCollapse(a); // expand a only
  ok(!b.hasAttribute("zen-tree-hidden"), "b reappears when a expands");
  ok(c.hasAttribute("zen-tree-hidden"), "c stays hidden while b is collapsed");

  gZenTabTree.toggleCollapse(b); // expand b
  ok(!c.hasAttribute("zen-tree-hidden"), "c reappears when b expands");

  await cleanupTabs(a, b, c);
});
