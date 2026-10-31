/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Creates `count` spaces after the existing ones and switches to the first
 * of them. They are removed again when the test ends.
 *
 * @param {number} count
 * @returns {Promise<Array<object>>} The created spaces
 */
async function createTestSpaces(count) {
  const spaces = [];
  for (let i = 0; i < count; i++) {
    spaces.push(
      await gZenWorkspaces.createAndSaveWorkspace(`Archive Test ${i}`)
    );
  }
  await gZenWorkspaces.changeWorkspace(spaces[0]);
  registerCleanupFunction(async () => {
    for (const space of spaces) {
      if (gZenWorkspaces.getWorkspaceFromId(space.uuid)) {
        await gZenWorkspaces.removeWorkspace(space.uuid);
      }
    }
  });
  return spaces;
}

function visibleIds() {
  return gZenWorkspaces.getVisibleWorkspaces().map(w => w.uuid);
}
