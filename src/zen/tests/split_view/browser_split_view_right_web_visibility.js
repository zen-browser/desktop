/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function getRightWebContainer(tab) {
  return tab.linkedBrowser?.closest(".browserSidebarContainer");
}

function getActiveSplitters() {
  return [...document.querySelectorAll(".zen-split-view-splitter")].filter(
    splitter => splitter.isConnected
  );
}

function assertSimpleRightWebHiddenLayout(leftTab, rightTab, message) {
  const leftContainer = getRightWebContainer(leftTab);
  const rightContainer = getRightWebContainer(rightTab);

  Assert.deepEqual(
    {
      top: leftContainer.style.top,
      right: leftContainer.style.right,
      bottom: leftContainer.style.bottom,
      left: leftContainer.style.left,
    },
    { top: "0%", right: "0%", bottom: "0%", left: "0%" },
    `${message}: the left web pane should fill the split web area`
  );
  Assert.ok(
    !rightContainer.hasAttribute("zen-split"),
    `${message}: the hidden right container should not be in the visible split layout`
  );
  Assert.equal(
    getActiveSplitters().length,
    0,
    `${message}: hidden right slot should not leave active splitters`
  );
}

function captureSimpleRightWebLayout(leftTab, rightTab) {
  const leftContainer = getRightWebContainer(leftTab);
  const rightContainer = getRightWebContainer(rightTab);
  return {
    leftStyle: {
      top: leftContainer.style.top,
      right: leftContainer.style.right,
      bottom: leftContainer.style.bottom,
      left: leftContainer.style.left,
    },
    rightStyle: {
      top: rightContainer.style.top,
      right: rightContainer.style.right,
      bottom: rightContainer.style.bottom,
      left: rightContainer.style.left,
    },
    rightContainerZenSplit: rightContainer.hasAttribute("zen-split"),
    activeSplitterCount: getActiveSplitters().length,
  };
}

function assertSimpleRightWebLayoutPreserved(
  state,
  leftTab,
  rightTab,
  message
) {
  Assert.deepEqual(
    captureSimpleRightWebLayout(leftTab, rightTab),
    state,
    `${message}: split web layout should be preserved`
  );
}

function captureRightWebState(baseTab, rightTab, extraTabs = []) {
  const rightContainer = getRightWebContainer(rightTab);
  const inspectedTabs = [...new Set([baseTab, rightTab, ...extraTabs])];
  return {
    currentView: gZenViewSplitter.currentView,
    group: rightTab.group,
    groupTabs: [...(rightTab.group?.tabs ?? [])],
    selectedTab: gBrowser.selectedTab,
    splitViewBrowsers: [...gZenViewSplitter.splitViewBrowsers],
    tabStates: new Map(
      inspectedTabs.map(tab => [
        tab,
        {
          splitView: tab.splitView,
          splitViewValue: tab.splitViewValue,
          group: tab.group,
        },
      ])
    ),
    rightContainer,
    rightContainerIsZenSplit: rightContainer?.hasAttribute("is-zen-split"),
    rightContainerZenSplit: rightContainer?.hasAttribute("zen-split"),
    rightContainerStyle: rightContainer?.getAttribute("style") ?? "",
    rightZenModeActive: rightTab.linkedBrowser.zenModeActive,
    rightDocShellIsActive: rightTab.linkedBrowser.docShellIsActive,
  };
}

function assertRightWebMembershipPreserved(state, message) {
  Assert.equal(
    gZenViewSplitter.currentView,
    state.currentView,
    `${message}: active split view should stay active`
  );
  Assert.strictEqual(
    gBrowser.selectedTab,
    state.selectedTab,
    `${message}: selected tab should be preserved`
  );
  Assert.deepEqual(
    gZenViewSplitter.splitViewBrowsers,
    state.splitViewBrowsers,
    `${message}: split browser order should be preserved`
  );
  Assert.deepEqual(
    state.group?.tabs ?? [],
    state.groupTabs,
    `${message}: split group tabs should be preserved`
  );
  for (const [tab, tabState] of state.tabStates) {
    Assert.strictEqual(
      tab.group,
      tabState.group,
      `${message}: ${tab.label} group should be preserved`
    );
    Assert.equal(
      tab.splitView,
      tabState.splitView,
      `${message}: ${tab.label} split-view state should be preserved`
    );
    Assert.equal(
      tab.splitViewValue,
      tabState.splitViewValue,
      `${message}: ${tab.label} split-view value should be preserved`
    );
  }
}

