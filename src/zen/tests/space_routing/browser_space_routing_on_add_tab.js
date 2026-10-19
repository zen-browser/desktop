/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TARGET_WS = {
  uuid: "ws-target",
  containerTabId: 7,
  name: "Target Workspace",
};
let savedDefaultExternalRoute;

add_setup(async function () {
  savedDefaultExternalRoute = gZenSpaceRoutingManager.getDefaultExternalRoute();
  clearAllRoutes();
  registerCleanupFunction(() => {
    clearAllRoutes();
    gZenSpaceRoutingManager.setDefaultExternalRoute(savedDefaultExternalRoute);
  });
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
      targetRoute: TARGET_WS.uuid,
      targetWorkspaceName: TARGET_WS.name,
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
    {
      shouldEarlyExit: false,
      userContextId: null,
      isRouteFound: false,
      targetRoute: "most-recent-space",
      targetWorkspaceName: null,
    },
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
    {
      shouldEarlyExit: false,
      userContextId: null,
      isRouteFound: false,
      targetRoute: "ws-does-not-exist",
      targetWorkspaceName: null,
    },
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
      {
        shouldEarlyExit: false,
        userContextId: null,
        isRouteFound: false,
        targetRoute: null,
        targetWorkspaceName: null,
      },
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
    {
      shouldEarlyExit: false,
      userContextId: null,
      isRouteFound: false,
      targetRoute: null,
      targetWorkspaceName: null,
    },
    "While gZenStartup.isReady is false (session restore), routing is skipped"
  );
});

add_task(async function test_onBeforeAddTab_routes_external_during_startup() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setDefaultExternalRoute(TARGET_WS.uuid);
  const win = makeFakeWindow({ ready: false, workspaces: [TARGET_WS] });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://example.com",
    { fromExternal: true },
    win
  );

  Assert.deepEqual(
    result,
    {
      shouldEarlyExit: false,
      userContextId: TARGET_WS.containerTabId,
      isRouteFound: true,
      targetRoute: TARGET_WS.uuid,
      targetWorkspaceName: TARGET_WS.name,
    },
    "An external link is routed while session restore is still in progress"
  );
});

// The startup URI arrives as window.arguments, with fromExternal carried in
// the property bag at index 1, and gBrowser reads the container before
// gZenWorkspaces has a cache of its own.
function makeStartupWindow({ uriToLoad, fromExternal, workspaces = [] }) {
  const extraOptions = Cc["@mozilla.org/hash-property-bag;1"].createInstance(
    Ci.nsIWritablePropertyBag2
  );
  if (fromExternal !== undefined) {
    extraOptions.setPropertyAsBool("fromExternal", fromExternal);
  }

  const win = makeFakeWindow({ ready: false, workspaces });
  win.arguments = [uriToLoad, extraOptions];
  win.gBrowserInit = { uriToLoadPromise: uriToLoad };
  win.gZenWorkspaces.getWorkspaces = () => workspaces;
  return win;
}

add_task(async function test_startup_user_context_id_routes_external() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setDefaultExternalRoute(TARGET_WS.uuid);

  Assert.equal(
    gZenSpaceRoutingManager.getStartupUserContextId(
      makeStartupWindow({
        uriToLoad: "https://example.com",
        fromExternal: true,
        workspaces: [TARGET_WS],
      })
    ),
    TARGET_WS.containerTabId,
    "A cold-start external URI resolves the default route's container"
  );

  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  Assert.equal(
    gZenSpaceRoutingManager.getStartupUserContextId(
      makeStartupWindow({
        uriToLoad: "https://github.com/zen",
        fromExternal: true,
        workspaces: [TARGET_WS],
      })
    ),
    TARGET_WS.containerTabId,
    "A matching explicit route resolves its container too"
  );
});

add_task(async function test_startup_user_context_id_leaves_tab_alone() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setDefaultExternalRoute(TARGET_WS.uuid);

  Assert.equal(
    gZenSpaceRoutingManager.getStartupUserContextId(
      makeStartupWindow({
        uriToLoad: "https://example.com",
        fromExternal: false,
        workspaces: [TARGET_WS],
      })
    ),
    null,
    "A startup URI that did not come from another application is not routed"
  );

  Assert.equal(
    gZenSpaceRoutingManager.getStartupUserContextId(
      makeStartupWindow({
        uriToLoad: "https://example.com",
        workspaces: [TARGET_WS],
      })
    ),
    null,
    "A property bag without fromExternal is not routed"
  );

  Assert.equal(
    gZenSpaceRoutingManager.getStartupUserContextId(
      makeStartupWindow({
        uriToLoad: Promise.resolve("https://example.com"),
        fromExternal: true,
        workspaces: [TARGET_WS],
      })
    ),
    null,
    "A URI still being resolved, which only happens for the homepage, is not routed"
  );

  gZenSpaceRoutingManager.setDefaultExternalRoute("most-recent-space");
  Assert.equal(
    gZenSpaceRoutingManager.getStartupUserContextId(
      makeStartupWindow({
        uriToLoad: "https://example.com",
        fromExternal: true,
        workspaces: [TARGET_WS],
      })
    ),
    null,
    "The most-recent-space default leaves the initial tab's container alone"
  );

  gZenSpaceRoutingManager.setDefaultExternalRoute("ws-does-not-exist");
  Assert.equal(
    gZenSpaceRoutingManager.getStartupUserContextId(
      makeStartupWindow({
        uriToLoad: "https://example.com",
        fromExternal: true,
        workspaces: [TARGET_WS],
      })
    ),
    null,
    "A stale external destination does not route the initial tab"
  );
});

