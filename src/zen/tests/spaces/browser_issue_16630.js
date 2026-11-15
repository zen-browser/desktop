/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_right_side_created_space_persists_on_switch() {
  await gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tabs.vertical.right-side", true]],
  });

  const initialSpaces = gZenWorkspaces.getWorkspaces();
  const originalSpace = initialSpaces[0];
  await gZenWorkspaces.changeWorkspace(originalSpace);

  let createdWorkspaceId = null;
  try {
    await gZenWorkspaces.openWorkspaceCreation();
    const creationEl = await TestUtils.waitForCondition(
      () => document.querySelector("zen-workspace-creation"),
      "Workspace creation UI should appear"
    );
    await creationEl.promiseInitialized;

    createdWorkspaceId = gZenWorkspaces.activeWorkspace;
    Assert.notStrictEqual(
      createdWorkspaceId,
      originalSpace.uuid,
      "Creating a space should activate the new workspace"
    );

    creationEl.inputName.value = "Right Side Space";
    creationEl.inputName.dispatchEvent(new Event("input", { bubbles: true }));
    Assert.ok(
      !creationEl.createButton.disabled,
      "Create button should be enabled after entering a space name"
    );

    creationEl.createButton.doCommand();

    await TestUtils.waitForCondition(
      () =>
        !document.querySelector("zen-workspace-creation") &&
        !gZenWorkspaces.creatingWorkspaceId,
      "Workspace creation UI should finish cleaning up after confirmation"
    );

    const tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
    });
    ok(tab, "New tab should open in the created space");

    // Switch away and back; previously an orphaned change listener removed the
    // newly confirmed space on the first switch when the sidebar was on the right.
    await gZenWorkspaces.changeWorkspace(originalSpace);
    Assert.ok(
      gZenWorkspaces.getWorkspaces().some(w => w.uuid === createdWorkspaceId),
      "Confirmed workspace should not be deleted when switching to another space"
    );
    Assert.ok(
      tab.isConnected,
      "Tabs belonging to the confirmed workspace should remain intact"
    );

    await gZenWorkspaces.changeWorkspaceWithID(createdWorkspaceId);
    Assert.strictEqual(
      gZenWorkspaces.activeWorkspace,
      createdWorkspaceId,
      "Confirmed workspace should remain selectable on subsequent switches"
    );
    Assert.strictEqual(
      gZenWorkspaces.getActiveWorkspace().name,
      "Right Side Space",
      "Confirmed workspace name should be preserved"
    );
  } finally {
    await gZenWorkspaces.changeWorkspace(originalSpace);
    if (
      createdWorkspaceId &&
      gZenWorkspaces.getWorkspaces().some(w => w.uuid === createdWorkspaceId)
    ) {
      await gZenWorkspaces.removeWorkspace(createdWorkspaceId);
    }
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_right_side_unconfirmed_space_removed_on_switch() {
  await gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tabs.vertical.right-side", true]],
  });

  const originalSpace = gZenWorkspaces.getWorkspaces()[0];
  await gZenWorkspaces.changeWorkspace(originalSpace);

  let tempWorkspaceId = null;
  try {
    await gZenWorkspaces.openWorkspaceCreation();
    const creationEl = await TestUtils.waitForCondition(
      () => document.querySelector("zen-workspace-creation"),
      "Workspace creation UI should appear"
    );
    await creationEl.promiseInitialized;

    tempWorkspaceId = gZenWorkspaces.activeWorkspace;
    Assert.notStrictEqual(
      tempWorkspaceId,
      originalSpace.uuid,
      "Unconfirmed creation UI should occupy a temporary workspace"
    );

    await gZenWorkspaces.changeWorkspace(originalSpace);
    await TestUtils.waitForCondition(
      () =>
        !document.querySelector("zen-workspace-creation") &&
        !gZenWorkspaces.getWorkspaces().some(w => w.uuid === tempWorkspaceId),
      "Switching away without confirming should still remove the temporary workspace"
    );
  } finally {
    await gZenWorkspaces.changeWorkspace(originalSpace);
    if (
      tempWorkspaceId &&
      gZenWorkspaces.getWorkspaces().some(w => w.uuid === tempWorkspaceId)
    ) {
      await gZenWorkspaces.removeWorkspace(tempWorkspaceId);
    }
    await SpecialPowers.popPrefEnv();
  }
});
