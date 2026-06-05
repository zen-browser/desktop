/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  clearAllRoutes();
  const savedDefault = gZenSpaceRoutingManager.getDefaultExternalRoute();
  registerCleanupFunction(() => {
    clearAllRoutes();
    gZenSpaceRoutingManager.setDefaultExternalRoute(savedDefault);
  });
});

add_task(async function test_empty_route_shape_and_unique_ids() {
  const a = gZenSpaceRoutingManager.getEmptyRoute();
  const b = gZenSpaceRoutingManager.getEmptyRoute();

  Assert.equal(a.reference, "", "Empty route starts with no reference");
  Assert.equal(
    a.openIn,
    "most-recent-space",
    "Empty route defaults to most-recent-space"
  );
  Assert.equal(a.matchType, "contains", "Empty route defaults to 'contains'");
  Assert.equal(typeof a.id, "string", "Empty route has a string id");
  ok(a.id.length, "Empty route id is non-empty");
  Assert.notEqual(a.id, b.id, "Each empty route gets a unique id");
});

add_task(async function test_create_get_update_remove_lifecycle() {
  clearAllRoutes();
  Assert.equal(
    gZenSpaceRoutingManager.getAllRoutes().length,
    0,
    "Precondition: no routes"
  );

  const created = gZenSpaceRoutingManager.createNewRoute();
  Assert.equal(
    gZenSpaceRoutingManager.getAllRoutes().length,
    1,
    "createNewRoute() appends one route"
  );

  created.reference = "zen-browser.app";
  created.openIn = "ws-42";
  created.matchType = "equal-to";
  gZenSpaceRoutingManager.updateRoute(created);

  const fetched = gZenSpaceRoutingManager.getRoute(created.id);
  Assert.equal(fetched.reference, "zen-browser.app", "reference persisted");
  Assert.equal(fetched.openIn, "ws-42", "openIn persisted");
  Assert.equal(fetched.matchType, "equal-to", "matchType persisted");

  gZenSpaceRoutingManager.removeRoute(created.id);
  Assert.equal(
    gZenSpaceRoutingManager.getAllRoutes().length,
    0,
    "removeRoute() deletes the route"
  );
});

add_task(async function test_remove_only_targets_the_given_id() {
  clearAllRoutes();
  const keep1 = addRoute({ reference: "a" });
  const drop = addRoute({ reference: "b" });
  const keep2 = addRoute({ reference: "c" });

  gZenSpaceRoutingManager.removeRoute(drop.id);

  const ids = gZenSpaceRoutingManager.getAllRoutes().map(r => r.id);
  Assert.deepEqual(
    ids,
    [keep1.id, keep2.id],
    "Only the targeted route is removed; order of the rest is preserved"
  );
});

add_task(async function test_reads_return_copies_not_internal_refs() {
  clearAllRoutes();
  const created = gZenSpaceRoutingManager.createNewRoute();

  const fromGet = gZenSpaceRoutingManager.getRoute(created.id);
  fromGet.reference = "mutated-via-getRoute";
  Assert.equal(
    gZenSpaceRoutingManager.getRoute(created.id).reference,
    "",
    "getRoute() returns a copy; external mutation does not leak"
  );

  const all = gZenSpaceRoutingManager.getAllRoutes();
  all[0].reference = "mutated-via-getAllRoutes";
  Assert.equal(
    gZenSpaceRoutingManager.getRoute(created.id).reference,
    "",
    "getAllRoutes() returns copies; external mutation does not leak"
  );
});

add_task(async function test_default_external_route_getter_setter() {
  gZenSpaceRoutingManager.setDefaultExternalRoute("ws-default");
  Assert.equal(
    gZenSpaceRoutingManager.getDefaultExternalRoute(),
    "ws-default",
    "setDefaultExternalRoute() round-trips through the getter"
  );

  gZenSpaceRoutingManager.setDefaultExternalRoute("most-recent-space");
  Assert.equal(
    gZenSpaceRoutingManager.getDefaultExternalRoute(),
    "most-recent-space",
    "The default external route can be changed again"
  );
});
