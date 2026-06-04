/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_pin_detaches_and_promotes_children() {
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(child, parent);

  gBrowser.pinTab(parent);
  await TestUtils.waitForCondition(() => parent.pinned);

  Assert.equal(gZenTabTree.getParent(parent), null, "pinned tab left the tree");
  Assert.equal(
    gZenTabTree.getParent(child),
    null,
    "orphaned child promoted to root"
  );

  gBrowser.unpinTab(parent);
  await cleanupTabs(parent, child);
});
