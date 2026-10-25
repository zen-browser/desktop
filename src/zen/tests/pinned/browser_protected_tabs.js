/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PROTECTION_ENABLED = "zen.pinned-tab-manager.protect-pinned-essentials";
const PROTECTION_LOCKED = "zen.pinned-tab-manager.protected-tabs-locked";
const CLOSE_BEHAVIOR = "zen.pinned-tab-manager.close-shortcut-behavior";

const lockItem = () =>
  document.getElementById("context_zen-protect-pinned-essentials");
const isBlocked = id =>
  document.getElementById(id)?.getAttribute("zen-protected-blocked") === "true";
const isHidden = id => document.getElementById(id)?.hidden === true;

async function makePinnedTab(url = "about:blank") {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  gBrowser.pinTab(tab);
  await TestUtils.waitForCondition(() => tab.pinned);
  return tab;
}

async function makeEssentialTab(url = "about:blank") {
  const tab = await makePinnedTab(url);
  gZenPinnedTabManager.addToEssentials(tab);
  await TestUtils.waitForCondition(() => tab.hasAttribute("zen-essential"));
  return tab;
}

async function openTabMenu(tab) {
  const menu = document.getElementById("tabContextMenu");
  const event = new window.MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  tab.dispatchEvent(event);
  const shown = BrowserTestUtils.waitForEvent(menu, "popupshown");
  menu.openPopup(tab, "end_after", 0, 0, true, false, event);
  await shown;
  is(TabContextMenu.contextTab, tab, "The context menu targets the tab");
  return menu;
}

async function closeTabMenu(menu) {
  if (menu.state === "open") {
    const hidden = BrowserTestUtils.waitForEvent(menu, "popuphidden");
    menu.hidePopup();
    await hidden;
  }
}

async function clickProtectionItem() {
  const item = lockItem();
  ok(!item.hidden, "The global protection checkbox is visible");
  EventUtils.synthesizeMouseAtCenter(item, {});
  await TestUtils.waitForCondition(
    () =>
      Services.prefs.getBoolPref(PROTECTION_LOCKED, true) ===
      Boolean(item.checked),
    "The click updates the persisted protection state"
  );
}

async function waitForRemoved(tab) {
  await TestUtils.waitForCondition(
    () => !tab.isConnected,
    "The tab should be removed from the DOM"
  );
}

add_setup(async () => {
  await SpecialPowers.pushPrefEnv({
    set: [
      [PROTECTION_ENABLED, true],
      [PROTECTION_LOCKED, true],
      [CLOSE_BEHAVIOR, "close"],
    ],
  });
  registerCleanupFunction(async () => {
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    await SpecialPowers.popPrefEnv();
  });
});

