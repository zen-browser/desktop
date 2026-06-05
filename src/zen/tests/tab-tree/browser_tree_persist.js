/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_tree_state_in_tab_state() {
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(child, parent);
  gZenTabTree.setCollapsed(parent, true);

  await TabStateFlusher.flush(child.linkedBrowser);
  const state = JSON.parse(SessionStore.getTabState(child));

  Assert.equal(
    state.zenTreeParentId,
    parent.id,
    "child persists its parent id"
  );

  // Also persisted as restorable tab attributes, so they come back on undo-close
  // (Ctrl+Shift+T), which doesn't run restoreInitialTabData.
  Assert.equal(
    state.attributes?.["zen-tree-parent-id"],
    parent.id,
    "child persists its parent id as a restorable tab attribute"
  );

  await TabStateFlusher.flush(parent.linkedBrowser);
  const pstate = JSON.parse(SessionStore.getTabState(parent));
  Assert.ok(pstate.zenTreeCollapsed, "parent persists collapsed state");
  // zen-tree-collapsed is a boolean attribute (toggleAttribute stores ""), so
  // assert its presence in the restorable set rather than a value.
  Assert.ok(
    "zen-tree-collapsed" in (pstate.attributes || {}),
    "parent persists collapsed as a restorable tab attribute"
  );

  gZenTabTree.setCollapsed(parent, false);
  await cleanupTabs(parent, child);
});

// Closing a<-b<-c as one batch while d (deepest) survives: d un-nests to root
// (all its ancestors are gone) instead of clinging to a closing parent.
add_task(async function test_close_batch_promotes_survivor_to_root() {
  const a = await addNormalTab();
  const b = await addNormalTab();
  const c = await addNormalTab();
  const d = await addNormalTab();
  gZenTabTree.nestTab(b, a);
  gZenTabTree.nestTab(c, b);
  gZenTabTree.nestTab(d, c);

  const closings = [a, b, c].map(t => BrowserTestUtils.waitForTabClosing(t));
  gBrowser.removeTabs([a, b, c], { animate: false });
  await Promise.all(closings);

  Assert.equal(
    gZenTabTree.getParent(d),
    null,
    "surviving deepest tab promotes to root once its ancestors close"
  );
  Assert.equal(gZenTabTree.getLevel(d), 0, "survivor sits at root level");

  await cleanupTabs(d);
});

// Restoring tabs (undo-close) reapplies their persisted zen-tree-parent-id but
// leaves the live pointers flat; SSTabRestored must rebuild the hierarchy.
add_task(async function test_restore_rebuilds_tree_from_attributes() {
  const a = await addNormalTab();
  const b = await addNormalTab();
  const c = await addNormalTab();
  // Production assigns every tab a stable id (window-sync's TabOpen); give these
  // ones explicit ids so the parent-id attributes are non-empty and rebuild can
  // match them, mirroring a real restore.
  a.id = "zen-tree-restore-a";
  b.id = "zen-tree-restore-b";
  c.id = "zen-tree-restore-c";
  gZenTabTree.nestTab(b, a);
  gZenTabTree.nestTab(c, b);
  // The parent-id attributes survive (set by nestTab/reindex); simulate the
  // freshly-restored state where the live pointers haven't been reconnected.
  for (const t of [a, b, c]) {
    t._zenTreeParent = null;
  }
  Assert.equal(b.getAttribute("zen-tree-parent-id"), a.id, "b still has a's id");

  a.dispatchEvent(new CustomEvent("SSTabRestored", { bubbles: true }));
  await TestUtils.waitForCondition(
    () => gZenTabTree.getParent(c) === b && gZenTabTree.getParent(b) === a,
    "SSTabRestored rebuilds the parent pointers from the attributes"
  );

  Assert.equal(gZenTabTree.getParent(b), a, "b reconnects under a");
  Assert.equal(gZenTabTree.getParent(c), b, "c reconnects under b");
  Assert.equal(gZenTabTree.getLevel(c), 2, "c is two levels deep again");

  await cleanupTabs(a, b, c);
});

