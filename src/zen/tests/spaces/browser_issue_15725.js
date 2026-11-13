/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_creation_form_workspace_cycle() {
  await gZenWorkspaces.promiseInitialized;
  const originalWorkspace = gZenWorkspaces.activeWorkspace;
  const originalSpaces = gZenWorkspaces.getWorkspaces();
  const addedSpaces = [];
  try {
    while (gZenWorkspaces.getWorkspaces().length < 3) {
      const space = await gZenWorkspaces.createAndSaveWorkspace("Swipe test");
      addedSpaces.push(space.uuid);
    }
    const spaces = gZenWorkspaces.getWorkspaces();
    for (const rightSide of [false, true]) {
      for (const wrap of [false, true]) {
        await SpecialPowers.pushPrefEnv({
          set: [
            ["zen.tabs.vertical.right-side", rightSide],
            ["zen.workspaces.wrap-around-navigation", wrap],
          ],
        });
        try {
          const origins = rightSide ? [0, 1] : [spaces.length - 1];
          for (const origin of origins) {
            for (const offset of [-1, 1]) {
              await gZenWorkspaces.changeWorkspace(spaces[origin]);
              await gZenWorkspaces.openWorkspaceCreation();
              const creationId = gZenWorkspaces.creatingWorkspaceId;
              Assert.ok(creationId, "The space creation form is open");
              let expectedIndex = origin;
              if (rightSide && offset === -1) {
                expectedIndex--;
              } else if (!rightSide && offset === 1) {
                expectedIndex++;
              }
              const atBoundary =
                expectedIndex < 0 || expectedIndex >= spaces.length;
              const expectedId =
                !wrap && atBoundary
                  ? creationId
                  : spaces[(expectedIndex + spaces.length) % spaces.length]
                      .uuid;
              await gZenWorkspaces.changeWorkspaceShortcut(offset, true);
              Assert.equal(
                gZenWorkspaces.activeWorkspace,
                expectedId,
                `Sidebar right=${rightSide}, wrap=${wrap}, origin=${origin}, offset=${offset}`
              );
              if (gZenWorkspaces.activeWorkspace === creationId) {
                await document
                  .querySelector("zen-workspace-creation")
                  .onCancelButtonCommand();
              }
              await TestUtils.waitForCondition(
                () => !gZenWorkspaces.getWorkspaceFromId(creationId),
                "Leaving the form removes its temporary space"
              );
              Assert.deepEqual(
                gZenWorkspaces.getWorkspaces().map(space => space.uuid),
                spaces.map(space => space.uuid),
                "Leaving the form preserves the existing space order"
              );
            }
          }
        } finally {
          const form = document.querySelector("zen-workspace-creation");
          if (form) {
            await form.onCancelButtonCommand();
          }
          await SpecialPowers.popPrefEnv();
        }
      }
    }
  } finally {
    await gZenWorkspaces.changeWorkspaceWithID(originalWorkspace);
    for (const id of addedSpaces) {
      await gZenWorkspaces.removeWorkspace(id);
    }
    Assert.deepEqual(
      gZenWorkspaces.getWorkspaces().map(space => space.uuid),
      originalSpaces.map(space => space.uuid),
      "The original spaces are restored"
    );
  }
});
