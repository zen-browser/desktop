/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_eligibility_and_level() {
  const a = await addNormalTab();
  const b = await addNormalTab();

  ok(gZenTabTree.isTreeEligible(a), "normal tab is tree-eligible");
  Assert.equal(gZenTabTree.getLevel(a), 0, "root tab is level 0");
  Assert.deepEqual(gZenTabTree.getChildren(a), [], "no children initially");

  // Manually wire a parent pointer to exercise level/children derivation.
  b._zenTreeParent = a;
  gZenTabTree.reindex(a);

  Assert.equal(gZenTabTree.getLevel(b), 1, "child tab is level 1");
  Assert.deepEqual(gZenTabTree.getChildren(a), [b], "a has child b");
  Assert.deepEqual(gZenTabTree.getDescendants(a), [b], "a has descendant b");
  Assert.equal(
    b.style.getPropertyValue("--zen-folder-indent"),
    "14px",
    "child indent is one level (14px)"
  );

  b._zenTreeParent = null;
  await cleanupTabs(a, b);
});
