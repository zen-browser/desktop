/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/* import-globals-from swipe_test_utils.js */
Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "swipe_test_utils.js",
  this
);

add_task(async function test_edge_actions_and_creation() {
  await withWorkspaces(
    async ({ win, ws, first, last }) => {
      const rightSide = win.gZenVerticalTabsManager._prefsRightSide;
      const workspace = rightSide ? first : last;
      const gesture = {
        delta: rightSide ? 0.4 : -0.4,
        direction: rightSide
          ? win.SimpleGestureEvent.DIRECTION_LEFT
          : win.SimpleGestureEvent.DIRECTION_RIGHT,
      };
      await ws.changeWorkspace(workspace);
      startSwipe(win, gesture);
      ok(
        win.document.querySelector(".zen-swipe-add-space-container"),
        "Add Space still activates at the boundary"
      );
      Assert.notStrictEqual(
        ws.workspaceElement(workspace.uuid).style.transform,
        "translateX(0%)",
        "Add Space retains its intentional strip displacement"
      );
      sendSwipe(win, "MozSwipeGestureEnd");
      ok(
        !win.document.querySelector(".zen-swipe-add-space-container"),
        "Canceling removes the Add Space badge"
      );
      assertResting(win, workspace);

      startSwipe(win, gesture);
      sendSwipe(win, "MozSwipeGesture", gesture);
      sendSwipe(win, "MozSwipeGestureEnd");
      await TestUtils.waitForCondition(
        () => win.document.querySelector("zen-workspace-creation"),
        "Add Space opens the creation form"
      );
      await TestUtils.waitForCondition(
        () =>
          ws.activeWorkspace === ws.creatingWorkspaceId &&
          !ws.isChangingWorkspace &&
          !ws._animatingChange,
        "Creation transition finishes"
      );
      await TestUtils.waitForTick();
      for (const section of win.document.querySelectorAll(
        "#zen-essentials .zen-essentials-container"
      )) {
        ok(section.hidden, "Essentials remain hidden under the creation form");
      }
      await win.document
        .querySelector("zen-workspace-creation")
        .onCancelButtonCommand();
      assertResting(win, workspace);

      const libraryWorkspace = rightSide ? last : first;
      await ws.changeWorkspace(libraryWorkspace);
      startSwipe(win, {
        delta: rightSide ? -0.4 : 0.4,
        direction: rightSide
          ? win.SimpleGestureEvent.DIRECTION_RIGHT
          : win.SimpleGestureEvent.DIRECTION_LEFT,
      });
      const Library = win.customElements.get("zen-library");
      Assert.greater(
        Library.libraryProgress,
        0,
        "The Library edge gesture remains enabled"
      );
      await TestUtils.waitForCondition(
        () => Library.getInstance().hasAttribute("transitioning"),
        "The Library swipe has finished loading its styles"
      );
      sendSwipe(win, "MozSwipeGestureUpdate", { delta: 0 });
      sendSwipe(win, "MozSwipeGestureEnd");
      await Library.animateProgress(0);
      assertResting(win, libraryWorkspace);
    },
    { edgeActions: true }
  );
});
