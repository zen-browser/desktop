/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

let sourceWorkspace;
let targetWorkspace;
let otherWindow;

function windowForUri(uriString, defaultWindow) {
  return gZenSpaceRoutingManager.getWindowForExternalUri(
    Services.io.newURI(uriString),
    defaultWindow
  );
}

add_setup(async function () {
  clearAllRoutes();
  await gZenWorkspaces.promiseInitialized;

  const originalTabs = new Set(gBrowser.tabs);
  const originalDefaultRoute =
    gZenSpaceRoutingManager.getDefaultExternalRoute();

  sourceWorkspace = gZenWorkspaces.getActiveWorkspace();
  targetWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "SR External Window Test"
  );
  await gZenWorkspaces.changeWorkspace(sourceWorkspace);

  otherWindow = await BrowserTestUtils.openNewBrowserWindow();
  await otherWindow.gZenWorkspaces.promiseInitialized;
  await TestUtils.waitForCondition(
    () => otherWindow.gZenStartup?.isReady,
    "The second window finished starting up"
  );
  await otherWindow.gZenWorkspaces.changeWorkspace(targetWorkspace);

  Assert.equal(
    gZenWorkspaces.activeWorkspace,
    sourceWorkspace.uuid,
    "Precondition: this window displays the source space"
  );
  Assert.equal(
    otherWindow.gZenWorkspaces.activeWorkspace,
    targetWorkspace.uuid,
    "Precondition: the second window displays the target space"
  );

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(otherWindow);
    clearAllRoutes();
    gZenSpaceRoutingManager.setDefaultExternalRoute(originalDefaultRoute);
    await gZenWorkspaces.changeWorkspace(sourceWorkspace);
    await gZenWorkspaces.removeWorkspace(targetWorkspace.uuid);
    for (const tab of [...gBrowser.tabs]) {
      if (!originalTabs.has(tab)) {
        gBrowser.removeTab(tab, { animate: false, skipSessionStore: true });
      }
    }
  });
});

add_task(async function test_prefers_the_window_showing_the_target_space() {
  const route = addRoute({
    reference: "example.com",
    matchType: "contains",
    openIn: targetWorkspace.uuid,
  });

  Assert.equal(
    windowForUri("https://example.com/watch", window),
    otherWindow,
    "The URI is handed to the window already showing the target space"
  );
  Assert.equal(
    windowForUri("https://example.com/watch", otherWindow),
    otherWindow,
    "A window already on the target space keeps the URI"
  );

  gZenSpaceRoutingManager.removeRoute(route.id);
});

add_task(async function test_default_external_route_picks_its_window() {
  gZenSpaceRoutingManager.setDefaultExternalRoute(sourceWorkspace.uuid);

  Assert.equal(
    windowForUri("https://unmatched.example/", otherWindow),
    window,
    "An unmatched external URI follows the default route to its window"
  );

  gZenSpaceRoutingManager.setDefaultExternalRoute("most-recent-space");
});

add_task(async function test_unrouted_uri_keeps_the_default_window() {
  Assert.equal(
    windowForUri("https://unmatched.example/", otherWindow),
    otherWindow,
    "Without a destination space the window Firefox picked is kept"
  );
  Assert.equal(
    windowForUri("https://unmatched.example/", window),
    window,
    "The same holds for the other window"
  );
});

add_task(async function test_missing_space_keeps_the_default_window() {
  const route = addRoute({
    reference: "example.com",
    matchType: "contains",
    openIn: "ws-that-does-not-exist",
  });

  Assert.equal(
    windowForUri("https://example.com/watch", otherWindow),
    otherWindow,
    "A route pointing at a deleted space keeps the window Firefox picked"
  );

  gZenSpaceRoutingManager.removeRoute(route.id);
});

add_task(async function test_command_line_uri_opens_in_the_matching_window() {
  const pickedWindow = BrowserWindowTracker.getTopWindow();
  const destWindow = pickedWindow === window ? otherWindow : window;
  await pickedWindow.gZenWorkspaces.changeWorkspace(sourceWorkspace);
  await destWindow.gZenWorkspaces.changeWorkspace(targetWorkspace);

  const route = addRoute({
    reference: "example.com",
    matchType: "contains",
    openIn: targetWorkspace.uuid,
  });

  const url = "https://example.com/?gh-15209";
  const tabPromise = BrowserTestUtils.waitForNewTab(
    destWindow.gBrowser,
    url,
    true
  );

  const cmdLine = Cu.createCommandLine(
    [url],
    null,
    Ci.nsICommandLine.STATE_REMOTE_EXPLICIT
  );
  Cc["@mozilla.org/browser/final-clh;1"]
    .getService(Ci.nsICommandLineHandler)
    .handle(cmdLine);

  const tab = await tabPromise;
  Assert.equal(
    tab.getAttribute("zen-workspace-id"),
    targetWorkspace.uuid,
    "The routed tab lands in the target space"
  );
  Assert.equal(
    pickedWindow.gZenWorkspaces.activeWorkspace,
    sourceWorkspace.uuid,
    "The window Firefox picked stays on the space it was displaying"
  );
  Assert.equal(
    destWindow.gZenWorkspaces.activeWorkspace,
    targetWorkspace.uuid,
    "The window that received the URI stays on the target space"
  );

  BrowserTestUtils.removeTab(tab);
  gZenSpaceRoutingManager.removeRoute(route.id);
  await window.gZenWorkspaces.changeWorkspace(sourceWorkspace);
  await otherWindow.gZenWorkspaces.changeWorkspace(targetWorkspace);
});
