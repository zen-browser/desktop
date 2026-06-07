/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const MANAGED_PREF = "zen.space-routing.managed-routes";

// Pushes a managed-routes pref env. `routes` may be an array/object (serialized
// to JSON) or a raw string (used as-is, to exercise malformed input).
function pushManagedRoutes(routes) {
  const value = typeof routes === "string" ? routes : JSON.stringify(routes);
  return SpecialPowers.pushPrefEnv({ set: [[MANAGED_PREF, value]] });
}

add_setup(async function () {
  clearAllRoutes();
  registerCleanupFunction(() => clearAllRoutes());
});

add_task(async function test_managed_route_resolves_space_by_name() {
  clearAllRoutes();
  await pushManagedRoutes([
    { reference: "github.com", matchType: "contains", openInSpace: "Work" },
  ]);

  const work = { uuid: "ws-work-uuid", name: "Work", containerTabId: 3 };
  const win = makeFakeWindow({ ready: true, workspaces: [work] });

  Assert.deepEqual(
    gZenSpaceRoutingManager.onBeforeAddTab("https://github.com/zen", {}, win),
    {
      shouldEarlyExit: false,
      userContextId: work.containerTabId,
      isRouteFound: true,
      targetRoute: work.uuid,
    },
    "A managed route resolves its target Space by name to that Space's id"
  );

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_managed_route_wins_over_user_route() {
  clearAllRoutes();
  addRoute({ reference: "github", matchType: "contains", openIn: "ws-user" });
  await pushManagedRoutes([
    { reference: "github", matchType: "contains", openInSpace: "Work" },
  ]);

  const work = { uuid: "ws-work-uuid", name: "Work", containerTabId: 9 };
  const win = makeFakeWindow({ ready: true, workspaces: [work] });

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://github.com/zen", {}, win),
    work.uuid,
    "A managed route is evaluated before, and wins over, a matching user route"
  );

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_managed_openin_literal_id_and_most_recent() {
  clearAllRoutes();
  await pushManagedRoutes([
    { reference: "by-id.example", openIn: "ws-literal-id" },
    { reference: "by-default.example" },
    { reference: "by-mru.example", openIn: "most-recent-space" },
  ]);

  const win = makeFakeWindow({ ready: true, workspaces: [] });

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://by-id.example", {}, win),
    "ws-literal-id",
    "A literal `openIn` Space id is returned as-is"
  );
  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://by-default.example", {}, win),
    "most-recent-space",
    "An omitted target defaults to most-recent-space"
  );
  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://by-mru.example", {}, win),
    "most-recent-space",
    "An explicit most-recent-space target is honored"
  );

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_managed_unknown_space_name_falls_back() {
  clearAllRoutes();
  await pushManagedRoutes([
    { reference: "github.com", openInSpace: "DoesNotExist" },
  ]);

  const win = makeFakeWindow({
    ready: true,
    workspaces: [{ uuid: "ws-other", name: "Other", containerTabId: 1 }],
  });

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://github.com", {}, win),
    "most-recent-space",
    "A name that matches no Space falls back to most-recent-space"
  );

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_managed_default_match_type_is_contains() {
  clearAllRoutes();
  // No matchType given, and an unknown matchType: both normalize to "contains".
  await pushManagedRoutes([
    { reference: "github.com", openIn: "ws-a" },
    { reference: "gitlab.com", matchType: "starts-with", openIn: "ws-b" },
  ]);
  const win = makeFakeWindow({ ready: true, workspaces: [] });

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://api.github.com/v3", {}, win),
    "ws-a",
    "A managed route with no matchType behaves as 'contains'"
  );
  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://api.gitlab.com/v4", {}, win),
    "ws-b",
    "An unrecognized matchType is coerced to 'contains'"
  );

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_managed_object_with_routes_array_is_accepted() {
  clearAllRoutes();
  await pushManagedRoutes({
    routes: [{ reference: "github.com", openIn: "ws-obj" }],
  });
  const win = makeFakeWindow({ ready: true, workspaces: [] });

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://github.com", {}, win),
    "ws-obj",
    "An object with a `routes` array is accepted, not just a bare array"
  );

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_managed_invalid_entries_are_skipped() {
  clearAllRoutes();
  await pushManagedRoutes([
    { matchType: "contains", openIn: "ws-x" }, // no reference
    { reference: "   ", openIn: "ws-y" }, // blank reference
    null,
    { reference: "github.com", openIn: "ws-valid" },
  ]);
  const win = makeFakeWindow({ ready: true, workspaces: [] });

  Assert.equal(
    gZenSpaceRoutingManager.getManagedRoutes().length,
    1,
    "Entries without a usable reference are dropped"
  );
  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://github.com", {}, win),
    "ws-valid",
    "The single valid managed entry still routes"
  );

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_malformed_json_is_ignored() {
  clearAllRoutes();
  addRoute({ reference: "github.com", openIn: "ws-user" });
  await pushManagedRoutes("{ not valid json");
  const win = makeFakeWindow({ ready: true, workspaces: [] });

  Assert.deepEqual(
    gZenSpaceRoutingManager.getManagedRoutes(),
    [],
    "A malformed managed-routes pref yields no managed routes"
  );
  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://github.com", {}, win),
    "ws-user",
    "Routing still falls through to user routes when the pref is malformed"
  );

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_cleared_pref_has_no_managed_routes() {
  clearAllRoutes();
  await pushManagedRoutes([{ reference: "github.com", openIn: "ws-a" }]);
  Assert.equal(
    gZenSpaceRoutingManager.getManagedRoutes().length,
    1,
    "Managed routes are present while the pref is set"
  );
  await SpecialPowers.popPrefEnv();

  Assert.deepEqual(
    gZenSpaceRoutingManager.getManagedRoutes(),
    [],
    "Managed routes disappear once the pref is cleared"
  );
});

add_task(async function test_managed_routes_render_readonly_in_dialog() {
  clearAllRoutes();
  await pushManagedRoutes([
    { reference: "github.com", matchType: "contains", openInSpace: "Work" },
  ]);

  const dlg = await openRoutingDialog();
  try {
    const doc = dlg.document;

    await TestUtils.waitForCondition(
      () => doc.querySelector(".sr-managed-container"),
      "The managed route renders a read-only row"
    );

    Assert.equal(
      doc.querySelectorAll(".sr-managed-container").length,
      1,
      "Exactly one managed row is rendered"
    );
    ok(
      doc.querySelector(".sr-managed-header"),
      "The managed section header is shown"
    );
    Assert.equal(
      doc.querySelector(".sr-managed-reference").getAttribute("value"),
      "github.com",
      "The managed row shows the configured reference"
    );
    Assert.equal(
      doc.querySelector(".sr-managed-target").getAttribute("value"),
      "Work",
      "The managed row shows the target Space name"
    );
    Assert.equal(
      gZenSpaceRoutingManager.getAllRoutes().length,
      0,
      "Managed routes are not part of the editable (user) routes"
    );
    Assert.equal(
      doc.querySelectorAll(".sr-rule-container").length,
      0,
      "No editable route rows are rendered for managed routes"
    );
    Assert.equal(
      doc.getElementById("sr-empty-content").style.display,
      "none",
      "The empty-state placeholder is hidden when managed routes exist"
    );
  } finally {
    await closeRoutingDialog(dlg);
    await SpecialPowers.popPrefEnv();
    clearAllRoutes();
  }
});
