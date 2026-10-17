/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/* import-globals-from swipe_test_utils.js */
Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "swipe_test_utils.js",
  this
);

add_task(async function test_blocked_boundaries() {
  for (const naturalScroll of [false, true]) {
    await withWorkspaces(
      async ({ win, ws, first, last }) => {
        for (const [workspace, offset] of [
          [first, -1],
          [last, 1],
        ]) {
          await ws.changeWorkspace(workspace);
          ws._resetSwipePreview();
          const selectedTab = win.gBrowser.selectedTab;
          const background = win.document.getElementById(
            "zen-browser-background"
          );
          const oldGradient = background.style.getPropertyValue(
            "--zen-main-browser-background-old"
          );
          const gesture = gestureForOffset(win, offset);
          startSwipe(win, gesture);
          is(
            ws.workspaceElement(workspace.uuid).style.transform,
            "translateX(0%)",
            "An outward swipe does not move the strip"
          );
          is(
            essentialsSection(win, workspace.containerTabId).style.transform,
            "",
            "An outward swipe does not move Essentials"
          );
          is(
            background.style.getPropertyValue(
              "--zen-main-browser-background-old"
            ),
            oldGradient,
            "The opposite workspace's background is not previewed"
          );
          await finishSwipe(win, gesture, workspace);
          is(
            win.gBrowser.selectedTab,
            selectedTab,
            "A blocked swipe preserves the selected tab"
          );
          assertResting(win, workspace);
        }
      },
      { naturalScroll }
    );
  }
});

add_task(async function test_canceled_preview() {
  await withWorkspaces(async ({ win, ws, middle, last }) => {
    for (const interrupted of [false, true]) {
      await ws.changeWorkspace(middle);
      const selectedTab = win.gBrowser.selectedTab;
      startSwipe(win, gestureForOffset(win, 1));
      ok(
        essentialsSection(win, middle.containerTabId).style.transform,
        "An interior swipe previews moving Essentials"
      );
      if (interrupted) {
        win.document.dispatchEvent(new win.Event("popupshown"));
      } else {
        sendSwipe(win, "MozSwipeGestureUpdate", { delta: 0 });
        sendSwipe(win, "MozSwipeGestureEnd");
      }
      is(
        ws.activeWorkspace,
        middle.uuid,
        "Canceling keeps the active workspace"
      );
      is(
        win.gBrowser.selectedTab,
        selectedTab,
        "Canceling preserves selection"
      );
      assertResting(win, middle);
    }
    const gesture = gestureForOffset(win, 1);
    startSwipe(win, gesture);
    await finishSwipe(win, gesture, last);
    assertResting(win, last);
  });
});

add_task(async function test_one_and_two_workspaces() {
  await withWorkspaces(async ({ win, ws, first, middle, last }) => {
    await ws.changeWorkspace(first);
    await ws.removeWorkspace(last.uuid);
    startSwipe(win, gestureForOffset(win, 1));
    await finishSwipe(win, gestureForOffset(win, 1), middle);
    assertResting(win, middle);
    startSwipe(win, gestureForOffset(win, 1));
    await finishSwipe(win, gestureForOffset(win, 1), middle);
    assertResting(win, middle);
    await ws.changeWorkspace(first);
    await ws.removeWorkspace(middle.uuid);
    is(ws.getWorkspaces().length, 1, "Only one workspace remains");
    for (const wrap of [false, true]) {
      await SpecialPowers.pushPrefEnv({
        set: [["zen.workspaces.wrap-around-navigation", wrap]],
      });
      for (const offset of [-1, 1]) {
        const gesture = gestureForOffset(win, offset);
        startSwipe(win, gesture);
        is(
          ws.workspaceElement(first.uuid).style.transform,
          "translateX(0%)",
          "A sole workspace has no navigation preview"
        );
        await finishSwipe(win, gesture, first);
        assertResting(win, first);
      }
      await SpecialPowers.popPrefEnv();
    }
  });
});
