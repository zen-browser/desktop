/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TARGET_WS = {
  uuid: "ws-target",
  containerTabId: 7,
  name: "Target Workspace",
};

async function withZenTestingDisabled(callback) {
  const originalTestingEnabled = gZenUIManager.testingEnabled;

  // Browser tests enable Zen testing mode, where selectEmptyTab() is a no-op.
  // Disable it while setting up a real workspace selection lifecycle.
  gZenUIManager.testingEnabled = false;
  try {
    return await callback();
  } finally {
    gZenUIManager.testingEnabled = originalTestingEnabled;
  }
}

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

add_task(
  async function test_routed_foreground_tab_waits_for_workspace_change() {
    clearAllRoutes();
    await gZenWorkspaces.promiseInitialized;

    const originalWorkspace = gZenWorkspaces.getActiveWorkspace();
    const targetIdentity = ContextualIdentityService.getPublicIdentities().find(
      identity => identity.userContextId !== originalWorkspace.containerTabId
    );
    if (!targetIdentity) {
      ok(
        true,
        "No second container is available for the routing regression test"
      );
      return;
    }

    const target = await withZenTestingDisabled(async () => {
      const workspace = await gZenWorkspaces.createAndSaveWorkspace(
        "SR Selection Order Test",
        undefined,
        false,
        targetIdentity.userContextId
      );
      await gZenWorkspaces.changeWorkspace(originalWorkspace);
      return workspace;
    });

    const originalTab = gBrowser.selectedTab;
    ok(
      originalTab?.linkedBrowser,
      "Precondition: setup leaves a valid selected browser"
    );

    addRoute({
      reference: "routing-order.invalid",
      matchType: "contains",
      openIn: target.uuid,
    });

    const ws = window.gZenWorkspaces;
    const originalChangeWorkspace = ws.changeWorkspace;
    let selectedWhenWorkspaceChangeStarted = null;
    ws.changeWorkspace = async function (workspace, ...args) {
      selectedWhenWorkspaceChangeStarted = gBrowser.selectedTab;
      return originalChangeWorkspace.call(this, workspace, ...args);
    };

    let routedTab = null;
    try {
      routedTab = gBrowser.addTab("https://routing-order.invalid/", {
        inBackground: false,
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
      });

      await TestUtils.waitForCondition(
        () => selectedWhenWorkspaceChangeStarted,
        "The routed tab started a workspace change"
      );
      Assert.equal(
        selectedWhenWorkspaceChangeStarted,
        originalTab,
        "The routed tab is not selected before its target workspace starts changing"
      );

      Assert.equal(
        routedTab.userContextId,
        targetIdentity.userContextId,
        "The routed tab uses the target workspace's container"
      );
      await TestUtils.waitForCondition(
        () => gZenWorkspaces.activeWorkspace === target.uuid,
        "The target workspace became active"
      );
      await TestUtils.waitForCondition(
        () => gBrowser.selectedTab === routedTab,
        "The routed tab became selected after the workspace change"
      );

      await BrowserTestUtils.removeTab(routedTab);
      routedTab = null;
      if (gBrowser._switcher) {
        await TestUtils.waitForCondition(
          () => !gBrowser._switcher,
          "The tab switcher finishes after closing the routed tab"
        );
      }
      await TestUtils.waitForCondition(
        () => gBrowser.selectedTab?.linkedBrowser,
        "Closing the routed tab leaves a selectable browser"
      );
      ok(
        gBrowser.selectedTab.linkedBrowser,
        "The selected tab retains a browser after the routed tab closes"
      );
    } finally {
      ws.changeWorkspace = originalChangeWorkspace;
      clearAllRoutes();
      if (routedTab?.isConnected) {
        BrowserTestUtils.removeTab(routedTab);
      }
      if (originalWorkspace) {
        await gZenWorkspaces.changeWorkspace(originalWorkspace);
      }
      await gZenWorkspaces.removeWorkspace(target.uuid);
    }
  }
);

add_task(
  async function test_routed_tab_close_does_not_leave_stale_workspace_selection() {
    clearAllRoutes();
    await gZenWorkspaces.promiseInitialized;

    const sourceWorkspace = gZenWorkspaces.getActiveWorkspace();
    const targetIdentity = ContextualIdentityService.getPublicIdentities().find(
      identity => identity.userContextId !== sourceWorkspace.containerTabId
    );
    if (!targetIdentity) {
      ok(
        true,
        "No second container is available for the close regression test"
      );
      return;
    }

    const targetWorkspace = await withZenTestingDisabled(async () => {
      const workspace = await gZenWorkspaces.createAndSaveWorkspace(
        "SR Close Test",
        undefined,
        false,
        targetIdentity.userContextId
      );
      await gZenWorkspaces.changeWorkspace(sourceWorkspace);
      return workspace;
    });

    const sourceTab = gBrowser.addTab("https://example.com/", {
      inBackground: false,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    await TestUtils.waitForCondition(
      () => gBrowser.selectedTab === sourceTab,
      "A regular source tab is selected in the source workspace"
    );

    let routedTab = null;
    try {
      addRoute({
        reference: "routing-close.invalid",
        matchType: "contains",
        openIn: targetWorkspace.uuid,
      });

      routedTab = gBrowser.addTab("https://routing-close.invalid/", {
        inBackground: false,
        ownerTab: sourceTab,
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
      });
      await TestUtils.waitForCondition(
        () =>
          gZenWorkspaces.activeWorkspace === targetWorkspace.uuid &&
          gBrowser.selectedTab === routedTab,
        "The routed tab becomes selected in its target workspace"
      );

      gBrowser.removeTab(routedTab, { animate: true });
      await gZenWorkspaces.changeWorkspace(sourceWorkspace);
      await TestUtils.waitForCondition(
        () => !routedTab.isConnected,
        "The routed tab finishes closing after the workspace change"
      );

      ok(
        gZenWorkspaces.lastSelectedWorkspaceTabs[targetWorkspace.uuid] !==
          routedTab,
        "Returning to the target workspace clears its stale closed selection"
      );
      ok(
        gBrowser.selectedTab !== routedTab,
        "The closed routed tab is not selected again"
      );
      ok(
        gBrowser.selectedTab?.isConnected,
        "The selected tab remains connected after returning to the target workspace"
      );
      ok(
        gBrowser.selectedTab?.linkedBrowser,
        "The selected tab retains a browser after returning to the target workspace"
      );
    } finally {
      clearAllRoutes();
      if (routedTab?.isConnected) {
        BrowserTestUtils.removeTab(routedTab);
      }
      if (sourceWorkspace) {
        await gZenWorkspaces.changeWorkspace(sourceWorkspace);
      }
      if (sourceTab?.isConnected) {
        BrowserTestUtils.removeTab(sourceTab);
      }
      await gZenWorkspaces.removeWorkspace(targetWorkspace.uuid);
    }
  }
);

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
