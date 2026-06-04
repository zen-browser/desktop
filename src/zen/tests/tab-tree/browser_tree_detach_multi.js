/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_promote_subtree_to_root() {
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(child, parent);

  gZenTabTree.detachTab(child);
  Assert.equal(gZenTabTree.getParent(child), null, "child detached to root");
  Assert.equal(gZenTabTree.getLevel(child), 0, "detached child is level 0");

  await cleanupTabs(parent, child);
});

add_task(async function test_nest_multiselection_one_level() {
  const target = await addNormalTab();
  const s1 = await addNormalTab();
  const s2 = await addNormalTab();
  const s2child = await addNormalTab();
  gZenTabTree.nestTab(s2child, s2);

  gZenTabTree.nestTabsAsChildren([s1, s2], target);

  Assert.equal(gZenTabTree.getParent(s1), target, "s1 is direct child");
  Assert.equal(gZenTabTree.getParent(s2), target, "s2 is direct child");
  Assert.equal(gZenTabTree.getLevel(s1), 1, "s1 level 1");
  Assert.equal(gZenTabTree.getLevel(s2), 1, "s2 level 1");
  Assert.equal(gZenTabTree.getParent(s2child), s2, "s2's subtree followed it");
  Assert.equal(gZenTabTree.getLevel(s2child), 2, "s2child level 2");

  await cleanupTabs(target, s1, s2, s2child);
});
