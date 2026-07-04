/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { openGlanceOnTab } = ChromeUtils.importESModule(
  "resource://testing-common/GlanceTestUtils.sys.mjs"
);

const ROUTE_REFERENCE = "example.com";

function getTabContainerId(tab) {
  return parseInt(tab.getAttribute("usercontextid") ?? "0", 10) || 0;
}

async function cleanupRoutingFixture(fixture, glanceTabs = []) {
  clearAllRoutes();
  if (!fixture) {
    return;
  }

  const { sourceWorkspace, targetWorkspace, parentTab } = fixture;
  if (
    gZenWorkspaces.getWorkspaceFromId(sourceWorkspace.uuid) &&
    gZenWorkspaces.activeWorkspace !== sourceWorkspace.uuid
  ) {
    await gZenWorkspaces.changeWorkspace(sourceWorkspace);
  }

  for (const tab of glanceTabs) {
    if (tab?.isConnected && !tab.closing) {
      await BrowserTestUtils.removeTab(tab);
    }
  }

  if (parentTab?.group) {
    gBrowser.ungroupTab(parentTab);
  }
  if (parentTab?.isConnected && !parentTab.closing) {
    await BrowserTestUtils.removeTab(parentTab);
  }
  if (gZenWorkspaces.getWorkspaceFromId(targetWorkspace.uuid)) {
    await gZenWorkspaces.removeWorkspace(targetWorkspace.uuid);
  }
}

async function createRoutingFixture({ containerMismatch = false } = {}) {
  clearAllRoutes();
  await gZenWorkspaces.promiseInitialized;

  const sourceWorkspace = gZenWorkspaces.getActiveWorkspace();
  const sourceContainerId = sourceWorkspace.containerTabId ?? 0;
  const parentTab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
    skipRoute: true,
    userContextId: sourceContainerId,
  });
  gBrowser.selectedTab = parentTab;

  const tabContainerId = getTabContainerId(parentTab);
  let targetContainerId = tabContainerId;
  if (containerMismatch) {
    targetContainerId = tabContainerId === 1 ? 2 : 1;
  }
  const targetWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Glance Routing Target",
    undefined,
    false,
    targetContainerId
  );
  await gZenWorkspaces.changeWorkspace(sourceWorkspace);
  gBrowser.selectedTab = parentTab;

  addRoute({
    reference: ROUTE_REFERENCE,
    matchType: "contains",
    openIn: targetWorkspace.uuid,
  });

  return {
    parentTab,
    sourceWorkspace,
    tabContainerId,
    targetWorkspace,
  };
}

async function waitForGlanceUrl(glanceTab) {
  await TestUtils.waitForCondition(
    () => glanceTab.linkedBrowser.currentURI.spec.includes(ROUTE_REFERENCE),
    "The glance loaded the routed URL"
  );
}

async function openRoutedGlance() {
  let glanceTab;
  await openGlanceOnTab(
    window,
    tab => {
      glanceTab = tab;
    },
    false
  );

  ok(glanceTab, "The glance opened");
  await waitForGlanceUrl(glanceTab);
  return glanceTab;
}

add_setup(async function () {
  clearAllRoutes();
  await gZenWorkspaces.promiseInitialized;
  registerCleanupFunction(() => clearAllRoutes());
});

add_task(async function test_expanded_glance_routes_to_workspace() {
  let fixture;
  let glanceTab;
  try {
    fixture = await createRoutingFixture();
    glanceTab = await openRoutedGlance();

    Assert.equal(
      glanceTab.owner,
      fixture.parentTab,
      "The glance is owned by its source tab"
    );

    await gZenGlanceManager.fullyOpenGlance();

    Assert.equal(
      glanceTab.getAttribute("zen-workspace-id"),
      fixture.targetWorkspace.uuid,
      "The expanded glance moved to the routed workspace"
    );
    Assert.equal(
      getTabContainerId(glanceTab),
      fixture.targetWorkspace.containerTabId ?? 0,
      "The routed tab uses the destination workspace container"
    );
    Assert.equal(
      gZenWorkspaces.activeWorkspace,
      fixture.targetWorkspace.uuid,
      "The destination workspace is active when expansion resolves"
    );
    Assert.equal(
      gBrowser.selectedTab,
      glanceTab,
      "The expanded glance is selected in the destination workspace"
    );

    await gZenWorkspaces.changeWorkspace(fixture.sourceWorkspace);
    Assert.equal(
      gBrowser.selectedTab,
      fixture.parentTab,
      "Switching back to the source selects the glance parent"
    );
  } finally {
    await cleanupRoutingFixture(fixture, [glanceTab]);
  }
});

