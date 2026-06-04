/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Verify the handleNestDrop contract directly, without synthesizing native
// drag pixels.
add_task(async function test_drop_quick_nests_single() {
  const parent = await addNormalTab();
  const dragged = await addNormalTab();

  const handled = gZenTabTree.handleNestDrop([dragged], parent);

  ok(handled, "nest drop handled");
  Assert.equal(gZenTabTree.getParent(dragged), parent, "dragged nested");

  await cleanupTabs(parent, dragged);
});

add_task(async function test_drop_quick_nests_multiselection() {
  const parent = await addNormalTab();
  const a = await addNormalTab();
  const b = await addNormalTab();

  gZenTabTree.handleNestDrop([a, b], parent);

  Assert.equal(gZenTabTree.getParent(a), parent, "a nested as direct child");
  Assert.equal(gZenTabTree.getParent(b), parent, "b nested as direct child");
  Assert.equal(gZenTabTree.getLevel(a), 1, "a level 1");
  Assert.equal(gZenTabTree.getLevel(b), 1, "b level 1");

  await cleanupTabs(parent, a, b);
});
