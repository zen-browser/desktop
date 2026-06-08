/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenSpaceRoutingManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/spacerouting/ZenSpaceRoutingManager.sys.mjs"
);

const SR_DIALOG_URI =
  "chrome://browser/content/zen-components/windows/zen-space-routing.xhtml";

function clearAllRoutes() {
  for (const route of gZenSpaceRoutingManager.getAllRoutes()) {
    gZenSpaceRoutingManager.removeRoute(route.id);
  }
}

function addRoute({
  reference = "",
  openIn = "most-recent-space",
  matchType = "contains",
} = {}) {
  const route = gZenSpaceRoutingManager.createNewRoute();
  route.reference = reference;
  route.openIn = openIn;
  route.matchType = matchType;
  gZenSpaceRoutingManager.updateRoute(route);
  return route;
}

function makeFakeWindow({
  ready = true,
  workspaces = [],
  workspaceEnabled = true,
} = {}) {
  return {
    gZenStartup: { isReady: ready },
    gZenWorkspaces: {
      workspaceEnabled,
      moveCalls: [],
      changeCalls: [],
      lastSelectedWorkspaceTabs: {},
      getWorkspaceFromId(id) {
        return workspaces.find(w => w.uuid === id) || null;
      },
      moveTabToWorkspace(tab, uuid) {
        this.moveCalls.push({ tab, uuid });
      },
      changeWorkspace(workspace) {
        this.changeCalls.push(workspace);
        return Promise.resolve();
      },
    },
  };
}

async function flushEventLoop() {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => Services.tm.dispatchToMainThread(resolve));
  }
}

async function openRoutingDialog() {
  // openSpaceRoutingDialog() presents an in-window modal through gDialogBox, so
  // the dialog is a subdialog rather than a separate top-level window.
  const dialogPromise = BrowserTestUtils.promiseAlertDialogOpen(
    null,
    SR_DIALOG_URI,
    { isSubDialog: true }
  );
  // gDialogBox.open() only resolves once the dialog is dismissed, so kick it off
  // without awaiting and wait on the open notification instead.
  executeSoon(() => gZenSpaceRoutingManager.openSpaceRoutingDialog(window));
  const dialogWin = await dialogPromise;
  await TestUtils.waitForCondition(
    () => dialogWin.spaceroutingDialog?.initialized,
    "Space Routing dialog finished initializing"
  );
  return dialogWin;
}

// Resolves once the gDialogBox subdialog has fully torn down. Use this instead
// of BrowserTestUtils.domWindowClosed(), which only fires for separate
// top-level windows and so never resolves for an in-window subdialog.
function promiseRoutingDialogClosed() {
  const container = document.getElementById("window-modal-dialog");
  if (!container?.open) {
    return Promise.resolve();
  }
  return BrowserTestUtils.waitForMutationCondition(
    container,
    { childList: true, attributes: true },
    () => !container.hasChildNodes() && !container.open
  );
}

async function closeRoutingDialog(dialogWin) {
  const closed = promiseRoutingDialogClosed();
  dialogWin.close();
  await closed;
}
