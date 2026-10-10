/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/* import-globals-from swipe_test_utils.js */
Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "swipe_test_utils.js",
  this
);

add_task(async function test_committed_inward_swipe() {
  for (const naturalScroll of [false, true]) {
    await withWorkspaces(
      async ({ win, ws, middle, last }) => {
        await ws.changeWorkspace(middle);
        const gesture = gestureForOffset(win, 1);
        startSwipe(win, gesture);
        ok(
          !essentialsSection(win, last.containerTabId).hidden,
          "The actual destination's Essentials are previewed"
        );
        await finishSwipe(win, gesture, last);
        assertResting(win, last);
      },
      { naturalScroll }
    );
  }
});

add_task(async function test_same_workspace_cancellation_is_awaited() {
  await withWorkspaces(async ({ win, ws, middle }) => {
    await ws.changeWorkspace(middle);
    const selectedTab = win.gBrowser.selectedTab;
    ws._organizeWorkspaceStripLocations(middle, true, -50);
    await ws.changeWorkspace(middle, { whileScrolling: true });
    ok(
      !ws._animatingChange,
      "Returning from changeWorkspace waits for cancellation"
    );
    is(
      win.gBrowser.selectedTab,
      selectedTab,
      "Cancellation preserves selection"
    );
    assertResting(win, middle);
  });
});
