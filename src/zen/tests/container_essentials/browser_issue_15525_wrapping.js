/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/* import-globals-from swipe_test_utils.js */
Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "swipe_test_utils.js",
  this
);

add_task(async function test_wrapping_and_shared_container() {
  await withWorkspaces(
    async ({ win, ws, first, last, createWorkspace }) => {
      for (const [workspace, offset, destination] of [
        [first, -1, last],
        [last, 1, first],
      ]) {
        await ws.changeWorkspace(workspace);
        const gesture = gestureForOffset(win, offset);
        startSwipe(win, gesture);
        Assert.notStrictEqual(
          ws.workspaceElement(workspace.uuid).style.transform,
          "translateX(0%)",
          "Wrapping still permits boundary movement"
        );
        ok(
          !essentialsSection(win, destination.containerTabId).hidden,
          "Wrapping previews the opposite Essentials"
        );
        await finishSwipe(win, gesture, destination);
        assertResting(win, destination);
      }
      const shared = await createWorkspace(last.containerTabId);
      await ws.changeWorkspace(last);
      ws._organizeWorkspaceStripLocations(last, true, 40);
      ok(
        essentialsSection(win, last.containerTabId).style.transform,
        "Previewing a different container moves Essentials"
      );
      ws._organizeWorkspaceStripLocations(last, true, -40);
      is(
        essentialsSection(win, last.containerTabId).style.transform,
        "",
        "Reversing toward a shared container clears the previous offset"
      );
      startSwipe(win, gestureForOffset(win, 1));
      is(
        essentialsSection(win, last.containerTabId).style.transform,
        "",
        "Neighboring spaces sharing a container keep Essentials centered"
      );
      await finishSwipe(win, gestureForOffset(win, 1), shared);
      assertResting(win, shared);
    },
    { wrap: true }
  );
});

add_task(async function test_shared_essentials() {
  await withWorkspaces(
    async ({ win, ws, first, middle, last }) => {
      ok(
        !ws.containerSpecificEssentials,
        "Shared Essentials preference was read at window startup"
      );
      for (const [workspace, offset] of [
        [first, -1],
        [last, 1],
        [middle, 1],
      ]) {
        await ws.changeWorkspace(workspace);
        startSwipe(win, gestureForOffset(win, offset));
        is(
          essentialsSection(win).style.transform,
          "",
          "Shared Essentials stay centered during a swipe"
        );
        sendSwipe(win, "MozSwipeGestureEnd");
        assertResting(win, workspace);
      }
    },
    { separateEssentials: false }
  );
});
