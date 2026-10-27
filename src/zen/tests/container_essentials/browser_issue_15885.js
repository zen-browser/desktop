/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Regression test for https://github.com/zen-browser/desktop/issues/15885.
//
// A container-specific essential can end up tagged with a userContextId
// that no local workspace claims as its own default container -- for
// example a container-specific essential synced in from another device
// ahead of (or without) its matching workspace/space record, or a
// workspace whose container was removed while its essentials were kept.
// Before this fix, every place that decides whether an essentials section
// should be visible (getEssentialsSection, _organizeWorkspaceStripLocations)
// hid such an "orphaned" section in literally every workspace, with no
// fallback, so the essential simply vanished from the UI. Its <tab> was
// never removed though, so it kept counting against the shared Essentials
// cap used by canEssentialBeAdded/_numZenEssentials -- which is how
// unrelated sites could show up greyed out in "Add to Essentials" with
// nothing visibly using up the slots.
add_task(async function test_OrphanedContainerEssentialFallsBackToDefault() {
  const defaultWorkspace = gZenWorkspaces.getActiveWorkspace();
  Assert.strictEqual(
    defaultWorkspace.containerTabId,
    0,
    "Precondition: the active workspace has no default container"
  );

  // Simulate an essential tied to a container that no local workspace owns.
  const orphanContainerId = 987654;
  const orphanTab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
    userContextId: orphanContainerId,
  });
  gZenPinnedTabManager.addToEssentials(orphanTab, { replicating: true });
  const orphanSection = orphanTab.parentNode;

  ok(
    orphanTab.hasAttribute("zen-essential"),
    "The tab should be marked essential"
  );
  ok(
    BrowserTestUtils.isVisible(orphanSection),
    "An essential whose container has no workspace of its own should fall " +
      "back to showing in the container-less workspace instead of " +
      "disappearing from every workspace"
  );

  // A workspace that legitimately owns a *different* container must still
  // hide the orphan's section -- the fallback must not leak across
  // unrelated containers.
  await gZenWorkspaces.createAndSaveWorkspace(
    "Container Profile 2",
    undefined,
    false,
    1
  );
  const containerWorkspace = gZenWorkspaces.getActiveWorkspace();
  await gZenWorkspaces.changeWorkspace(containerWorkspace);
  Assert.strictEqual(
    containerWorkspace.containerTabId,
    1,
    "Precondition: the new workspace owns container 1"
  );
  ok(
    BrowserTestUtils.isHidden(orphanSection),
    "The orphan's section must stay hidden in a workspace with its own, " +
      "different container"
  );

  await gZenWorkspaces.changeWorkspace(defaultWorkspace);
  await gZenWorkspaces.removeWorkspace(containerWorkspace.uuid);
  ok(
    BrowserTestUtils.isVisible(orphanSection),
    "Switching back to the container-less workspace should show the " +
      "orphan's section again"
  );

  gZenPinnedTabManager.removeEssentials(orphanTab);
  await BrowserTestUtils.removeTab(orphanTab);
});