// End-to-end: a real Ctrl+Shift+T (undoCloseTab) brings a closed nested pair
// back nested, because zen-tree-parent-id rides along as a persisted tab
// attribute and the SSTabRestored rebuild reconnects the pointers.
add_task(async function test_undo_close_restores_nesting() {
  const mk = async name => {
    const t = BrowserTestUtils.addTab(
      gBrowser,
      `data:text/html,<title>${name}</title>`,
      { skipAnimation: true }
    );
    await BrowserTestUtils.browserLoaded(t.linkedBrowser);
    t.id = name;
    return t;
  };
  const parent = await mk("ztu-parent");
  const child = await mk("ztu-child");
  gZenTabTree.nestTab(child, parent);
  await TabStateFlusher.flush(parent.linkedBrowser);
  await TabStateFlusher.flush(child.linkedBrowser);

  const closings = [parent, child].map(t =>
    BrowserTestUtils.waitForTabClosing(t)
  );
  gBrowser.removeTabs([parent, child], { animate: false });
  await Promise.all(closings);

  const restored = [];
  for (let i = 0; i < 2; i++) {
    const t = SessionStore.undoCloseTab(window, 0);
    if (t) {
      restored.push(t);
    }
  }
  Assert.equal(restored.length, 2, "both closed tabs were restorable");

  // The persisted attributes ride back on the restored tabs through a real
  // undoCloseTab — this is what the old code lost. The child references its
  // parent by the stable zen-tree-id, which survives even though window-sync
  // reassigns the live id on restore.
  const restoredChild = restored.find(
    t => t.getAttribute("zen-tree-parent-id") === "ztu-parent"
  );
  Assert.ok(restoredChild, "restored child carries its zen-tree-parent-id");
  const restoredParent = restored.find(t => t !== restoredChild);
  Assert.equal(
    restoredParent.getAttribute("zen-tree-id"),
    "ztu-parent",
    "restored parent carries its stable zen-tree-id"
  );

  // The SSTabRestored rebuild reconnects the pointers on its own — no manual
  // id fix-up needed, because matching is by the persisted zen-tree-id.
  await TestUtils.waitForCondition(
    () => gZenTabTree.getParent(restoredChild) === restoredParent,
    "the restored child reconnects to its parent via zen-tree-id"
  );
  Assert.equal(
    gZenTabTree.getLevel(restoredChild),
    1,
    "restored child is nested one level deep, not flat"
  );

  await cleanupTabs(...restored);
});

// A restored child can land in the strip with an unrelated tab wedged between it
// and its parent. The rebuild must re-assert depth-first order so the branch is
// contiguous, not visually split by other tabs.
add_task(async function test_restore_reasserts_dfs_order() {
  const a = await addNormalTab();
  const b = await addNormalTab();
  const x = await addNormalTab(); // unrelated
  a.id = "zdom-a";
  b.id = "zdom-b";
  gZenTabTree.nestTab(b, a);

  // Simulate the post-undo-close layout: unrelated x is wedged between a and b
  // (b reinserted at a stale index) and b's live pointer isn't reconnected yet.
  a.after(x);
  gBrowser.tabContainer._invalidateCachedTabs();
  b._zenTreeParent = null;
  Assert.equal(x.previousElementSibling, a, "x starts wedged between a and b");

  a.dispatchEvent(new CustomEvent("SSTabRestored", { bubbles: true }));
  await TestUtils.waitForCondition(
    () => gZenTabTree.getParent(b) === a && b.previousElementSibling === a,
    "rebuild reconnects b and pulls it back to depth-first order after a"
  );

  Assert.equal(
    b.previousElementSibling,
    a,
    "b sits immediately after a; x is no longer wedged between them"
  );

  await cleanupTabs(a, b, x);
});