add_task(async function test_feature_disabled_preserves_native_behavior() {
  await SpecialPowers.pushPrefEnv({
    set: [[PROTECTION_ENABLED, false]],
  });
  const pinned = await makePinnedTab();
  try {
    ok(
      !gZenPinnedTabManager.tabProtectionLocked,
      "Disabled feature does not lock tabs"
    );
    ok(
      !document.documentElement.hasAttribute("zen-protected-tabs"),
      "Disabled feature does not add a root marker"
    );
    gZenPinnedTabManager.updatePinnedTabContextMenu(pinned);
    ok(lockItem().hidden, "Disabled feature keeps the checkbox hidden");

    gBrowser.selectedTab = pinned;
    document.getElementById("cmd_close").doCommand();
    await waitForRemoved(pinned);
    ok(!pinned.isConnected, "Native close still works when disabled");
  } finally {
    if (pinned.isConnected) {
      Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
      await BrowserTestUtils.removeTab(pinned);
    }
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_locked_blocks_close_unpin_remove_and_detach() {
  Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
  Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
  const pinned = await makePinnedTab();
  const essential = await makeEssentialTab();
  const normal = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  try {
    ok(gZenPinnedTabManager.tabProtectionLocked, "Protection starts Locked");
    is(
      document.documentElement.getAttribute("zen-protected-tabs"),
      "locked",
      "The window exposes the locked state"
    );

    gBrowser.selectedTab = pinned;
    document.getElementById("cmd_close").doCommand();
    await EventUtils.synthesizeMouseAtCenter(pinned, { button: 1 });
    await new Promise(resolve => setTimeout(resolve, 150));
    ok(
      pinned.isConnected && !pinned.closing,
      "Locked blocks close shortcuts and middle click"
    );

    gBrowser.removeTab(pinned);
    ok(pinned.isConnected, "Locked blocks removeTab");
    gBrowser.selectedTab = pinned;
    gBrowser.removeCurrentTab();
    ok(pinned.isConnected, "Locked blocks removeCurrentTab");
    gBrowser.unpinTab(pinned);
    ok(pinned.pinned, "Locked blocks unpinTab");

    ok(
      gZenPinnedTabManager.removeEssentials(essential) === false ||
        essential.hasAttribute("zen-essential"),
      "Locked blocks Essential removal"
    );

    const normalConnected = normal.isConnected;
    gBrowser.removeTabs([pinned, normal]);
    await TestUtils.waitForCondition(
      () => !normal.isConnected,
      "Normal tabs remain closeable in a mixed selection"
    );
    ok(pinned.isConnected, "Protected tab remains in a mixed selection");
    ok(normalConnected, "The normal tab was present before the mixed close");

    const mixedNormal = await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      "about:blank"
    );
    const windowCount = [...Services.wm.getEnumerator("navigator:browser")]
      .length;
    is(gBrowser.replaceTabsWithWindow(pinned), null, "Locked blocks detach");
    gBrowser.selectedTab = pinned;
    gBrowser.addToMultiSelectedTabs(mixedNormal);
    is(
      gBrowser.replaceTabsWithWindow(pinned),
      null,
      "Locked blocks detaching a mixed multi-selection"
    );
    gBrowser.clearMultiSelectedTabs();
    is(
      [...Services.wm.getEnumerator("navigator:browser")].length,
      windowCount,
      "No window was created"
    );
    if (mixedNormal.isConnected) {
      await BrowserTestUtils.removeTab(mixedNormal);
    }

    await openTabMenu(pinned);
    is(lockItem().checked, true, "The checkbox reflects Locked");
    ok(isBlocked("context_closeTab"), "Native close is hidden while Locked");
    ok(isBlocked("context_unpinTab"), "Native unpin is hidden while Locked");
    await closeTabMenu(document.getElementById("tabContextMenu"));

    const group = gBrowser.addTabGroup([pinned], { insertBefore: pinned });
    await gBrowser.removeTabGroup(group);
    ok(
      pinned.isConnected,
      "Locked blocks removing a group containing a protected tab"
    );
  } finally {
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    if (pinned.isConnected) {
      if (pinned.group) {
        await gBrowser.removeTabGroup(pinned.group);
      }
      await BrowserTestUtils.removeTab(pinned);
    }
    if (essential.isConnected) {
      await BrowserTestUtils.removeTab(essential);
    }
    if (normal.isConnected) {
      await BrowserTestUtils.removeTab(normal);
    }
  }
});

add_task(async function test_real_checkbox_unlocks_and_relocks() {
  Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
  Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
  const pinned = await makePinnedTab();
  const menu = document.getElementById("tabContextMenu");
  try {
    await openTabMenu(pinned);
    await clickProtectionItem();
    ok(
      !gZenPinnedTabManager.tabProtectionLocked,
      "Unchecking unlocks globally"
    );
    is(
      document.documentElement.getAttribute("zen-protected-tabs"),
      "unlocked",
      "The window exposes the unlocked state"
    );
    is(lockItem().checked, false, "Checkbox is unchecked while Unlocked");
    await document.l10n.translateFragment(lockItem());
    ok(
      lockItem().label.includes("unlocked"),
      "The menu label makes the unlocked state explicit"
    );
    ok(
      !isBlocked("context_closeTab"),
      "Native close is available while Unlocked"
    );
    await closeTabMenu(menu);

    const windowCount = [...Services.wm.getEnumerator("navigator:browser")]
      .length;
    ok(gBrowser.replaceTabsWithWindow(pinned), "Unlocked allows native detach");
    await TestUtils.waitForCondition(
      () =>
        [...Services.wm.getEnumerator("navigator:browser")].length >
        windowCount,
      "A detached window is created"
    );
    const detached = [...Services.wm.getEnumerator("navigator:browser")].find(
      win => win !== window
    );
    await BrowserTestUtils.closeWindow(detached);

    const next = await makePinnedTab();
    await openTabMenu(next);
    await clickProtectionItem();
    ok(gZenPinnedTabManager.tabProtectionLocked, "Checking relocks globally");
    is(
      document.documentElement.getAttribute("zen-protected-tabs"),
      "locked",
      "The window exposes the locked state again"
    );
    gBrowser.removeTab(next);
    ok(next.isConnected, "Relock restores close protection immediately");
    await closeTabMenu(menu);
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    await BrowserTestUtils.removeTab(next);
  } finally {
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    await closeTabMenu(menu);
    if (pinned.isConnected) {
      await BrowserTestUtils.removeTab(pinned);
    }
  }
});

add_task(
  async function test_unlocked_allows_native_unpin_and_essential_removal() {
    Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
    Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
    const pinned = await makePinnedTab();
    const essential = await makeEssentialTab();
    try {
      Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
      gBrowser.unpinTab(pinned);
      await TestUtils.waitForCondition(() => !pinned.pinned);
      ok(!pinned.pinned, "Unlocked allows native unpin");

      ok(
        gZenPinnedTabManager.removeEssentials(essential),
        "Unlocked allows Essential removal"
      );
      await TestUtils.waitForCondition(
        () => !essential.hasAttribute("zen-essential")
      );
      ok(
        !essential.hasAttribute("zen-essential"),
        "The Essential attribute is removed"
      );
    } finally {
      Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
      if (pinned.isConnected) {
        await BrowserTestUtils.removeTab(pinned);
      }
      if (essential.isConnected) {
        await BrowserTestUtils.removeTab(essential);
      }
    }
  }
);

add_task(async function test_multi_window_sync_persistence_and_rollback() {
  Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
  Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
  const second = await BrowserTestUtils.openNewBrowserWindow();
  try {
    await TestUtils.waitForCondition(() => second.gZenPinnedTabManager);
    is(
      second.document.documentElement.getAttribute("zen-protected-tabs"),
      "locked",
      "A new window inherits the Locked preference"
    );

    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    await TestUtils.waitForCondition(
      () =>
        document.documentElement.getAttribute("zen-protected-tabs") ===
          "unlocked" &&
        second.document.documentElement.getAttribute("zen-protected-tabs") ===
          "unlocked",
      "The pref change reaches every open window"
    );

    const third = await BrowserTestUtils.openNewBrowserWindow();
    try {
      await TestUtils.waitForCondition(() => third.gZenPinnedTabManager);
      is(
        third.document.documentElement.getAttribute("zen-protected-tabs"),
        "unlocked",
        "A later window inherits Unlocked"
      );
    } finally {
      await BrowserTestUtils.closeWindow(third);
    }

    Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
    await TestUtils.waitForCondition(
      () =>
        document.documentElement.getAttribute("zen-protected-tabs") ===
          "locked" &&
        second.document.documentElement.getAttribute("zen-protected-tabs") ===
          "locked",
      "Relocking reaches every open window"
    );

    const originalSync = second.gZenPinnedTabManager._syncTabProtectionUI;
    second.gZenPinnedTabManager._syncTabProtectionUI = () => false;
    ok(
      !gZenPinnedTabManager.setTabProtectionLocked(false),
      "A window sync failure is reported"
    );
    is(
      Services.prefs.getBoolPref(PROTECTION_LOCKED, true),
      true,
      "Failed transition restores the previous preference"
    );
    is(
      document.documentElement.getAttribute("zen-protected-tabs"),
      "locked",
      "Failed transition restores the first window"
    );
    second.gZenPinnedTabManager._syncTabProtectionUI = originalSync;
  } finally {
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    await BrowserTestUtils.closeWindow(second);
  }
});

add_task(async function test_window_close_is_not_blocked() {
  Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
  Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
  const second = await BrowserTestUtils.openNewBrowserWindow();
  const pinned = await BrowserTestUtils.openNewForegroundTab(
    second.gBrowser,
    "about:blank"
  );
  second.gBrowser.pinTab(pinned);
  await TestUtils.waitForCondition(
    () => second.gZenPinnedTabManager?.tabProtectionLocked
  );

  await BrowserTestUtils.closeWindow(second);
  ok(true, "Closing a window with locked protected tabs is not blocked");
});

add_task(async function test_internal_cleanup_can_bypass_locks() {
  Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
  Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
  const pinned = await makePinnedTab();
  const closeTab = await makePinnedTab();
  try {
    gZenPinnedTabManager.withAuthorizedTabs([pinned], ["unpin"], () => {
      gBrowser.unpinTab(pinned);
    });
    await TestUtils.waitForCondition(() => !pinned.pinned);
    ok(!pinned.pinned, "Authorized internal unpin is allowed");

    gZenPinnedTabManager.withAuthorizedTabs([closeTab], ["close"], () => {
      gBrowser.removeTab(closeTab);
    });
    await waitForRemoved(closeTab);
    ok(!closeTab.isConnected, "Authorized internal cleanup can close a tab");
  } finally {
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    for (const tab of [pinned, closeTab]) {
      if (tab.isConnected) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_essential_menu_baseline_visibility() {
  Services.prefs.setBoolPref(PROTECTION_ENABLED, false);
  const pinned = await makePinnedTab();
  const essential = await makeEssentialTab();
  const normal = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const menu = document.getElementById("tabContextMenu");
  try {
    await openTabMenu(pinned);
    ok(!isHidden("context_closeTab"), "Disabled: Pinned close is visible");
    ok(!isHidden("context_unpinTab"), "Disabled: Pinned unpin is visible");
    ok(
      isHidden("context_zen-remove-essential"),
      "Disabled: Remove is hidden for Pinned"
    );
    await closeTabMenu(menu);

    await openTabMenu(normal);
    ok(!isHidden("context_closeTab"), "Disabled: Normal close is visible");
    ok(isHidden("context_unpinTab"), "Disabled: Normal unpin remains hidden");
    ok(
      isHidden("context_zen-remove-essential"),
      "Disabled: Remove is hidden for Normal"
    );
    await closeTabMenu(menu);

    await openTabMenu(essential);
    ok(isHidden("context_closeTab"), "Disabled: Essential close stays hidden");
    ok(isHidden("context_unpinTab"), "Disabled: Essential unpin stays hidden");
    ok(
      !isHidden("context_zen-remove-essential"),
      "Disabled: Remove from Essentials is visible"
    );
    await closeTabMenu(menu);

    Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
    Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
    await openTabMenu(essential);
    ok(
      isHidden("context_closeTab"),
      "Locked: Essential close baseline remains hidden"
    );
    ok(
      isHidden("context_unpinTab"),
      "Locked: Essential unpin baseline remains hidden"
    );
    ok(
      !isHidden("context_zen-remove-essential"),
      "Locked: Essential Remove baseline remains visible"
    );
    ok(
      isBlocked("context_zen-remove-essential"),
      "Locked: Remove is protection-blocked"
    );
    await closeTabMenu(menu);

    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    await openTabMenu(essential);
    ok(isHidden("context_closeTab"), "Unlocked: Essential close stays hidden");
    ok(isHidden("context_unpinTab"), "Unlocked: Essential unpin stays hidden");
    ok(
      !isHidden("context_zen-remove-essential"),
      "Unlocked: Remove from Essentials is visible"
    );
    ok(
      !isBlocked("context_zen-remove-essential"),
      "Unlocked: Remove is not blocked"
    );
    await closeTabMenu(menu);

    gBrowser.selectedTab = essential;
    gBrowser.addToMultiSelectedTabs(normal);
    await openTabMenu(essential);
    ok(
      isHidden("context_closeTab"),
      "Multiselect: Essential close stays hidden"
    );
    ok(
      !isHidden("context_zen-remove-essential"),
      "Multiselect: Remove from Essentials remains visible"
    );
    gBrowser.clearMultiSelectedTabs();
    await closeTabMenu(menu);
  } finally {
    gBrowser.clearMultiSelectedTabs();
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    await closeTabMenu(menu);
    for (const tab of [pinned, essential, normal]) {
      if (tab.isConnected) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_classifier_and_first_closing_group_member() {
  Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
  Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
  const first = await makePinnedTab();
  const second = await makePinnedTab();
  const normal = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  let group;
  try {
    ok(
      gZenPinnedTabManager.canPerformProtectedAction(first, "close") === false,
      "A real Pinned tab is classified as protected"
    );
    ok(
      gZenPinnedTabManager.canPerformProtectedAction(normal, "close") === true,
      "A normal tab remains allowed"
    );

    group = gBrowser.addTabGroup([first, second], { insertBefore: first });
    ok(
      gZenPinnedTabManager.canPerformProtectedAction(group, "close") === false,
      "A group containing protected tabs is classified as protected"
    );

    first.closing = true;
    ok(
      gZenPinnedTabManager.canPerformProtectedAction(group, "close") === false,
      "One closing group member does not authorize the remaining protected tabs"
    );
    await gBrowser.removeTabGroup(group);
    ok(
      second.isConnected,
      "A group close cannot remove a still-protected second member"
    );
    first.closing = false;
  } finally {
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    if (first.closing) {
      first.closing = false;
    }
    if (group) {
      await gBrowser.removeTabGroup(group).catch(() => {});
    }
    for (const tab of [first, second, normal]) {
      if (tab.isConnected) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_split_composition_protected_policy() {
  Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
  Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
  const pinned = await makePinnedTab();
  const essential = await makeEssentialTab();
  const normal = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  try {
    ok(
      gZenPinnedTabManager.shouldBlockProtectedSplitComposition(
        [normal],
        pinned
      ),
      "Normal source onto a protected Pinned browser is blocked"
    );
    ok(
      gZenPinnedTabManager.shouldBlockProtectedSplitComposition(
        [normal],
        essential
      ),
      "Normal source onto a protected Essential browser is blocked"
    );
    ok(
      gZenPinnedTabManager.shouldBlockProtectedSplitComposition(
        [pinned],
        normal
      ),
      "Protected Pinned source onto a normal browser is blocked"
    );
    ok(
      !gZenPinnedTabManager.shouldBlockProtectedSplitComposition(
        [normal],
        normal
      ),
      "Normal-to-normal content split remains allowed"
    );

    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    ok(
      !gZenPinnedTabManager.shouldBlockProtectedSplitComposition(
        [normal],
        pinned
      ),
      "Unlocked restores native content split behavior"
    );

    Services.prefs.setBoolPref(PROTECTION_ENABLED, false);
    ok(
      !gZenPinnedTabManager.shouldBlockProtectedSplitComposition(
        [normal],
        pinned
      ),
      "Disabled feature restores native content split behavior"
    );
  } finally {
    Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    for (const tab of [pinned, essential, normal]) {
      if (tab.isConnected) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_drag_policy_matrix() {
  Services.prefs.setBoolPref(PROTECTION_ENABLED, true);
  Services.prefs.setBoolPref(PROTECTION_LOCKED, true);
  const pinned = await makePinnedTab();
  const essential = await makeEssentialTab();
  const normal = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  try {
    const target = (selectorMatches = []) => ({
      closest: selector =>
        selectorMatches.some(match => selector.includes(match)) ? {} : null,
    });
    const pinnedTarget = target(["pinned-tabs-section", "workspace-indicator"]);
    const normalTarget = target([]);
    const essentialTarget = target(["essentials-container"]);

    ok(
      !gZenPinnedTabManager.shouldBlockProtectedDrop(
        { target: pinnedTarget },
        pinned,
        [pinned]
      ),
      "Same-zone Pinned reorder stays native"
    );
    ok(
      gZenPinnedTabManager.shouldBlockProtectedDrop(
        { target: normalTarget },
        pinned,
        [pinned]
      ),
      "Pinned to Normal is blocked"
    );
    is(
      gZenPinnedTabManager.moveToAnotherTabContainerIfNecessary(
        { target: normalTarget },
        pinned,
        [pinned],
        0
      ),
      null,
      "The native mutation boundary rejects an unsafe protected move"
    );
    ok(
      pinned.isConnected && pinned.pinned,
      "The rejected source remains intact"
    );
    ok(
      gZenPinnedTabManager.shouldBlockProtectedDrop(
        { target: pinnedTarget },
        pinned,
        [pinned, normal]
      ),
      "A mixed selection containing a protected tab is blocked"
    );
    ok(
      !gZenPinnedTabManager.shouldBlockProtectedDrop(
        { target: essentialTarget },
        essential,
        [essential]
      ),
      "Same-zone Essential reorder stays native"
    );
    ok(
      gZenPinnedTabManager.shouldBlockProtectedDrop(
        { target: normalTarget },
        essential,
        [essential]
      ),
      "Essential to Normal is blocked"
    );
    const otherWorkspaceTarget = {
      closest: selector => {
        if (selector.includes("workspace-id")) {
          return { getAttribute: () => "other-workspace" };
        }
        return selector.includes("pinned") ? {} : null;
      },
    };
    ok(
      gZenPinnedTabManager.shouldBlockProtectedDrop(
        { target: otherWorkspaceTarget },
        pinned,
        [pinned]
      ),
      "Cross-workspace protected reorder is blocked"
    );
    const splitTarget = {
      closest: selector => {
        if (selector.includes(".tabbrowser-tab")) {
          return {
            group: { hasAttribute: name => name === "split-view-group" },
          };
        }
        return selector.includes("pinned") ? {} : null;
      },
    };
    ok(
      !gZenPinnedTabManager.shouldBlockProtectedDrop(
        { target: splitTarget },
        pinned,
        [pinned]
      ),
      "Same-section split-view reorder is allowed"
    );
    ok(
      gZenPinnedTabManager.shouldBlockProtectedDrop(
        { target: splitTarget },
        pinned,
        [pinned],
        { splitDropReady: true }
      ),
      "Split composition involving a protected tab is blocked"
    );
    const otherWindow = await BrowserTestUtils.openNewBrowserWindow();
    try {
      const otherPinned = await BrowserTestUtils.openNewForegroundTab(
        otherWindow.gBrowser,
        "about:blank"
      );
      otherWindow.gBrowser.pinTab(otherPinned);
      ok(
        gZenPinnedTabManager.shouldBlockProtectedDrop(
          { target: pinnedTarget },
          otherPinned,
          [otherPinned]
        ),
        "Cross-window protected drops are blocked"
      );
    } finally {
      Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
      await BrowserTestUtils.closeWindow(otherWindow);
    }
  } finally {
    Services.prefs.setBoolPref(PROTECTION_LOCKED, false);
    for (const tab of [pinned, essential, normal]) {
      if (tab.isConnected) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});
