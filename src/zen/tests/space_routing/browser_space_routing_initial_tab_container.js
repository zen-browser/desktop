/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenSpaceRoutingNavigation } = ChromeUtils.importESModule(
  "resource:///modules/zen/ui/ZenSpaceRoutingNavigation.sys.mjs"
);

const TEST_ROOT = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);
const OPENER_URL = `${TEST_ROOT}file_space_routing_opener.html`;
const TARGET_URL = `${TEST_ROOT}file_space_routing_target.html`;

add_setup(async function () {
  clearAllRoutes();
  registerCleanupFunction(() => clearAllRoutes());
});

add_task(async function test_inherited_container_is_replaced_by_route() {
  await gZenWorkspaces.promiseInitialized;

  const originalWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
  const originalTabs = new Set(gBrowser.tabs);
  const targetWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Space Routing Container Test",
    undefined,
    false,
    1
  );
  const sourceWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Space Routing Source Container Test",
    undefined,
    false,
    2
  );

  let openerTab;
  let targetTab;
  let explicitContainerTab;
  let initialTab;
  let replacementTab;
  let replacementCount = 0;
  try {
    await gZenWorkspaces.changeWorkspace(sourceWorkspace);
    addRoute({
      reference: TARGET_URL,
      matchType: "equal-to",
      openIn: targetWorkspace.uuid,
    });

    openerTab = BrowserTestUtils.addTab(gBrowser, OPENER_URL, {
      inBackground: true,
    });
    await BrowserTestUtils.browserLoaded(openerTab.linkedBrowser);
    // Link-opening code passes the source principal and its inherited container
    // to addTab. The route must replace that inherited value before the browser
    // and its origin attributes are created.
    targetTab = BrowserTestUtils.addTab(gBrowser, TARGET_URL, {
      triggeringPrincipal: openerTab.linkedBrowser.contentPrincipal,
      userContextId: openerTab.userContextId,
    });

    Assert.equal(
      targetTab.getAttribute("zen-workspace-id"),
      targetWorkspace.uuid,
      "The target tab belongs to the routed workspace"
    );
    Assert.equal(
      targetTab.linkedBrowser.browsingContext.originAttributes.userContextId,
      targetWorkspace.containerTabId,
      "The target browser was created with the routed container origin attributes"
    );

    explicitContainerTab = BrowserTestUtils.addTab(gBrowser, TARGET_URL, {
      triggeringPrincipal: openerTab.linkedBrowser.contentPrincipal,
      userContextId: 3,
    });
    Assert.equal(
      explicitContainerTab.getAttribute("zen-workspace-id"),
      targetWorkspace.uuid,
      "An explicitly containerized tab is still routed to the target workspace"
    );
    Assert.equal(
      explicitContainerTab.userContextId,
      3,
      "An explicitly selected container is preserved"
    );

    initialTab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      triggeringPrincipal: openerTab.linkedBrowser.contentPrincipal,
      userContextId: openerTab.userContextId,
      skipRoute: true,
    });
    initialTab.setAttribute("zen-workspace-id", sourceWorkspace.uuid);

    const fakeWindow = {
      addEventListener() {},
      setTimeout: window.setTimeout.bind(window),
      gZenSpaceRoutingManager,
      gZenWorkspaces,
      gBrowser: {
        addTabsProgressListener() {},
        getTabForBrowser: browser => gBrowser.getTabForBrowser(browser),
        addTab: (...args) => {
          replacementCount++;
          replacementTab = gBrowser.addTab(...args);
          return replacementTab;
        },
        removeTab: (...args) => gBrowser.removeTab(...args),
      },
    };
    const navigation = new ZenSpaceRoutingNavigation(fakeWindow);
    const progress = { isTopLevel: true };
    const request = {
      QueryInterface() {
        return { URI: Services.io.newURI(TARGET_URL) };
      },
    };
    const stateFlags =
      Ci.nsIWebProgressListener.STATE_START |
      Ci.nsIWebProgressListener.STATE_IS_DOCUMENT;
    navigation.onStateChange(
      initialTab.linkedBrowser,
      progress,
      request,
      stateFlags
    );
    navigation.onStateChange(
      initialTab.linkedBrowser,
      progress,
      request,
      stateFlags
    );

    await TestUtils.waitForCondition(
      () => replacementTab && !initialTab.isConnected,
      "The incorrectly containerized initial tab is replaced"
    );
    Assert.equal(
      replacementCount,
      1,
      "Repeated progress notifications only replace the tab once"
    );
    Assert.equal(
      replacementTab.getAttribute("zen-workspace-id"),
      targetWorkspace.uuid,
      "The replacement tab belongs to the routed workspace"
    );
    Assert.equal(
      replacementTab.linkedBrowser.browsingContext.originAttributes
        .userContextId,
      targetWorkspace.containerTabId,
      "The replacement browser has the routed container origin attributes"
    );
  } finally {
    if (replacementTab?.isConnected) {
      BrowserTestUtils.removeTab(replacementTab);
    }
    if (initialTab?.isConnected) {
      BrowserTestUtils.removeTab(initialTab);
    }
    if (targetTab?.isConnected) {
      BrowserTestUtils.removeTab(targetTab);
    }
    if (explicitContainerTab?.isConnected) {
      BrowserTestUtils.removeTab(explicitContainerTab);
    }
    for (const tab of [...gBrowser.tabs]) {
      if (!originalTabs.has(tab)) {
        BrowserTestUtils.removeTab(tab);
      }
    }
    await gZenWorkspaces.changeWorkspace(originalWorkspace);
    await gZenWorkspaces.removeWorkspace(sourceWorkspace.uuid);
    await gZenWorkspaces.removeWorkspace(targetWorkspace.uuid);
  }
});
