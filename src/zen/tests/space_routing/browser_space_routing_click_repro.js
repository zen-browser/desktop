/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SOURCE_PAGE =
  "https://example.com/browser/zen/tests/space_routing/space-routing-source.html";
const TARGET_PAGE =
  "https://example.org/browser/zen/tests/space_routing/space-routing-target.html";
const KEEP_OPEN = Services.env.get("ZEN_REPRO_KEEP_OPEN") === "1";

add_setup(async function () {
  clearAllRoutes();
  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.force-container-workspace", true]],
  });
  registerCleanupFunction(() => clearAllRoutes());
});

add_task(async function test_click_route_close_and_return_to_source_space() {
  await gZenWorkspaces.promiseInitialized;

  const spaceB = gZenWorkspaces.getActiveWorkspace();
  const targetIdentity = ContextualIdentityService.getPublicIdentities().find(
    identity => identity.userContextId !== spaceB.containerTabId
  );
  Assert.ok(targetIdentity, "A second contextual identity is available");

  const originalTestingEnabled = gZenUIManager.testingEnabled;
  gZenUIManager.testingEnabled = false;
  const spaceA = await gZenWorkspaces.createAndSaveWorkspace(
    "Space A - routed target",
    undefined,
    false,
    targetIdentity.userContextId
  );
  await gZenWorkspaces.changeWorkspace(spaceB);
  gZenUIManager.testingEnabled = originalTestingEnabled;

  const sourceTab = gBrowser.addTab(SOURCE_PAGE, {
    inBackground: false,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  await BrowserTestUtils.browserLoaded(
    sourceTab.linkedBrowser,
    false,
    SOURCE_PAGE
  );

  const fallbackTab = gBrowser.addTab("https://example.com/", {
    inBackground: true,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  await BrowserTestUtils.browserLoaded(fallbackTab.linkedBrowser, false, url =>
    url.startsWith("https://example.com/")
  );

  addRoute({
    reference: "example.org",
    matchType: "contains",
    openIn: spaceA.uuid,
  });

  let routedTab = null;
  try {
    const routedTabPromise = BrowserTestUtils.waitForNewTab(
      gBrowser,
      TARGET_PAGE,
      true
    );
    await BrowserTestUtils.synthesizeMouseAtCenter(
      "#open-routed-tab",
      {},
      sourceTab.linkedBrowser
    );
    routedTab = await routedTabPromise;

    await TestUtils.waitForCondition(
      () =>
        gZenWorkspaces.activeWorkspace === spaceA.uuid &&
        gBrowser.selectedTab === routedTab,
      "The clicked link opens a selected routed tab in Space A"
    );
    Assert.equal(
      routedTab.userContextId,
      targetIdentity.userContextId,
      "The routed tab uses Space A's container"
    );

    gBrowser.removeTab(routedTab, { animate: true });
    await gZenWorkspaces.changeWorkspace(spaceB);
    await TestUtils.waitForCondition(
      () => !routedTab.isConnected,
      "The routed tab finishes its animated close"
    );

    Assert.notEqual(
      gBrowser.selectedTab,
      routedTab,
      "The destroyed routed tab is no longer selected"
    );
    Assert.ok(
      gBrowser.selectedTab?.linkedBrowser,
      "Space B retains a selected tab with a live browser"
    );
    Assert.ok(
      !gBrowser._switcher?.requestedTab ||
        gBrowser._switcher.requestedTab.linkedBrowser,
      "AsyncTabSwitcher does not reference a tab without a browser"
    );

    gBrowser.selectedTab = fallbackTab;
    await TestUtils.waitForCondition(
      () => gBrowser.selectedTab === fallbackTab,
      "Another tab remains selectable after returning to Space B"
    );
    Assert.equal(
      gBrowser.selectedTab,
      fallbackTab,
      "Another tab is selectable after returning to Space B"
    );
    Assert.ok(
      fallbackTab.linkedBrowser,
      "The newly selected fallback tab has a live browser"
    );
  } finally {
    gZenUIManager.testingEnabled = originalTestingEnabled;
    if (!KEEP_OPEN) {
      clearAllRoutes();
      if (routedTab?.isConnected) {
        BrowserTestUtils.removeTab(routedTab);
      }
      if (spaceB) {
        await gZenWorkspaces.changeWorkspace(spaceB);
      }
      for (const tab of [sourceTab, fallbackTab]) {
        if (tab?.isConnected) {
          BrowserTestUtils.removeTab(tab);
        }
      }
      await gZenWorkspaces.removeWorkspace(spaceA.uuid);
    }
  }
});
