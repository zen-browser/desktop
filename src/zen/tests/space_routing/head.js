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

function makeFakeWindow({ ready = true, workspaces = [] } = {}) {
  return {
    gZenStartup: { isReady: ready },
    gZenWorkspaces: {
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
  const dialogPromise = BrowserTestUtils.domWindowOpenedAndLoaded(null, win =>
    win.document?.documentURI?.includes("zen-space-routing.xhtml")
  );
  executeSoon(() => gZenSpaceRoutingManager.openSpaceRoutingDialog(window));
  const dialogWin = await dialogPromise;
  await SimpleTest.promiseFocus(dialogWin);
  await TestUtils.waitForCondition(
    () => dialogWin.spaceroutingDialog?.initialized,
    "Space Routing dialog finished initializing"
  );
  return dialogWin;
}

async function closeRoutingDialog(dialogWin) {
  if (dialogWin.closed) {
    return;
  }
  const closed = BrowserTestUtils.domWindowClosed(dialogWin);
  dialogWin.close();
  await closed;
}
