/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_tree_state_in_tab_state() {
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(child, parent);
  gZenTabTree.setCollapsed(parent, true);

  // Flush and read the persisted tab state for the child.
  await TabStateFlusher.flush(child.linkedBrowser);
  const state = JSON.parse(SessionStore.getTabState(child));

  Assert.equal(
    state.zenTreeParentId,
    parent.id,
    "child persists its parent id"
  );

  await TabStateFlusher.flush(parent.linkedBrowser);
  const pstate = JSON.parse(SessionStore.getTabState(parent));
  Assert.ok(pstate.zenTreeCollapsed, "parent persists collapsed state");

  gZenTabTree.setCollapsed(parent, false);
  await cleanupTabs(parent, child);
});