add_task(async function test_container_mismatch_stays_in_source_workspace() {
  let fixture;
  let glanceTab;
  try {
    fixture = await createRoutingFixture({ containerMismatch: true });
    Assert.notEqual(
      fixture.tabContainerId,
      fixture.targetWorkspace.containerTabId ?? 0,
      "The route target uses a different container"
    );

    glanceTab = await openRoutedGlance();
    await gZenGlanceManager.fullyOpenGlance();

    Assert.equal(
      glanceTab.getAttribute("zen-workspace-id"),
      fixture.sourceWorkspace.uuid,
      "A container mismatch leaves the expanded glance in its source"
    );
    Assert.equal(
      getTabContainerId(glanceTab),
      fixture.tabContainerId,
      "The expanded glance keeps its live container"
    );
    Assert.equal(
      gZenWorkspaces.activeWorkspace,
      fixture.sourceWorkspace.uuid,
      "A container mismatch does not switch workspaces"
    );
    Assert.equal(
      gBrowser.selectedTab,
      glanceTab,
      "A container mismatch keeps the expanded glance selected"
    );
  } finally {
    await cleanupRoutingFixture(fixture, [glanceTab]);
  }
});

add_task(async function test_pinned_glance_is_not_routed() {
  let fixture;
  let glanceTab;
  const previousReduceMotionOverride = window.gReduceMotionOverride;
  try {
    fixture = await createRoutingFixture();
    glanceTab = await openRoutedGlance();

    window.gReduceMotionOverride = false;
    const expansion = gZenGlanceManager.fullyOpenGlance();
    const wasPromoted = !glanceTab.hasAttribute("glance-id");
    gBrowser.pinTab(glanceTab);
    const wasPinned = glanceTab.pinned;
    await expansion;

    ok(wasPromoted, "The glance was promoted before it was pinned");
    ok(wasPinned, "The promoted glance was pinned during expansion");
    Assert.equal(
      glanceTab.getAttribute("zen-workspace-id"),
      fixture.sourceWorkspace.uuid,
      "A pinned expanded glance stays in its source workspace"
    );
    Assert.equal(
      gZenWorkspaces.activeWorkspace,
      fixture.sourceWorkspace.uuid,
      "A pinned expanded glance does not switch workspaces"
    );
  } finally {
    window.gReduceMotionOverride = previousReduceMotionOverride;
    await cleanupRoutingFixture(fixture, [glanceTab]);
  }
});

add_task(async function test_grouped_glance_is_not_routed() {
  let fixture;
  let glanceTab;
  try {
    fixture = await createRoutingFixture();
    const group = gBrowser.addTabGroup([fixture.parentTab], {
      label: "",
      insertBefore: fixture.parentTab,
    });
    Assert.equal(
      fixture.parentTab.group,
      group,
      "The glance parent is grouped"
    );

    glanceTab = await openRoutedGlance();
    await gZenGlanceManager.fullyOpenGlance();

    ok(!glanceTab.pinned, "The grouped expanded glance is not pinned");
    Assert.equal(
      glanceTab.group,
      group,
      "The expanded glance remains in its parent's group"
    );
    Assert.equal(
      glanceTab.getAttribute("zen-workspace-id"),
      fixture.sourceWorkspace.uuid,
      "A grouped expanded glance stays in its source workspace"
    );
    Assert.equal(
      gZenWorkspaces.activeWorkspace,
      fixture.sourceWorkspace.uuid,
      "A grouped expanded glance does not switch workspaces"
    );
  } finally {
    await cleanupRoutingFixture(fixture, [glanceTab]);
  }
});
