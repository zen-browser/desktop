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

add_task(async function test_no_match_returns_most_recent_space() {
  clearAllRoutes();
  addRoute({ reference: "github.com", matchType: "contains", openIn: "ws-1" });

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://example.com", {}),
    "most-recent-space",
    "A non-matching, non-external URL routes to most-recent-space"
  );
});

add_task(async function test_first_matching_route_wins() {
  clearAllRoutes();
  addRoute({ reference: "github", matchType: "contains", openIn: "ws-first" });
  addRoute({ reference: "github", matchType: "contains", openIn: "ws-second" });

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://github.com/zen", {}),
    "ws-first",
    "The openIn of the first matching route is returned, later matches ignored"
  );
});

add_task(async function test_external_default_only_applies_without_match() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setDefaultExternalRoute("ws-external");
  addRoute({ reference: "github", matchType: "contains", openIn: "ws-rule" });

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://github.com", {
      fromExternal: true,
    }),
    "ws-rule",
    "A matching rule wins even for external links"
  );

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://example.com", {
      fromExternal: true,
    }),
    "ws-external",
    "An unmatched external link uses the default external route"
  );

  Assert.equal(
    gZenSpaceRoutingManager.routeUri("https://example.com", {
      fromExternal: false,
    }),
    "most-recent-space",
    "An unmatched internal link ignores the external default"
  );
});