add_task(async function test_routeStartupTab_moves_the_initial_tab() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setDefaultExternalRoute(TARGET_WS.uuid);
  const win = makeStartupWindow({
    uriToLoad: "https://example.com",
    fromExternal: true,
    workspaces: [TARGET_WS],
  });
  const initialTab = { parentNode: {} };

  await gZenSpaceRoutingManager.routeStartupTab(initialTab, win);

  Assert.equal(
    win.gZenWorkspaces.moveCalls.length,
    1,
    "The initial tab is moved once"
  );
  Assert.equal(
    win.gZenWorkspaces.moveCalls[0].uuid,
    TARGET_WS.uuid,
    "The initial tab lands in the routed space"
  );
  Assert.equal(
    win.gZenWorkspaces.moveCalls[0].tab,
    initialTab,
    "The tab the startup URI was loaded into is the one moved"
  );
});

add_task(async function test_routeStartupTab_ignores_unrouted_startups() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setDefaultExternalRoute(TARGET_WS.uuid);

  for (const [label, options] of [
    [
      "a startup URI that did not come from another application",
      { uriToLoad: "https://example.com", fromExternal: false },
    ],
    [
      "a URI still being resolved",
      { uriToLoad: Promise.resolve("https://example.com"), fromExternal: true },
    ],
  ]) {
    const win = makeStartupWindow({ ...options, workspaces: [TARGET_WS] });
    await gZenSpaceRoutingManager.routeStartupTab({ parentNode: {} }, win);
    Assert.equal(
      win.gZenWorkspaces.moveCalls.length,
      0,
      `${label} is left where Firefox put it`
    );
  }
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
    win,
    { targetRoute: TARGET_WS.uuid }
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

add_task(async function test_onAfterAddTab_reuses_before_result() {
  clearAllRoutes();
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });
  const fakeTab = { parentNode: {} };

  // No routes exist, so a fresh routeUri() would yield "most-recent-space" and
  // move nothing. The tab is still moved to TARGET_WS, proving onAfterAddTab
  // routes purely from the precomputed result rather than recomputing.
  gZenSpaceRoutingManager.onAfterAddTab(
    "https://example.com",
    fakeTab,
    {},
    win,
    { targetRoute: TARGET_WS.uuid }
  );

  await TestUtils.waitForCondition(
    () => win.gZenWorkspaces.moveCalls.length === 1,
    "moveTabToWorkspace used the precomputed route"
  );
  Assert.equal(
    win.gZenWorkspaces.moveCalls[0].uuid,
    TARGET_WS.uuid,
    "onAfterAddTab routes using the precomputed targetRoute, not a fresh routeUri()"
  );
});

add_task(async function test_onAfterAddTab_ignores_detached_tab() {
  clearAllRoutes();
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  gZenSpaceRoutingManager.onAfterAddTab(
    "https://github.com/zen",
    { parentNode: null },
    {},
    win,
    { targetRoute: TARGET_WS.uuid }
  );
  await flushEventLoop();

  Assert.equal(
    win.gZenWorkspaces.moveCalls.length,
    0,
    "A detached tab (no parentNode) is never moved"
  );
});

add_task(
  async function test_onAfterAddTab_does_nothing_for_most_recent_space() {
    clearAllRoutes();
    const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

    gZenSpaceRoutingManager.onAfterAddTab(
      "https://example.com",
      { parentNode: {} },
      {},
      win,
      { targetRoute: "most-recent-space" }
    );
    await flushEventLoop();

    Assert.equal(
      win.gZenWorkspaces.moveCalls.length,
      0,
      "A 'most-recent-space' route does not move the tab"
    );
  }
);

add_task(async function test_onAfterAddTab_does_nothing_when_skipped() {
  clearAllRoutes();
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  // onBeforeAddTab reports targetRoute null for skipped/unready tabs; without a
  // route there is nothing for onAfterAddTab to do.
  gZenSpaceRoutingManager.onAfterAddTab(
    "https://github.com/zen",
    { parentNode: {} },
    {},
    win,
    { targetRoute: null }
  );
  await flushEventLoop();

  Assert.equal(
    win.gZenWorkspaces.moveCalls.length,
    0,
    "A null targetRoute (skipped tab) is not routed"
  );
});

add_task(async function test_onAfterAddTab_ignores_missing_before_result() {
  clearAllRoutes();
  const win = makeFakeWindow({ ready: true, workspaces: [TARGET_WS] });

  gZenSpaceRoutingManager.onAfterAddTab(
    "https://github.com/zen",
    { parentNode: {} },
    {},
    win
  );
  await flushEventLoop();

  Assert.equal(
    win.gZenWorkspaces.moveCalls.length,
    0,
    "Without a beforeResult there is no precomputed route, so nothing is moved"
  );
});

add_task(async function test_onAfterAddTab_activates_workspace_on_origin() {
  clearAllRoutes();
  await gZenWorkspaces.promiseInitialized;

  await gZenWorkspaces.createAndSaveWorkspace("SR Origin Test");
  const workspaces = gZenWorkspaces.getWorkspaces();
  const target = workspaces[workspaces.length - 1];

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
      window,
      { targetRoute: target.uuid }
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
