/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Exercises nsZenSpaceRoutingManager.shouldRedirectNavigation: an in-place
// navigation is only redirected into a new tab when its rule points at a space
// that differs from the one the navigating tab already lives in.

const TARGET_WS = { uuid: "ws-target", containerTabId: 7 };

add_setup(async function () {
  clearAllRoutes();
  registerCleanupFunction(() => clearAllRoutes());
});

add_task(async function test_redirect_when_route_targets_other_space() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  const win = makeFakeWindow({ workspaces: [TARGET_WS] });

  ok(
    gZenSpaceRoutingManager.shouldRedirectNavigation(
      "https://github.com/zen",
      "ws-current",
      win
    ),
    "Navigating to a routed site from a different space redirects"
  );
});

add_task(async function test_no_redirect_when_already_in_target_space() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  const win = makeFakeWindow({ workspaces: [TARGET_WS] });

  ok(
    !gZenSpaceRoutingManager.shouldRedirectNavigation(
      "https://github.com/zen",
      TARGET_WS.uuid,
      win
    ),
    "Already in the destination space navigates in place (and avoids a loop)"
  );
});

add_task(async function test_no_redirect_when_no_rule_matches() {
  clearAllRoutes();
  const win = makeFakeWindow({ workspaces: [TARGET_WS] });

  ok(
    !gZenSpaceRoutingManager.shouldRedirectNavigation(
      "https://example.com",
      "ws-current",
      win
    ),
    "An unmatched URL is never redirected"
  );
});

add_task(async function test_no_redirect_when_rule_targets_most_recent() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: "most-recent-space",
  });
  const win = makeFakeWindow({ workspaces: [TARGET_WS] });

  ok(
    !gZenSpaceRoutingManager.shouldRedirectNavigation(
      "https://github.com",
      "ws-current",
      win
    ),
    "A rule that opens in the most recent space is not redirected"
  );
});

add_task(async function test_no_redirect_when_target_workspace_missing() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: "ws-does-not-exist",
  });
  const win = makeFakeWindow({ workspaces: [TARGET_WS] });

  ok(
    !gZenSpaceRoutingManager.shouldRedirectNavigation(
      "https://github.com",
      "ws-current",
      win
    ),
    "A rule pointing at a missing workspace is not redirected"
  );
});

add_task(async function test_no_redirect_when_workspaces_disabled() {
  clearAllRoutes();
  addRoute({
    reference: "github.com",
    matchType: "contains",
    openIn: TARGET_WS.uuid,
  });
  const win = makeFakeWindow({
    workspaces: [TARGET_WS],
    workspaceEnabled: false,
  });

  ok(
    !gZenSpaceRoutingManager.shouldRedirectNavigation(
      "https://github.com",
      "ws-current",
      win
    ),
    "Nothing is redirected when workspaces are disabled"
  );
});