add_task(async function test_right_web_visibility_api_fails_closed_when_right_container_missing() {
  const [baseTab, rightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(9)),
    addTabTo(gBrowser, getUrlForNthTab(10)),
  ]);

  try {
    await createSplitView([baseTab, rightTab], "vsep");
    const shownState = captureRightWebState(baseTab, rightTab);
    const shownLayout = captureSimpleRightWebLayout(baseTab, rightTab);
    const rightBrowser = rightTab.linkedBrowser;
    const originalClosest = rightBrowser.closest;
    let result;
    try {
      rightBrowser.closest = function(selector) {
        if (selector === ".browserSidebarContainer") {
          return null;
        }
        return originalClosest.call(this, selector);
      };
      result = gZenViewSplitter.setRightSplitWebVisible(false);
    } finally {
      rightBrowser.closest = originalClosest;
    }

    Assert.deepEqual(
      result,
      { ok: false, reason: "missing-right-container" },
      "Missing right container should fail closed"
    );
    assertRightWebMembershipPreserved(
      shownState,
      "Failing with a missing right container"
    );
    assertSimpleRightWebLayoutPreserved(
      shownLayout,
      baseTab,
      rightTab,
      "Failing with a missing right container"
    );
    Assert.equal(
      rightTab.linkedBrowser.zenModeActive,
      shownState.rightZenModeActive,
      "Failing with a missing right container should not change Zen mode"
    );
    Assert.equal(
      rightTab.linkedBrowser.docShellIsActive,
      shownState.rightDocShellIsActive,
      "Failing with a missing right container should not change docshell state"
    );
  } finally {
    for (const tab of [rightTab, baseTab]) {
      if (tab.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_right_web_visibility_api_hides_and_shows_right_page() {
  const [baseTab, rightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
  ]);

  try {
    await createSplitView([baseTab, rightTab], "vsep");
    gBrowser.selectedTab = rightTab;

    const shownState = captureRightWebState(baseTab, rightTab);
    Assert.ok(
      shownState.rightContainerZenSplit,
      "The right web container should start visible in split view"
    );
    Assert.ok(
      shownState.rightZenModeActive,
      "The right web docshell should start in Zen active mode"
    );
    Assert.ok(
      shownState.rightDocShellIsActive,
      "The right web docshell should start active"
    );

    const hideResult = gZenViewSplitter.setRightSplitWebVisible(false);
    Assert.deepEqual(
      hideResult,
      { ok: true, action: "hidden" },
      "Hiding should return a structured success"
    );
    assertRightWebMembershipPreserved(
      shownState,
      "Hiding the right web page"
    );

    const hiddenContainer = getRightWebContainer(rightTab);
    assertSimpleRightWebHiddenLayout(
      baseTab,
      rightTab,
      "Hiding the right web page"
    );
    Assert.ok(
      hiddenContainer.hasAttribute("is-zen-split"),
      "Hiding should keep the right container associated with split view"
    );
    Assert.ok(
      !hiddenContainer.hasAttribute("zen-split"),
      "Hiding should remove the right container from the visible split layout"
    );
    Assert.equal(
      rightTab.linkedBrowser.zenModeActive,
      false,
      "Hiding should deactivate Zen mode for the right docshell"
    );
    Assert.equal(
      rightTab.linkedBrowser.docShellIsActive,
      false,
      "Hiding should deactivate the right docshell"
    );

    const hiddenState = captureRightWebState(baseTab, rightTab);
    const showResult = gZenViewSplitter.setRightSplitWebVisible(true);
    Assert.deepEqual(
      showResult,
      { ok: true, action: "shown" },
      "Showing should return a structured success"
    );
    assertRightWebMembershipPreserved(
      hiddenState,
      "Showing the right web page"
    );

    const restoredContainer = getRightWebContainer(rightTab);
    Assert.ok(
      restoredContainer.hasAttribute("zen-split"),
      "Showing should restore the right container to the visible split layout"
    );
    Assert.equal(
      restoredContainer.getAttribute("style") ?? "",
      shownState.rightContainerStyle,
      "Showing should preserve the right container layout style"
    );
    Assert.equal(
      getActiveSplitters().length,
      1,
      "Showing should restore the simple two-pane splitter"
    );
    Assert.equal(
      rightTab.linkedBrowser.zenModeActive,
      true,
      "Showing should reactivate Zen mode for the right docshell"
    );
    Assert.equal(
      rightTab.linkedBrowser.docShellIsActive,
      true,
      "Showing should reactivate the right docshell"
    );
  } finally {
    for (const tab of [rightTab, baseTab]) {
      if (tab.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_right_web_visibility_api_is_idempotent_for_repeated_visibility() {
  const [baseTab, rightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(11)),
    addTabTo(gBrowser, getUrlForNthTab(12)),
  ]);

  try {
    await createSplitView([baseTab, rightTab], "vsep");

    Assert.deepEqual(
      gZenViewSplitter.setRightSplitWebVisible(false),
      { ok: true, action: "hidden" },
      "First hide should return a structured success"
    );
    const hiddenState = captureRightWebState(baseTab, rightTab);
    const hiddenLayout = captureSimpleRightWebLayout(baseTab, rightTab);
    Assert.deepEqual(
      gZenViewSplitter.setRightSplitWebVisible(false),
      { ok: true, action: "hidden" },
      "Repeated hide should return the same structured success"
    );
    assertRightWebMembershipPreserved(hiddenState, "Repeated hide");
    assertSimpleRightWebLayoutPreserved(
      hiddenLayout,
      baseTab,
      rightTab,
      "Repeated hide"
    );

    Assert.deepEqual(
      gZenViewSplitter.setRightSplitWebVisible(true),
      { ok: true, action: "shown" },
      "First show should return a structured success"
    );
    const shownState = captureRightWebState(baseTab, rightTab);
    const shownLayout = captureSimpleRightWebLayout(baseTab, rightTab);
    Assert.deepEqual(
      gZenViewSplitter.setRightSplitWebVisible(true),
      { ok: true, action: "shown" },
      "Repeated show should return the same structured success"
    );
    assertRightWebMembershipPreserved(shownState, "Repeated show");
    assertSimpleRightWebLayoutPreserved(
      shownLayout,
      baseTab,
      rightTab,
      "Repeated show"
    );
  } finally {
    for (const tab of [rightTab, baseTab]) {
      if (tab.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_right_web_pref_hidden_before_split_creation_applies_to_new_split() {
  const [baseTab, rightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(7)),
    addTabTo(gBrowser, getUrlForNthTab(8)),
  ]);

  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitCompanion.enabled", true],
      ["zen.splitCompanion.rightWeb.visible", false],
    ],
  });

  try {
    gZenViewSplitter.deactivateCurrentSplitView();
    await createSplitView([baseTab, rightTab], "vsep");

    assertSimpleRightWebHiddenLayout(
      baseTab,
      rightTab,
      "Creating a split after the right web pref was hidden"
    );
    Assert.equal(
      rightTab.linkedBrowser.zenModeActive,
      false,
      "Creating a split should apply the pref-hidden Zen mode state"
    );
    Assert.equal(
      rightTab.linkedBrowser.docShellIsActive,
      false,
      "Creating a split should apply the pref-hidden docshell state"
    );
  } finally {
    await SpecialPowers.popPrefEnv();
    for (const tab of [rightTab, baseTab]) {
      if (tab.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_right_web_visibility_api_rejects_missing_and_complex_splits() {
  const [soloTab, baseTab, rightTab, thirdTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(3)),
    addTabTo(gBrowser, getUrlForNthTab(4)),
    addTabTo(gBrowser, getUrlForNthTab(5)),
    addTabTo(gBrowser, getUrlForNthTab(6)),
  ]);

  try {
    gZenViewSplitter.deactivateCurrentSplitView();
    gBrowser.selectedTab = soloTab;
    const soloState = {
      selectedTab: gBrowser.selectedTab,
      currentView: gZenViewSplitter.currentView,
      containerZenSplit: getRightWebContainer(soloTab)?.hasAttribute(
        "zen-split"
      ),
      zenModeActive: soloTab.linkedBrowser.zenModeActive,
      docShellIsActive: soloTab.linkedBrowser.docShellIsActive,
    };

    Assert.deepEqual(
      gZenViewSplitter.setRightSplitWebVisible(false),
      { ok: false, reason: "missing-active-split" },
      "Hiding without an active split should fail closed"
    );
    Assert.deepEqual(
      {
        selectedTab: gBrowser.selectedTab,
        currentView: gZenViewSplitter.currentView,
        containerZenSplit: getRightWebContainer(soloTab)?.hasAttribute(
          "zen-split"
        ),
        zenModeActive: soloTab.linkedBrowser.zenModeActive,
        docShellIsActive: soloTab.linkedBrowser.docShellIsActive,
      },
      soloState,
      "Failing without an active split should not mutate tab or container state"
    );

    await createSplitView([baseTab, rightTab, thirdTab], "grid");
    const complexState = captureRightWebState(baseTab, rightTab, [thirdTab]);
    Assert.deepEqual(
      gZenViewSplitter.setRightSplitWebVisible(false),
      { ok: false, reason: "complex-layout" },
      "Complex layouts should fail closed"
    );
    assertRightWebMembershipPreserved(
      complexState,
      "Rejecting a complex layout"
    );
    Assert.equal(
      getRightWebContainer(rightTab)?.hasAttribute("zen-split"),
      complexState.rightContainerZenSplit,
      "Rejecting a complex layout should not change right container visibility"
    );
    Assert.equal(
      rightTab.linkedBrowser.zenModeActive,
      complexState.rightZenModeActive,
      "Rejecting a complex layout should not change Zen docshell state"
    );
    Assert.equal(
      rightTab.linkedBrowser.docShellIsActive,
      complexState.rightDocShellIsActive,
      "Rejecting a complex layout should not change docshell active state"
    );
  } finally {
    for (const tab of [thirdTab, rightTab, baseTab, soloTab]) {
      if (tab.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});
