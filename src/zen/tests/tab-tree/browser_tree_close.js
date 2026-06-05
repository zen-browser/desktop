/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_close_parent_promotes_children() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.close-parent-behavior", "promote"]],
  });
  const grand = await addNormalTab();
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(parent, grand);
  gZenTabTree.nestTab(child, parent);

  BrowserTestUtils.removeTab(parent);
  await TestUtils.waitForCondition(() => !parent.isConnected);

  Assert.equal(
    gZenTabTree.getParent(child),
    grand,
    "child promoted to grandparent when parent closed"
  );

  await cleanupTabs(grand, child);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_close_parent_closes_subtree() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.close-parent-behavior", "close-subtree"]],
  });
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(child, parent);

  BrowserTestUtils.removeTab(parent);
  await TestUtils.waitForCondition(() => child.closing || !child.isConnected);
  ok(true, "descendants closed with the parent");

  await cleanupTabs(parent, child);
  await SpecialPowers.popPrefEnv();
});

// close-subtree recurses the whole branch, not just direct children.
add_task(async function test_close_subtree_closes_grandchildren() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.close-parent-behavior", "close-subtree"]],
  });
  const a = await addNormalTab();
  const b = await addNormalTab();
  const c = await addNormalTab();
  gZenTabTree.nestTab(b, a);
  gZenTabTree.nestTab(c, b);

  BrowserTestUtils.removeTab(a);
  await TestUtils.waitForCondition(
    () =>
      (b.closing || !b.isConnected) && (c.closing || !c.isConnected),
    "both the child and grandchild close with the subtree"
  );
  ok(true, "grandchild closed with the subtree");

  await cleanupTabs(a, b, c);
  await SpecialPowers.popPrefEnv();
});
