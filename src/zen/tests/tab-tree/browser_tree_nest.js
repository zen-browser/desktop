/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_nest_single_tab() {
  const parent = await addNormalTab();
  const child = await addNormalTab();

  gZenTabTree.nestTab(child, parent);

  Assert.equal(gZenTabTree.getParent(child), parent, "child re-parented");
  Assert.equal(gZenTabTree.getLevel(child), 1, "child is level 1");
  Assert.equal(
    parent.nextElementSibling,
    child,
    "child placed directly after parent in the strip"
  );

  await cleanupTabs(parent, child);
});

add_task(async function test_nest_moves_whole_subtree() {
  const parent = await addNormalTab();
  const mid = await addNormalTab();
  const leaf = await addNormalTab();
  gZenTabTree.nestTab(leaf, mid);

  const target = await addNormalTab();
  gZenTabTree.nestTab(mid, target);

  Assert.equal(gZenTabTree.getParent(mid), target, "mid re-parented to target");
  Assert.equal(gZenTabTree.getParent(leaf), mid, "leaf still child of mid");
  Assert.equal(gZenTabTree.getLevel(mid), 1, "mid level 1 under target");
  Assert.equal(gZenTabTree.getLevel(leaf), 2, "leaf level 2");
  Assert.deepEqual(
    domOrder([target, mid, leaf]),
    [target, mid, leaf],
    "subtree stays contiguous and ordered after target"
  );

  await cleanupTabs(parent, mid, leaf, target);
});
