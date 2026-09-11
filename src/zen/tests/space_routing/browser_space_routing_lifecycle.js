/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function withRoutingWorkspace(callback) {
  clearAllRoutes();
  await gZenWorkspaces.promiseInitialized;

  const sourceWorkspace = gZenWorkspaces.getActiveWorkspace();
  const identity = ContextualIdentityService.create(
    "Space Routing Lifecycle Test",
    "fingerprint",
    "blue"
  );
  const originalTestingEnabled = gZenUIManager.testingEnabled;
  let targetWorkspace;

  // Exercise real empty-tab selection, which Zen testing mode disables.
  gZenUIManager.testingEnabled = false;
  try {
    targetWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
      "SR Lifecycle Test",
      undefined,
      false,
      identity.userContextId
    );
    await gZenWorkspaces.changeWorkspace(sourceWorkspace);
    await callback({ sourceWorkspace, targetWorkspace, identity });
  } finally {
    try {
      clearAllRoutes();
      await gZenWorkspaces.changeWorkspace(sourceWorkspace);
      if (targetWorkspace) {
        await gZenWorkspaces.removeWorkspace(targetWorkspace.uuid);
      }
    } finally {
      gZenUIManager.testingEnabled = originalTestingEnabled;
      ContextualIdentityService.remove(identity.userContextId);
    }
  }
}

async function waitForValidSelection() {
  await TestUtils.waitForCondition(
    () => !gBrowser._switcher,
    "The async tab switcher finishes"
  );
  ok(gBrowser.selectedTab?.isConnected, "The selected tab remains connected");
  ok(!gBrowser.selectedTab?.closing, "The selected tab is not closing");
  ok(gBrowser.selectedTab?.linkedBrowser, "The selected tab retains a browser");
}

add_task(
  async function test_routed_foreground_tab_waits_for_workspace_change() {
    await withRoutingWorkspace(async ({ targetWorkspace, identity }) => {
      const originalTab = gBrowser.selectedTab;
      ok(
        originalTab?.linkedBrowser,
        "Precondition: setup leaves a valid selected browser"
      );

      addRoute({
        reference: "routing-order.invalid",
        matchType: "contains",
        openIn: targetWorkspace.uuid,
      });

      const ws = gZenWorkspaces;
      const originalChangeWorkspace = ws.changeWorkspace;
      let selectedWhenWorkspaceChangeStarted = null;
      ws.changeWorkspace = async function (workspace, ...args) {
        selectedWhenWorkspaceChangeStarted = gBrowser.selectedTab;
        return originalChangeWorkspace.call(this, workspace, ...args);
      };

      let routedTab;
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
          routedTab.owner,
          null,
          "A deferred routed tab does not inherit an owner from another workspace"
        );
        Assert.equal(
          routedTab.userContextId,
          identity.userContextId,
          "The routed tab uses the target workspace's container"
        );
        await TestUtils.waitForCondition(
          () =>
            gZenWorkspaces.activeWorkspace === targetWorkspace.uuid &&
            gBrowser.selectedTab === routedTab,
          "The routed tab becomes selected in its target workspace"
        );

        await BrowserTestUtils.removeTab(routedTab);
        routedTab = null;
        await waitForValidSelection();
      } finally {
        ws.changeWorkspace = originalChangeWorkspace;
        if (routedTab?.isConnected) {
          await BrowserTestUtils.removeTab(routedTab);
        }
      }
    });
  }
);

add_task(
  async function test_routed_tab_close_does_not_leave_stale_workspace_selection() {
    await withRoutingWorkspace(async ({ sourceWorkspace, targetWorkspace }) => {
      const sourceTab = gBrowser.addTab("https://example.com/", {
        inBackground: false,
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
      });
      let routedTab;
      try {
        await TestUtils.waitForCondition(
          () => gBrowser.selectedTab === sourceTab,
          "A regular source tab is selected in the source workspace"
        );
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

        ok(
          gZenWorkspaces.getTabsToExclude(routedTab).includes(sourceTab),
          "The owner in another workspace is excluded as a blur target"
        );
        Assert.notEqual(
          gBrowser._findTabToBlurTo(routedTab),
          sourceTab,
          "Closing a routed tab does not blur to its owner in another workspace"
        );

        gBrowser.removeTab(routedTab, { animate: true });
        await gZenWorkspaces.changeWorkspace(sourceWorkspace);
        await TestUtils.waitForCondition(
          () => !routedTab.isConnected,
          "The routed tab finishes closing after the workspace change"
        );

        await gZenWorkspaces.changeWorkspace(targetWorkspace);
        Assert.equal(
          gZenWorkspaces.activeWorkspace,
          targetWorkspace.uuid,
          "The target workspace is active again after the routed tab closes"
        );
        Assert.notEqual(
          gZenWorkspaces.lastSelectedWorkspaceTabs[targetWorkspace.uuid],
          routedTab,
          "Returning to the target workspace does not retain its closed selection"
        );
        Assert.notEqual(
          gBrowser.selectedTab,
          routedTab,
          "Returning to the target workspace does not reselect the closed tab"
        );
        await waitForValidSelection();
      } finally {
        if (routedTab?.isConnected) {
          await BrowserTestUtils.removeTab(routedTab);
        }
        await gZenWorkspaces.changeWorkspace(sourceWorkspace);
        if (sourceTab.isConnected) {
          await BrowserTestUtils.removeTab(sourceTab);
        }
      }
    });
  }
);
