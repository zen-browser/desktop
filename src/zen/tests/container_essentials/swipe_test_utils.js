/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function sendSwipe(win, type, { direction = 0, delta = 0 } = {}) {
  const event = win.document.createEvent("SimpleGestureEvent");
  event.initSimpleGestureEvent(
    type,
    true,
    true,
    win,
    0,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null,
    0,
    direction,
    delta
  );
  win.gNavToolbox.dispatchEvent(event);
}

// Native updates have positive amounts for LEFT and negative amounts for
// RIGHT. Choose the gesture that commits the requested workspace offset.
function gestureForOffset(win, offset) {
  const isRTL = win.document.documentElement.matches(":-moz-locale-dir(rtl)");
  const rawDirection =
    offset * (win.gZenWorkspaces.naturalScroll ? -1 : 1) * (isRTL ? -1 : 1);
  return {
    direction:
      rawDirection > 0
        ? win.SimpleGestureEvent.DIRECTION_RIGHT
        : win.SimpleGestureEvent.DIRECTION_LEFT,
    delta: -rawDirection * 0.4,
  };
}

// getEssentialsSection also updates visibility, so assertions must read
// the existing DOM without changing the preview they are checking.
function essentialsSection(win, container = 0) {
  const id = win.gZenWorkspaces.containerSpecificEssentials ? container : 0;
  return win.document.querySelector(
    `#zen-essentials .zen-essentials-container[container="${id}"]`
  );
}

function startSwipe(win, gesture) {
  sendSwipe(win, "MozSwipeGestureMayStart", gesture);
  sendSwipe(win, "MozSwipeGestureStart", gesture);
  sendSwipe(win, "MozSwipeGestureUpdate", gesture);
}

async function finishSwipe(win, gesture, expectedWorkspace) {
  sendSwipe(win, "MozSwipeGesture", gesture);
  // Deliberately end in the same task: the workspace-change mutex has not
  // necessarily been acquired yet, but the preview must already be owned
  // by the committed switch.
  sendSwipe(win, "MozSwipeGestureEnd");
  await TestUtils.waitForTick();
  await TestUtils.waitForCondition(
    () =>
      win.gZenWorkspaces.activeWorkspace === expectedWorkspace.uuid &&
      !win.gZenWorkspaces.isChangingWorkspace &&
      !win.gZenWorkspaces._animatingChange,
    "The committed workspace switch and its cleanup finish"
  );
}

function assertResting(win, workspace) {
  const ws = win.gZenWorkspaces;
  is(
    ws.workspaceElement(workspace.uuid).style.transform,
    "translateX(0%)",
    "The active workspace strip is centered"
  );
  for (const section of win.document.querySelectorAll(
    "#zen-essentials .zen-essentials-container"
  )) {
    is(section.style.transform, "", "No Essentials preview transform remains");
    const shouldHide =
      ws.containerSpecificEssentials &&
      section.getAttribute("container") != workspace.containerTabId;
    is(
      section.hidden,
      shouldHide,
      "Only the active Essentials section is shown"
    );
  }
  const grain = win.gZenThemePicker.getGradientForWorkspace(workspace).grain;
  for (const id of ["zen-browser-background", "zen-toolbar-background"]) {
    const background = win.document.getElementById(id);
    is(
      background.style.getPropertyValue("--zen-background-opacity"),
      "1",
      "The background preview is fully restored"
    );
    is(
      Number(
        background.style.getPropertyValue("--zen-grainy-background-opacity")
      ),
      grain,
      "The active workspace's grain is restored"
    );
    ok(
      !background.hasAttribute("animating-background"),
      "Background animation has ended"
    );
  }
  ok(!ws._swipeManager.isGestureActive, "The gesture is no longer active");
  ok(
    !ws.workspaceElement(workspace.uuid).hasAttribute("swipe-gesture"),
    "Gesture styles are removed"
  );
}

async function withWorkspaces(
  task,
  {
    separateEssentials = true,
    naturalScroll = false,
    wrap = false,
    edgeActions = false,
  } = {}
) {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.workspaces.separate-essentials", separateEssentials],
      ["zen.workspaces.natural-scroll", naturalScroll],
      ["zen.workspaces.wrap-around-navigation", wrap],
      ["zen.workspaces.swipe-actions.edge-actions", edgeActions],
      ["zen.library.enabled", true],
    ],
  });
  const win = await BrowserTestUtils.openNewBrowserWindow();
  const ws = win.gZenWorkspaces;
  const created = [];
  const tabs = [];
  registerCleanupFunction(async () => {
    if (!win.closed) {
      await BrowserTestUtils.closeWindow(win);
    }
  });
  try {
    await ws.promiseInitialized;
    await TestUtils.waitForCondition(
      () => ws._swipeManager,
      "Workspace swipes are initialized"
    );
    const original = ws.getActiveWorkspace();
    const first = ws.getWorkspaces()[0];
    async function createWorkspace(container) {
      const workspace = await ws.createAndSaveWorkspace(
        "Swipe boundary test",
        undefined,
        false,
        container
      );
      created.push(workspace);
      workspace.theme.texture = container / 4;
      ws.saveWorkspace(workspace);
      win.gZenThemePicker.invalidateGradientCache(workspace.uuid);
      return workspace;
    }
    const middle = await createWorkspace(1);
    const last = await createWorkspace(2);
    for (const workspace of [first, middle, last]) {
      await ws.changeWorkspace(workspace);
      const tab = BrowserTestUtils.addTab(win.gBrowser, "about:blank", {
        skipAnimation: true,
        userContextId: workspace.containerTabId,
      });
      tabs.push(tab);
      win.gZenPinnedTabManager.addToEssentials(tab);
      ok(
        tab.hasAttribute("zen-essential"),
        "The fixture has real Essential tabs"
      );
    }
    ws._resetSwipePreview();
    await task({ win, ws, first, middle, last, createWorkspace });
    await ws.changeWorkspace(original);
  } finally {
    sendSwipe(win, "MozSwipeGestureEnd");
    const creationForm = win.document.querySelector("zen-workspace-creation");
    if (creationForm) {
      await creationForm.onCancelButtonCommand();
    }
    for (const tab of tabs) {
      if (tab.isConnected && !tab.closing) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
    for (const workspace of created.reverse()) {
      if (ws.getWorkspaceFromId(workspace.uuid)) {
        await ws.removeWorkspace(workspace.uuid);
      }
    }
    await BrowserTestUtils.closeWindow(win);
    await SpecialPowers.popPrefEnv();
  }
}
