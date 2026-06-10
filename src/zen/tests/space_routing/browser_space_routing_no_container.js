/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Regression test: a Space-Routing rule that targets a Space with NO container
// (containerTabId 0) must stay authoritative.
//
// The tabbrowser integration gated on `if (beforeRouteResult.userContextId)` — a
// truthiness check — so a No-Container route (userContextId 0) was treated as
// "no route found", and getContextIdIfNeeded then hijacked the tab into the
// active container-bound Space's container. A tab routed to the No-Container
// Space must open with no container, regardless of the active Space's container.

const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);

add_setup(async function () {
  // Opening tabs/new UI can emit benign Fluent/glance rejections in a dev build.
  PromiseTestUtils.allowMatchingRejectionsGlobally(
    /destroyed before query|Couldn't find a message/
  );
  clearAllRoutes();
  registerCleanupFunction(() => clearAllRoutes());
});

add_task(async function test_no_container_route_not_hijacked() {
  const defaultWs = gZenWorkspaces.getWorkspaces()[0];
  Assert.ok(defaultWs, "a default workspace exists");
  Assert.ok(
    !defaultWs.containerTabId,
    "the default workspace has no container"
  );

  // A container-bound Space (userContextId 1 is a built-in container), switched
  // to so it is the active Space.
  await gZenWorkspaces.createAndSaveWorkspace(
    "Route Hijack Work",
    undefined,
    false,
    1
  );
  const workWs = gZenWorkspaces.getWorkspaces().at(-1);
  Assert.equal(
    workWs.containerTabId,
    1,
    "work-like Space is bound to container 1"
  );
  Assert.equal(
    gZenWorkspaces.activeWorkspace,
    workWs.uuid,
    "the container Space is active"
  );

  // Route example.com -> the No-Container default Space.
  addRoute({
    reference: "example.com",
    matchType: "contains",
    openIn: defaultWs.uuid,
  });

  // Open a routed tab while sitting in the container Space.
  const tab = gBrowser.addTab("https://example.com/", {
    inBackground: true,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });

  Assert.equal(
    parseInt(tab.getAttribute("usercontextid") || "0", 10),
    0,
    "a tab routed to the No-Container Space is not hijacked into the active container"
  );

  // cleanup: let the async route-to-workspace settle, then restore state.
  await flushEventLoop();
  BrowserTestUtils.removeTab(tab);
  await gZenWorkspaces.changeWorkspace(defaultWs);
  await gZenWorkspaces.removeWorkspace(workWs.uuid);
});

add_task(async function test_explicit_container_overrides_route() {
  // Mirror production: a container maps to its Space (default-on pref).
  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.force-container-workspace", true]],
  });
  const defaultWs = gZenWorkspaces.getWorkspaces()[0];

  // A Work-like Space bound to container 2 (distinct from any other test's
  // container so the container->Space mapping is unique), created without
  // switching to it, so the active Space stays the No-Container Default.
  await gZenWorkspaces.createAndSaveWorkspace(
    "Override Work",
    undefined,
    true,
    2
  );
  const workWs = gZenWorkspaces.getWorkspaces().at(-1);
  Assert.equal(
    workWs.containerTabId,
    2,
    "work-like Space bound to container 2"
  );
  if (gZenWorkspaces.activeWorkspace !== defaultWs.uuid) {
    await gZenWorkspaces.changeWorkspace(defaultWs);
  }

  // Route example.com -> the No-Container Default Space.
  addRoute({
    reference: "example.com",
    matchType: "contains",
    openIn: defaultWs.uuid,
  });

  // Explicitly open in container 2 ("Open in New Container Tab" passes
  // userContextId straight through to addTab). The deliberate container choice
  // must win over the No-Container route — both the container and its Space.
  const tab = gBrowser.addTab("https://example.com/", {
    inBackground: true,
    userContextId: 2,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });

  Assert.equal(
    parseInt(tab.getAttribute("usercontextid") || "0", 10),
    2,
    "explicit container choice overrides the route's No-Container"
  );
  Assert.equal(
    tab.getAttribute("zen-workspace-id"),
    workWs.uuid,
    "explicit container choice lands in its own Space, not the routed one"
  );

  await flushEventLoop();
  BrowserTestUtils.removeTab(tab);
  await gZenWorkspaces.removeWorkspace(workWs.uuid);
});
