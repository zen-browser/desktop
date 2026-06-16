/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";
function getTabContainer(tab) {
  return tab.linkedBrowser?.closest(".browserSidebarContainer");
}

function captureTabContainerState(tab) {
  const container = getTabContainer(tab);
  return {
    isZenSplit: container?.hasAttribute("is-zen-split"),
    zenSplit: container?.hasAttribute("zen-split"),
    headerCount: container?.querySelectorAll(
      ".zen-view-splitter-header-container"
    ).length,
    style: container?.getAttribute("style") ?? "",
    zenModeActive: tab.linkedBrowser.zenModeActive,
    docShellIsActive: tab.linkedBrowser.docShellIsActive,
  };
}

function captureSplitState(anchorTab, extraTabs = []) {
  const group = anchorTab.group;
  const inspectedTabs = [...new Set([...(group?.tabs ?? []), ...extraTabs])];
  return {
    selectedTab: gBrowser.selectedTab,
    splitViewBrowsers: [...gZenViewSplitter.splitViewBrowsers],
    group,
    groupTabs: [...(group?.tabs ?? [])],
    tabContainerStates: new Map(
      inspectedTabs.map(tab => [tab, captureTabContainerState(tab)])
    ),
    tabBrowserPanelSplitView:
      gZenViewSplitter.tabBrowserPanel.hasAttribute("zen-split-view"),
    tabboxSplitView: document
      .getElementById("tabbrowser-tabbox")
      ?.hasAttribute("zen-split-view"),
    splitterCount: document.querySelectorAll(".zen-split-view-splitter")
      .length,
  };
}

function assertSplitStateUnchanged(state, message) {
  Assert.strictEqual(
    gBrowser.selectedTab,
    state.selectedTab,
    `${message}: selected tab should not change`
  );
  Assert.deepEqual(
    gZenViewSplitter.splitViewBrowsers,
    state.splitViewBrowsers,
    `${message}: split browsers should not change`
  );
  Assert.strictEqual(
    state.groupTabs[0]?.group,
    state.group,
    `${message}: split group should stay attached`
  );
  Assert.deepEqual(
    state.group?.tabs ?? [],
    state.groupTabs,
    `${message}: split group tabs should not change`
  );
  for (const [tab, containerState] of state.tabContainerStates) {
    Assert.deepEqual(
      captureTabContainerState(tab),
      containerState,
      `${message}: ${tab.label} container and docshell state should not change`
    );
  }
  Assert.equal(
    gZenViewSplitter.tabBrowserPanel.hasAttribute("zen-split-view"),
    state.tabBrowserPanelSplitView,
    `${message}: tab browser panel split state should not change`
  );
  Assert.equal(
    document
      .getElementById("tabbrowser-tabbox")
      ?.hasAttribute("zen-split-view"),
    state.tabboxSplitView,
    `${message}: tabbox split state should not change`
  );
  Assert.equal(
    document.querySelectorAll(".zen-split-view-splitter").length,
    state.splitterCount,
    `${message}: splitters should not be added or removed`
  );
}

add_task(async function test_set_right_split_tab_creates_vertical_split() {
  const [baseTab, rightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
  ]);

  try {
    gBrowser.selectedTab = baseTab;

    const activationPromise = BrowserTestUtils.waitForEvent(
      window,
      "ZenViewSplitter:SplitViewActivated"
    );
    const result = gZenViewSplitter.setRightSplitTab(rightTab, { baseTab });
    await activationPromise;

    Assert.equal(result?.ok, true, "The right tab should be accepted");
    Assert.equal(result?.action, "created", "A new split should be created");
    Assert.strictEqual(
      gBrowser.selectedTab,
      rightTab,
      "The requested right tab should be selected"
    );
    Assert.deepEqual(
      gZenViewSplitter.splitViewBrowsers,
      [baseTab.linkedBrowser, rightTab.linkedBrowser],
      "The split browsers should keep the base tab on the left and target tab on the right"
    );
    Assert.equal(
      rightTab.group.tabs.length,
      2,
      "The split group should contain exactly the two split tabs"
    );
  } finally {
    for (const tab of [rightTab, baseTab]) {
      await BrowserTestUtils.removeTab(tab);
    }
  }
});

