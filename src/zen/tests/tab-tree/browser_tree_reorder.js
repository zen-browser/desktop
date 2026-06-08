/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Dragging a branch onto a tab must nest the ROOT and keep the branch's
// internal hierarchy — it must NOT flatten the subtree to one level.
add_task(async function test_nest_branch_retains_hierarchy() {
  const target = await addNormalTab();
  const root = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(child, root);

  gZenTabTree.handleNestDrop([root, child], target);

  Assert.equal(gZenTabTree.getParent(root), target, "root nested under target");
  Assert.equal(
    gZenTabTree.getParent(child),
    root,
    "child stays under root (hierarchy retained, not flattened)"
  );
  Assert.equal(gZenTabTree.getLevel(root), 1, "root level 1");
  Assert.equal(gZenTabTree.getLevel(child), 2, "child level 2");

  await cleanupTabs(target, root, child);
});

// A reorder drop re-parents the dragged root from its new neighbor while
// keeping the root's own subtree intact.
add_task(async function test_reorder_branch_retains_hierarchy() {
  const p = await addNormalTab();
  const pchild = await addNormalTab();
  gZenTabTree.nestTab(pchild, p);

  const mover = await addNormalTab();
  const moverChild = await addNormalTab();
  gZenTabTree.nestTab(moverChild, mover);

  // Physically relocate the mover block to sit right after pchild (as if a
  // native reorder dropped it there), then run the tree-aware reorder fixup.
  pchild.after(mover);
  mover.after(moverChild);
  gBrowser.tabContainer._invalidateCachedTabs();
  gZenTabTree.handleReorderDrop([mover, moverChild]);

  Assert.equal(
    gZenTabTree.getParent(mover),
    p,
    "mover adopts the parent of the tab above it (p)"
  );
  Assert.equal(
    gZenTabTree.getParent(moverChild),
    mover,
    "moverChild stays under mover (subtree preserved)"
  );
  Assert.equal(gZenTabTree.getLevel(mover), 1, "mover level 1");
  Assert.equal(gZenTabTree.getLevel(moverChild), 2, "moverChild level 2");

  await cleanupTabs(p, pchild, mover, moverChild);
});

// reorderLevelRange reports the valid drop-level window, and handleReorderDropAt
// clamps the requested level into it: at most prev's child, no shallower than 0.
add_task(async function test_reorder_level_clamping() {
  const a = await addNormalTab();
  const b = await addNormalTab();
  gZenTabTree.nestTab(b, a); // a > b, b at level 1
  const c = await addNormalTab();

  const range = gZenTabTree.reorderLevelRange(b, null);
  Assert.equal(range.maxLevel, 2, "max level is prev's level + 1");
  Assert.equal(range.minLevel, 0, "min level is 0 when there is no next");

  // Request a level far above max → clamps to prev's child (level 2).
  gZenTabTree.handleReorderDropAt([c], b, 99);
  Assert.equal(
    gZenTabTree.getParent(c),
    b,
    "over-deep level clamps to prev's child"
  );
  Assert.equal(gZenTabTree.getLevel(c), 2, "c lands at the clamped level 2");

  // Level 0 drops at the root (un-nest), e.g. dragging below the whole list.
  gZenTabTree.handleReorderDropAt([c], b, 0);
  Assert.equal(gZenTabTree.getParent(c), null, "level 0 un-nests to the root");
  Assert.equal(gZenTabTree.getLevel(c), 0, "c sits at root level");

  await cleanupTabs(a, b, c);
});
