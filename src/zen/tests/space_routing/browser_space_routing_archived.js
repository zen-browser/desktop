/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ARCHIVED_WS = {
  uuid: "ws-archived",
  containerTabId: 7,
  name: "Archived Workspace",
  archived: true,
};

add_setup(async function () {
  clearAllRoutes();
  registerCleanupFunction(() => clearAllRoutes());
});

add_task(async function test_route_to_archived_space_falls_back() {
  clearAllRoutes();
  addRoute({ reference: "github.com", openIn: ARCHIVED_WS.uuid });
  const win = makeFakeWindow({ ready: true, workspaces: [ARCHIVED_WS] });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com/zen",
    {},
    win
  );
  ok(!result.isRouteFound, "A route to an archived space doesn't match");
  is(result.userContextId, null, "The archived space's container is unused");

  const tab = { parentNode: {} };
  gZenSpaceRoutingManager.onAfterAddTab(
    "https://github.com/zen",
    tab,
    {},
    win,
    result
  );
  await flushEventLoop();
  Assert.deepEqual(
    win.gZenWorkspaces.moveCalls,
    [],
    "The tab isn't moved into the archived space"
  );
});

add_task(async function test_navigation_to_archived_space_is_not_redirected() {
  clearAllRoutes();
  addRoute({ reference: "github.com", openIn: ARCHIVED_WS.uuid });
  const win = makeFakeWindow({ ready: true, workspaces: [ARCHIVED_WS] });

  ok(
    !gZenSpaceRoutingManager.shouldRedirectNavigation(
      "https://github.com/zen",
      "ws-other",
      win
    ),
    "Navigations aren't pulled into an archived space"
  );
});
