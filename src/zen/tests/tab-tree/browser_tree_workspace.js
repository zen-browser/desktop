/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Nesting and opener-nesting only work within a workspace: a tab can't become a
// child of a tab in a different workspace.
add_task(async function test_nest_rejected_across_workspaces() {
  const parent = await addNormalTab();
  const child = await addNormalTab();
  parent.setAttribute("zen-workspace-id", "ws-A");
  child.setAttribute("zen-workspace-id", "ws-B");

  Assert.ok(
    !gZenTabTree.nestTab(child, parent),
    "nestTab is rejected across workspaces"
  );
  Assert.equal(
    gZenTabTree.getParent(child),
    null,
    "the child stays un-nested"
  );

  child.setAttribute("zen-workspace-id", "ws-A");
  Assert.ok(
    gZenTabTree.nestTab(child, parent),
    "nestTab is allowed within the same workspace"
  );
  Assert.equal(gZenTabTree.getParent(child), parent, "the child nests");

  child._zenTreeParent = null;
  await cleanupTabs(parent, child);
});
