/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_depth_clamp_flattens_deepest_first() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.tab-tree.max-depth", 2]] });

  // Build a chain a > b > c > d (would be levels 0,1,2,3).
  const a = await addNormalTab();
  const b = await addNormalTab();
  const c = await addNormalTab();
  const d = await addNormalTab();
  gZenTabTree.nestTab(b, a);
  gZenTabTree.nestTab(c, b);
  gZenTabTree.nestTab(d, c); // d would be level 3 > max 2

  Assert.equal(gZenTabTree.getLevel(a), 0, "a level 0");
  Assert.equal(gZenTabTree.getLevel(b), 1, "b level 1");
  Assert.equal(gZenTabTree.getLevel(c), 2, "c clamped at level 2");
  Assert.equal(
    gZenTabTree.getLevel(d),
    2,
    "d flattened up to the cap (level 2)"
  );
  Assert.equal(
    gZenTabTree.getParent(d),
    b,
    "d re-parented to the node at max-depth-1 (b)"
  );

  await cleanupTabs(a, b, c, d);
  await SpecialPowers.popPrefEnv();
});
