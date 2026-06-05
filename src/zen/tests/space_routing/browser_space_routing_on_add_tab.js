/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TARGET_WS = { uuid: "ws-target", containerTabId: 7 };

add_setup(async function () {
  clearAllRoutes();
  registerCleanupFunction(() => clearAllRoutes());
});

add_task(async function test_onBeforeAddTab_resolves_container_for_match() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com/zen",
    {},
    win
  );

  Assert.deepEqual(
    result,
    {
      shouldEarlyExit: false,
      userContextId: TARGET_WS.containerTabId,
      isRouteFound: true,
    },
    "A matching route resolves to the workspace's containerTabId"
  );
});

add_task(async function test_onBeforeAddTab_no_match_returns_no_route() {
  clearAllRoutes();
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://example.com",
    {},
    win
  );

  Assert.deepEqual(
    result,
    { shouldEarlyExit: false, userContextId: null, isRouteFound: false },
    "An unmatched URL (most-recent-space) reports no container and no route"
  );
});

add_task(async function test_onBeforeAddTab_route_to_missing_workspace() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: "ws-does-not-exist",
  });
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com",
    {},
    win
  );

  Assert.deepEqual(
    result,
    { shouldEarlyExit: false, userContextId: null, isRouteFound: false },
    "A route to a non-existent workspace yields no container and no route"
  );
});

add_task(async function test_onBeforeAddTab_skips_special_tab_options() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  for (const skipOption of ["skipRoute", "pinned", "tabGroup"]) {
    const result = gZenSpaceRoutingManager.onBeforeAddTab(
      "https://github.com/zen",
      { [skipOption]: true },
      win
    );
    Assert.deepEqual(
      result,
      { shouldEarlyExit: false, userContextId: null, isRouteFound: false },
      `Option '${skipOption}' skips routing even though a rule matches`
    );
  }
});

add_task(async function test_onBeforeAddTab_skips_until_startup_ready() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  const win = makeFakeWindow({ ready: false, workspaces: [TARGET_WS] });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com/zen",
    {},
    win
  );

  Assert.deepEqual(
    result,
    { shouldEarlyExit: false, userContextId: null, isRouteFound: false },
    "While gZenStartup.isReady is false (session restore), routing is skipped"
  );
});

add_task(async function test_onAfterAddTab_moves_tab_on_non_origin_window() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });
  const fakeTab = { parentNode: {} };

  gZenSpaceRoutingManager.onAfterAddTab(
    "https://github.com/zen",
    fakeTab,
    {},
    win
  );

  await TestUtils.waitForCondition(
    () => win.gZenWorkspaces.moveCalls.length === 1,
    "moveTabToWorkspace was called once"
  );
  Assert.equal(
    win.gZenWorkspaces.moveCalls[0].uuid,
    TARGET_WS.uuid,
    "The tab is moved to the matched workspace"
  );
  Assert.equal(
    win.gZenWorkspaces.moveCalls[0].tab,
    fakeTab,
    "The correct tab element is moved"
  );
  Assert.equal(
    win.gZenWorkspaces.changeCalls.length,
    0,
    "A non-originating window does not switch the active workspace"
  );
});

add_task(async function test_onAfterAddTab_ignores_detached_tab() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  gZenSpaceRoutingManager.onAfterAddTab(
    "https://github.com/zen",
    { parentNode: null },
    {},
    win
  );
  await flushEventLoop();

  Assert.equal(
    win.gZenWorkspaces.moveCalls.length,
    0,
    "A detached tab (no parentNode) is never moved"
  );
});

add_task(async function test_onAfterAddTab_does_nothing_without_match() {
  clearAllRoutes();
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  gZenSpaceRoutingManager.onAfterAddTab(
    "https://example.com",
    { parentNode: {} },
    {},
    win
  );
  await flushEventLoop();

  Assert.equal(
    win.gZenWorkspaces.moveCalls.length,
    0,
    "An unmatched URL (most-recent-space) does not move the tab"
  );
});

add_task(async function test_onAfterAddTab_skips_special_tab_options() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  gZenSpaceRoutingManager.onAfterAddTab(
    "https://github.com/zen",
    { parentNode: {} },
    { pinned: true },
    win
  );
  await flushEventLoop();

  Assert.equal(
    win.gZenWorkspaces.moveCalls.length,
    0,
    "A pinned tab is not routed by onAfterAddTab"
  );
});

add_task(async function test_onAfterAddTab_activates_workspace_on_origin() {
  clearAllRoutes();
  await gZenWorkspaces.promiseInitialized;

  await gZenWorkspaces.createAndSaveWorkspace("SR Origin Test");
  const workspaces = gZenWorkspaces.getWorkspaces();
  const target = workspaces[workspaces.length - 1];

  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: target.uuid,
  });

  const isOriginating =
    window === Services.wm.getMostRecentWindow("navigator:browser");
  ok(isOriginating, "Precondition: the test window is the most-recent window");

  const ws = window.gZenWorkspaces;
  const origMove = ws.moveTabToWorkspace;
  const origChange = ws.changeWorkspace;
  const origLastSelected = ws.lastSelectedWorkspaceTabs;

  let moved = null;
  let changedTo = null;
  ws.lastSelectedWorkspaceTabs = {};
  ws.moveTabToWorkspace = (tab, uuid) => {
    moved = { tab, uuid };
  };
  ws.changeWorkspace = workspace => {
    changedTo = workspace;
    return Promise.resolve();
  };

  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
    skipRoute: true,
  });

  try {
    gZenSpaceRoutingManager.onAfterAddTab(
      "https://github.com/zen",
      tab,
      {},
      window
    );

    await TestUtils.waitForCondition(
      () => moved,
      "moveTabToWorkspace was called"
    );
    Assert.equal(moved.uuid, target.uuid, "Moved to the matched workspace");
    Assert.equal(moved.tab, tab, "Moved the tab we passed in");

    await TestUtils.waitForCondition(
      () => changedTo,
      "changeWorkspace was called on the originating window"
    );
    Assert.equal(
      changedTo.uuid,
      target.uuid,
      "Activated the matched workspace"
    );
    Assert.equal(
      ws.lastSelectedWorkspaceTabs[target.uuid],
      tab,
      "The moved tab is remembered as the workspace's last-selected tab"
    );
  } finally {
    ws.moveTabToWorkspace = origMove;
    ws.changeWorkspace = origChange;
    ws.lastSelectedWorkspaceTabs = origLastSelected;
    BrowserTestUtils.removeTab(tab);
    await gZenWorkspaces.removeWorkspace(target.uuid);
  }
});