add_task(async function test_set_right_split_tab_activates_existing_split_tab() {
  const [baseTab, rightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
  ]);

  try {
    await createSplitView([baseTab, rightTab], "vsep");
    gBrowser.selectedTab = baseTab;

    const activationPromise = BrowserTestUtils.waitForEvent(
      window,
      "ZenViewSplitter:SplitViewActivated"
    );
    const result = gZenViewSplitter.setRightSplitTab(rightTab);
    await activationPromise;

    Assert.equal(result?.ok, true, "The existing split tab should be accepted");
    Assert.equal(
      result?.action,
      "activated",
      "The existing split tab should be activated"
    );
    Assert.strictEqual(
      gBrowser.selectedTab,
      rightTab,
      "The requested split tab should be selected"
    );
    Assert.equal(
      rightTab.group.tabs.length,
      2,
      "The split group should not gain duplicate tabs"
    );
    Assert.deepEqual(
      gZenViewSplitter.splitViewBrowsers,
      [baseTab.linkedBrowser, rightTab.linkedBrowser],
      "The split browsers should stay in their original order"
    );
  } finally {
    for (const tab of [rightTab, baseTab]) {
      await BrowserTestUtils.removeTab(tab);
    }
  }
});

add_task(async function test_set_right_split_tab_replaces_existing_right_split_tab() {
  const [baseTab, oldRightTab, newRightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
    addTabTo(gBrowser, getUrlForNthTab(3)),
  ]);

  try {
    await createSplitView([baseTab, oldRightTab], "vsep");
    gBrowser.selectedTab = baseTab;

    const activationPromise = BrowserTestUtils.waitForEvent(
      window,
      "ZenViewSplitter:SplitViewActivated"
    );
    const result = gZenViewSplitter.setRightSplitTab(newRightTab);

    Assert.equal(
      result?.ok,
      true,
      "The outside tab should replace the simple split right tab"
    );
    Assert.equal(
      result?.action,
      "replaced",
      "The result should describe a right-slot replacement"
    );
    if (result?.ok) {
      await activationPromise;
    }

    Assert.strictEqual(
      gBrowser.selectedTab,
      newRightTab,
      "The replacement right tab should be selected"
    );
    Assert.deepEqual(
      gZenViewSplitter.splitViewBrowsers,
      [baseTab.linkedBrowser, newRightTab.linkedBrowser],
      "The split browsers should keep the base tab on the left and replacement tab on the right"
    );
    Assert.strictEqual(
      gZenViewSplitter.splitViewBrowsers[1],
      newRightTab.linkedBrowser,
      "The replacement tab should occupy the right split browser slot"
    );
    Assert.equal(
      newRightTab.splitView,
      true,
      "The replacement right tab should enter split view state"
    );
    Assert.equal(
      newRightTab.splitViewValue,
      baseTab.splitViewValue,
      "The replacement right tab should share the active split view value"
    );
    Assert.strictEqual(
      newRightTab.group,
      baseTab.group,
      "The replacement right tab should join the base tab split group"
    );
    Assert.ok(
      newRightTab.group?.hasAttribute("split-view-group"),
      "The replacement right tab should be in a split tab group"
    );
    Assert.equal(
      oldRightTab.splitView,
      false,
      "The previous right tab should leave split view state"
    );
    Assert.ok(
      !oldRightTab.group?.hasAttribute("split-view-group"),
      "The previous right tab should leave the split tab group"
    );
    Assert.equal(
      newRightTab.group.tabs.length,
      2,
      "The split group should still contain exactly two tabs"
    );
  } finally {
    for (const tab of [newRightTab, oldRightTab, baseTab]) {
      if (tab?.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_set_right_split_tab_replacement_event_sees_final_state() {
  const [baseTab, oldRightTab, newRightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
    addTabTo(gBrowser, getUrlForNthTab(3)),
  ]);

  try {
    await createSplitView([baseTab, oldRightTab], "vsep");
    gBrowser.selectedTab = baseTab;
    const splitGroup = baseTab.group;
    let eventState = null;

    splitGroup.addEventListener(
      "ZenSplitViewTabsSplit",
      event => {
        eventState = {
          item: event.detail?.item,
          selectedTab: gBrowser.selectedTab,
          splitViewBrowsers: [...gZenViewSplitter.splitViewBrowsers],
          newRightSplitView: newRightTab.splitView,
          newRightSplitViewValue: newRightTab.splitViewValue,
          oldRightSplitView: oldRightTab.splitView,
          newRightGroup: newRightTab.group,
        };
      },
      { once: true }
    );

    const activationPromise = BrowserTestUtils.waitForEvent(
      window,
      "ZenViewSplitter:SplitViewActivated"
    );
    const result = gZenViewSplitter.setRightSplitTab(newRightTab);

    Assert.equal(result?.ok, true, "The replacement should succeed");
    if (result?.ok) {
      await activationPromise;
    }

    Assert.ok(eventState, "Replacing the right split tab should dispatch");
    Assert.strictEqual(
      eventState.item,
      splitGroup,
      "The split event should identify the updated split group"
    );
    Assert.strictEqual(
      eventState.selectedTab,
      newRightTab,
      "Split event observers should see the replacement tab selected"
    );
    Assert.deepEqual(
      eventState.splitViewBrowsers,
      [baseTab.linkedBrowser, newRightTab.linkedBrowser],
      "Split event observers should see the replacement tab in the right slot"
    );
    Assert.equal(
      eventState.newRightSplitView,
      true,
      "Split event observers should see the replacement tab in split view"
    );
    Assert.equal(
      eventState.newRightSplitViewValue,
      baseTab.splitViewValue,
      "Split event observers should see the final split view value"
    );
    Assert.equal(
      eventState.oldRightSplitView,
      false,
      "Split event observers should see the previous right tab reset"
    );
    Assert.strictEqual(
      eventState.newRightGroup,
      splitGroup,
      "Split event observers should see the replacement tab in the split group"
    );
  } finally {
    for (const tab of [newRightTab, oldRightTab, baseTab]) {
      if (tab?.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_set_right_split_tab_reports_replace_dependency_failure_without_mutation() {
  const [baseTab, rightTab, replacementTab, existingGroupTab] =
    await Promise.all([
      addTabTo(gBrowser, getUrlForNthTab(1)),
      addTabTo(gBrowser, getUrlForNthTab(2)),
      addTabTo(gBrowser, getUrlForNthTab(3)),
      addTabTo(gBrowser, getUrlForNthTab(4)),
    ]);
  const originalMoveTabToExistingGroup = gBrowser.moveTabToExistingGroup;

  try {
    const replacementOriginalGroup = gBrowser.addTabGroup(
      [replacementTab, existingGroupTab],
      { color: "blue", insertBefore: replacementTab }
    );
    Assert.ok(
      replacementOriginalGroup,
      "The incoming tab should start in a regular tab group"
    );
    await createSplitView([baseTab, rightTab], "vsep");
    gBrowser.selectedTab = baseTab;
    const replacementOriginalPinned = replacementTab.pinned;
    const replacementOriginalSplitView = replacementTab.splitView;
    const state = captureSplitState(baseTab, [replacementTab]);

    gBrowser.moveTabToExistingGroup = function () {
      throw new Error("Expected replacement dependency failure");
    };

    const result = gZenViewSplitter.setRightSplitTab(replacementTab);

    Assert.equal(
      result?.ok,
      false,
      "A replacement dependency failure should be reported instead of thrown"
    );
    Assert.equal(
      result?.reason,
      "replace-failed",
      "The failure should identify a failed replacement dependency step"
    );
    assertSplitStateUnchanged(
      state,
      "Failing a replacement dependency before state mutation"
    );
    Assert.strictEqual(
      replacementTab.group,
      replacementOriginalGroup,
      "Failing replacement should not move the incoming tab to another group"
    );
    Assert.equal(
      replacementTab.pinned,
      replacementOriginalPinned,
      "Failing replacement should not change incoming tab pin state"
    );
    Assert.equal(
      replacementTab.splitView,
      replacementOriginalSplitView,
      "Failing replacement should not put the incoming tab in split view"
    );
  } finally {
    gBrowser.moveTabToExistingGroup = originalMoveTabToExistingGroup;
    const tabsToRemove = new Set([
      ...(baseTab.group?.tabs ?? []),
      replacementTab,
      existingGroupTab,
      rightTab,
      baseTab,
    ]);
    for (const tab of tabsToRemove) {
      if (tab?.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_set_right_split_tab_reports_replace_post_staging_failure_without_mutation() {
  const [baseTab, rightTab, replacementTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
    addTabTo(gBrowser, getUrlForNthTab(3)),
  ]);
  const originalResetTabState = gZenViewSplitter.resetTabState;

  try {
    await createSplitView([baseTab, rightTab], "vsep");
    gBrowser.selectedTab = baseTab;
    const replacementOriginalSplitView = replacementTab.splitView;
    const state = captureSplitState(baseTab, [replacementTab]);

    gZenViewSplitter.resetTabState = function (tab, forUnsplit) {
      if (tab === rightTab) {
        throw new Error("Expected replacement post-staging failure");
      }
      return originalResetTabState.call(this, tab, forUnsplit);
    };

    const result = gZenViewSplitter.setRightSplitTab(replacementTab);

    Assert.equal(
      result?.ok,
      false,
      "A replacement post-staging failure should be reported instead of thrown"
    );
    Assert.equal(
      result?.reason,
      "replace-failed",
      "The failure should identify a failed replacement step"
    );
    assertSplitStateUnchanged(
      state,
      "Failing replacement after state staging"
    );
    Assert.notStrictEqual(
      replacementTab.group,
      state.group,
      "Failing replacement should not leave the incoming tab in the split group"
    );
    Assert.equal(
      replacementTab.splitView,
      replacementOriginalSplitView,
      "Failing replacement should not put the incoming tab in split view"
    );
  } finally {
    gZenViewSplitter.resetTabState = originalResetTabState;
    const tabsToRemove = new Set([
      ...(baseTab.group?.tabs ?? []),
      replacementTab,
      rightTab,
      baseTab,
    ]);
    for (const tab of tabsToRemove) {
      if (tab?.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_set_right_split_tab_rejects_complex_layout_without_mutation() {
  const [baseTab, rightTab, thirdTab, replacementTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
    addTabTo(gBrowser, getUrlForNthTab(3)),
    addTabTo(gBrowser, getUrlForNthTab(4)),
  ]);

  try {
    await createSplitView([baseTab, rightTab, thirdTab], "grid");
    gBrowser.selectedTab = baseTab;
    const replacementOriginalSplitView = replacementTab.splitView;
    const state = captureSplitState(baseTab);

    const result = gZenViewSplitter.setRightSplitTab(replacementTab);

    Assert.equal(
      result?.ok,
      false,
      "A non-two-pane split should not accept right-slot replacement"
    );
    Assert.equal(
      result?.reason,
      "complex-layout",
      "The failure should identify complex split layouts"
    );
    assertSplitStateUnchanged(state, "Rejecting a complex layout replacement");
    Assert.equal(
      replacementTab.splitView,
      replacementOriginalSplitView,
      "Rejecting replacement should not put the outside tab in split view"
    );
    Assert.notStrictEqual(
      replacementTab.group,
      state.group,
      "Rejecting replacement should not move the outside tab into the split group"
    );
    Assert.equal(
      replacementTab.pinned,
      false,
      "Rejecting replacement should not change the outside tab pin state"
    );
  } finally {
    const tabsToRemove = new Set([
      ...(baseTab.group?.tabs ?? []),
      replacementTab,
      thirdTab,
      rightTab,
      baseTab,
    ]);
    for (const tab of tabsToRemove) {
      if (tab?.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_set_right_split_tab_activates_existing_pinned_right_tab() {
  const [baseTab, rightTab, replacementTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
    addTabTo(gBrowser, getUrlForNthTab(3)),
  ]);

  try {
    const pinBaseEvent = BrowserTestUtils.waitForEvent(baseTab, "TabPinned");
    const pinRightEvent = BrowserTestUtils.waitForEvent(rightTab, "TabPinned");
    gBrowser.pinTab(baseTab);
    gBrowser.pinTab(rightTab);
    await Promise.all([pinBaseEvent, pinRightEvent]);

    await createSplitView([baseTab, rightTab], "vsep");
    gBrowser.selectedTab = baseTab;

    const activationPromise = BrowserTestUtils.waitForEvent(
      window,
      "ZenViewSplitter:SplitViewActivated"
    );
    const result = gZenViewSplitter.setRightSplitTab(rightTab);
    await activationPromise;

    Assert.equal(
      result?.ok,
      true,
      "The pinned right split tab should be accepted once it is already in the active split"
    );
    Assert.equal(
      result?.action,
      "activated",
      "The pinned right split tab should be activated"
    );
    Assert.strictEqual(
      gBrowser.selectedTab,
      rightTab,
      "The requested pinned right tab should be selected"
    );

    const replacementResult =
      gZenViewSplitter.setRightSplitTab(replacementTab);

    Assert.equal(
      replacementResult?.ok,
      false,
      "An outside tab should not replace an existing pinned right split tab"
    );
    Assert.equal(
      replacementResult?.reason,
      "invalid-right-split-tab",
      "The failure should identify that the current right slot is not replaceable"
    );
    Assert.strictEqual(
      gBrowser.selectedTab,
      rightTab,
      "Rejecting replacement should not change the selected tab"
    );
    Assert.deepEqual(
      gZenViewSplitter.splitViewBrowsers,
      [baseTab.linkedBrowser, rightTab.linkedBrowser],
      "The pinned right split tab should remain in the right slot"
    );
    Assert.equal(
      replacementTab.pinned,
      false,
      "Rejecting replacement should not transfer pinned policy to the outside tab"
    );
  } finally {
    const tabsToRemove = new Set([
      ...(baseTab.group?.tabs ?? []),
      replacementTab,
      rightTab,
      baseTab,
    ]);
    for (const tab of tabsToRemove) {
      if (tab?.parentNode) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_set_right_split_tab_rejects_protected_incoming_tabs_without_mutation() {
  const protectedCases = [
    {
      name: "pinned",
      async apply(tab) {
        const pinEvent = BrowserTestUtils.waitForEvent(tab, "TabPinned");
        gBrowser.pinTab(tab);
        await pinEvent;
      },
      async cleanup(tab) {
        if (!tab.pinned) {
          return;
        }
        const unpinEvent = BrowserTestUtils.waitForEvent(tab, "TabUnpinned");
        gBrowser.unpinTab(tab);
        await unpinEvent;
      },
    },
    {
      name: "zen-empty-tab",
      apply(tab) {
        tab.setAttribute("zen-empty-tab", "true");
      },
      cleanup(tab) {
        tab.removeAttribute("zen-empty-tab");
      },
    },
    {
      name: "hidden",
      apply(tab) {
        gBrowser.hideTab(tab);
      },
      cleanup(tab) {
        gBrowser.showTab(tab);
      },
    },
    {
      name: "essential",
      apply(tab) {
        tab.setAttribute("zen-essential", "true");
      },
      cleanup(tab) {
        tab.removeAttribute("zen-essential");
      },
    },
    {
      name: "live-folder",
      apply(tab) {
        tab.setAttribute("zen-live-folder-item-id", "test-live-folder-item");
      },
      cleanup(tab) {
        tab.removeAttribute("zen-live-folder-item-id");
      },
    },
    {
      name: "already-split-view",
      apply(tab) {
        tab.splitView = true;
        tab.splitViewValue = "test-split-view";
      },
      cleanup(tab) {
        tab.splitView = false;
        delete tab.splitViewValue;
      },
    },
  ];

  for (const protectedCase of protectedCases) {
    const [baseTab, rightTab, incomingTab] = await Promise.all([
      addTabTo(gBrowser, getUrlForNthTab(1)),
      addTabTo(gBrowser, getUrlForNthTab(2)),
      addTabTo(gBrowser, getUrlForNthTab(3)),
    ]);

    try {
      await createSplitView([baseTab, rightTab], "vsep");
      gBrowser.selectedTab = baseTab;
      await protectedCase.apply(incomingTab);
      const incomingOriginalPinned = incomingTab.pinned;
      const incomingOriginalSplitView = incomingTab.splitView;
      const state = captureSplitState(baseTab);

      const result = gZenViewSplitter.setRightSplitTab(incomingTab);

      Assert.equal(
        result?.ok,
        false,
        `A ${protectedCase.name} incoming tab should not replace the right slot`
      );
      Assert.equal(
        result?.reason,
        "invalid-tab",
        `The ${protectedCase.name} incoming tab failure should identify an invalid tab`
      );
      assertSplitStateUnchanged(
        state,
        `Rejecting ${protectedCase.name} incoming tab replacement`
      );
      Assert.equal(
        incomingTab.splitView,
        incomingOriginalSplitView,
        `Rejecting a ${protectedCase.name} incoming tab should not put it in split view`
      );
      Assert.notStrictEqual(
        incomingTab.group,
        state.group,
        `Rejecting a ${protectedCase.name} incoming tab should not move it into the split group`
      );
      Assert.equal(
        incomingTab.pinned,
        incomingOriginalPinned,
        `Rejecting a ${protectedCase.name} incoming tab should preserve its pin state`
      );
    } finally {
      await protectedCase.cleanup(incomingTab);
      const tabsToRemove = new Set([
        ...(baseTab.group?.tabs ?? []),
        incomingTab,
        rightTab,
        baseTab,
      ]);
      for (const tab of tabsToRemove) {
        if (tab?.parentNode) {
          await BrowserTestUtils.removeTab(tab);
        }
      }
    }
  }
});

add_task(async function test_set_right_split_tab_rejects_invalid_base_tab_creation_inputs() {
  const invalidBaseCases = [
    {
      name: "null",
      baseTab(_baseTab, _rightTab) {
        return null;
      },
    },
    {
      name: "same-as-right",
      baseTab(_baseTab, rightTab) {
        return rightTab;
      },
    },
    {
      name: "pinned",
      async apply(baseTab) {
        const pinEvent = BrowserTestUtils.waitForEvent(baseTab, "TabPinned");
        gBrowser.pinTab(baseTab);
        await pinEvent;
      },
      async cleanup(baseTab) {
        if (!baseTab.pinned) {
          return;
        }
        const unpinEvent = BrowserTestUtils.waitForEvent(
          baseTab,
          "TabUnpinned"
        );
        gBrowser.unpinTab(baseTab);
        await unpinEvent;
      },
    },
    {
      name: "zen-empty-tab",
      apply(baseTab) {
        baseTab.setAttribute("zen-empty-tab", "true");
      },
      cleanup(baseTab) {
        baseTab.removeAttribute("zen-empty-tab");
      },
    },
    {
      name: "already-split-view",
      apply(baseTab) {
        baseTab.splitView = true;
        baseTab.splitViewValue = "test-base-split-view";
      },
      cleanup(baseTab) {
        baseTab.splitView = false;
        delete baseTab.splitViewValue;
      },
    },
  ];

  for (const invalidBaseCase of invalidBaseCases) {
    const [baseTab, rightTab] = await Promise.all([
      addTabTo(gBrowser, getUrlForNthTab(1)),
      addTabTo(gBrowser, getUrlForNthTab(2)),
    ]);

    try {
      gBrowser.selectedTab = baseTab;
      await invalidBaseCase.apply?.(baseTab, rightTab);
      const requestedBaseTab = invalidBaseCase.baseTab
        ? invalidBaseCase.baseTab(baseTab, rightTab)
        : baseTab;
      const selectedTab = gBrowser.selectedTab;

      const result = gZenViewSplitter.setRightSplitTab(rightTab, {
        baseTab: requestedBaseTab,
      });

      Assert.equal(
        result?.ok,
        false,
        `A ${invalidBaseCase.name} base tab should not create a split`
      );
      Assert.equal(
        result?.reason,
        "invalid-base-tab",
        `The ${invalidBaseCase.name} base tab failure should be reported`
      );
      Assert.strictEqual(
        gBrowser.selectedTab,
        selectedTab,
        `Rejecting a ${invalidBaseCase.name} base tab should not change selection`
      );
      Assert.ok(
        !rightTab.splitView,
        `Rejecting a ${invalidBaseCase.name} base tab should not split the right tab`
      );
      Assert.deepEqual(
        gZenViewSplitter.splitViewBrowsers,
        [],
        `Rejecting a ${invalidBaseCase.name} base tab should not create split browsers`
      );
    } finally {
      await invalidBaseCase.cleanup?.(baseTab, rightTab);
      for (const tab of [rightTab, baseTab]) {
        if (tab?.parentNode) {
          await BrowserTestUtils.removeTab(tab);
        }
      }
    }
  }
});

add_task(async function test_set_right_split_tab_rejects_protected_current_right_slot_without_mutation() {
  const protectedCases = [
    {
      name: "hidden",
      apply(tab) {
        gBrowser.hideTab(tab);
      },
      cleanup(tab) {
        gBrowser.showTab(tab);
      },
    },
    {
      name: "essential",
      apply(tab) {
        tab.setAttribute("zen-essential", "true");
      },
      cleanup(tab) {
        tab.removeAttribute("zen-essential");
      },
    },
    {
      name: "live-folder",
      apply(tab) {
        tab.setAttribute("zen-live-folder-item-id", "test-live-folder-item");
      },
      cleanup(tab) {
        tab.removeAttribute("zen-live-folder-item-id");
      },
    },
  ];

  for (const protectedCase of protectedCases) {
    const [baseTab, rightTab, replacementTab] = await Promise.all([
      addTabTo(gBrowser, getUrlForNthTab(1)),
      addTabTo(gBrowser, getUrlForNthTab(2)),
      addTabTo(gBrowser, getUrlForNthTab(3)),
    ]);

    try {
      await createSplitView([baseTab, rightTab], "vsep");
      gBrowser.selectedTab = baseTab;
      protectedCase.apply(rightTab);
      const replacementOriginalSplitView = replacementTab.splitView;
      const state = captureSplitState(baseTab);

      const result = gZenViewSplitter.setRightSplitTab(replacementTab);

      Assert.equal(
        result?.ok,
        false,
        `A ${protectedCase.name} current right slot should not be replaced`
      );
      Assert.equal(
        result?.reason,
        "invalid-right-split-tab",
        `The ${protectedCase.name} current right slot failure should identify an invalid right slot`
      );
      assertSplitStateUnchanged(
        state,
        `Rejecting replacement of a ${protectedCase.name} current right slot`
      );
      Assert.equal(
        replacementTab.splitView,
        replacementOriginalSplitView,
        `Rejecting replacement of a ${protectedCase.name} current right slot should not put the outside tab in split view`
      );
      Assert.notStrictEqual(
        replacementTab.group,
        state.group,
        `Rejecting replacement of a ${protectedCase.name} current right slot should not move the outside tab into the split group`
      );
      Assert.equal(
        replacementTab.pinned,
        false,
        `Rejecting replacement of a ${protectedCase.name} current right slot should not change the outside tab pin state`
      );
    } finally {
      protectedCase.cleanup(rightTab);
      const tabsToRemove = new Set([
        ...(baseTab.group?.tabs ?? []),
        replacementTab,
        rightTab,
        baseTab,
      ]);
      for (const tab of tabsToRemove) {
        if (tab?.parentNode) {
          await BrowserTestUtils.removeTab(tab);
        }
      }
    }
  }
});

add_task(async function test_set_right_split_tab_rejects_left_split_tab() {
  const [baseTab, rightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
  ]);

  try {
    await createSplitView([baseTab, rightTab], "vsep");
    gBrowser.selectedTab = rightTab;

    const result = gZenViewSplitter.setRightSplitTab(baseTab);

    Assert.equal(result?.ok, false, "The left tab should not be accepted");
    Assert.equal(
      result?.reason,
      "not-right-split-tab",
      "The failure should identify that the target is not the right split tab"
    );
    Assert.strictEqual(
      gBrowser.selectedTab,
      rightTab,
      "Rejecting the left tab should not change the selected tab"
    );
  } finally {
    for (const tab of [rightTab, baseTab]) {
      await BrowserTestUtils.removeTab(tab);
    }
  }
});

add_task(async function test_set_right_split_tab_accepts_null_options() {
  const [baseTab, rightTab] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
  ]);

  try {
    gBrowser.selectedTab = baseTab;

    const activationPromise = BrowserTestUtils.waitForEvent(
      window,
      "ZenViewSplitter:SplitViewActivated"
    );
    const result = gZenViewSplitter.setRightSplitTab(rightTab, null);
    await activationPromise;

    Assert.equal(result?.ok, true, "Null options should be treated as empty");
    Assert.equal(result?.action, "created", "A new split should be created");
    Assert.strictEqual(
      gBrowser.selectedTab,
      rightTab,
      "The requested right tab should be selected"
    );
  } finally {
    for (const tab of [rightTab, baseTab]) {
      await BrowserTestUtils.removeTab(tab);
    }
  }
});
