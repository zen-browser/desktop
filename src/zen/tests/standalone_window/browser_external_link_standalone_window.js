/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

/* eslint-disable mozilla/valid-services -- Services.zen is Zen's custom XPCOM service. */

"use strict";

const {
  gZenStandaloneWindowManager,
  nsZenStandaloneWindowManager,
  ZEN_STANDALONE_WINDOW_TYPE,
} = ChromeUtils.importESModule(
  "resource:///modules/zen/standalonewindow/ZenStandaloneWindowManager.sys.mjs"
);

const { SessionWindowUI } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionWindowUI.sys.mjs"
);

const TEST_URL_BASE = "https://example.com/zen-standalone-window-test";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["dom.require_user_interaction_for_beforeunload", false]],
  });
  await gZenWorkspaces.promiseInitialized;

  registerCleanupFunction(async () => {
    for (const win of getStandaloneWindows()) {
      await BrowserTestUtils.closeWindow(win);
    }
  });
});

add_task(async function test_external_link_opens_standalone_window() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?external`
  );

  try {
    assertStandaloneWindow(standaloneWindow);
    for (const id of [
      "zen-standalone-window-keep",
      "zen-standalone-window-open-in-space-button",
      "zen-standalone-window-space-picker-button",
    ]) {
      ok(
        standaloneWindow.document.getElementById(id),
        `Standalone window has the ${id} control`
      );
    }
    ok(
      !standaloneWindow.document.getElementById(
        "zen-standalone-window-close-button"
      ),
      "There is no Close button; the window closes from the titlebar"
    );

    const navBar = standaloneWindow.document.getElementById("nav-bar");
    const urlBar = standaloneWindow.document.getElementById("urlbar");
    ok(
      !isEffectivelyHidden(navBar),
      "Standalone window keeps the normal nav bar"
    );
    ok(urlBar && !urlBar.readOnly, "Standalone URL bar remains editable");
    ok(
      !standaloneWindow.document.documentElement.hasAttribute("persist"),
      "Standalone bounds do not overwrite normal browser window geometry"
    );
    if (
      AppConstants.platform === "macosx" &&
      !Services.env.get("MOZ_HEADLESS")
    ) {
      const baseWindow = standaloneWindow.docShell.treeOwner.QueryInterface(
        Ci.nsIBaseWindow
      );
      ok(
        Services.zen.isStandalonePanel(baseWindow),
        "A macOS standalone uses the dedicated native NSPanel class"
      );
      const normalBaseWindow = window.docShell.treeOwner.QueryInterface(
        Ci.nsIBaseWindow
      );
      ok(
        !Services.zen.isStandalonePanel(normalBaseWindow),
        "A normal browser window remains an ordinary native window"
      );
    }
    ok(
      !gZenStandaloneWindowManager.hasOtherStandaloneWindows(standaloneWindow),
      "A normal window does not prevent returning focus to the previous app"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_standalone_window_geometry_is_persistent() {
  const prefs = {
    width: "zen.standalone-window.last-width",
    height: "zen.standalone-window.last-height",
    left: "zen.standalone-window.last-screen-x",
    top: "zen.standalone-window.last-screen-y",
  };
  await SpecialPowers.pushPrefEnv({
    set: Object.values(prefs).map(pref => [pref, 0]),
  });

  try {
    const savedBounds = {
      width: Math.min(900, window.screen.availWidth),
      height: Math.min(600, window.screen.availHeight),
      left: window.screen.availLeft + 40,
      top: window.screen.availTop + 40,
    };
    const fakeWindow = {
      closed: false,
      windowState: 0,
      STATE_NORMAL: 0,
      outerWidth: savedBounds.width,
      outerHeight: savedBounds.height,
      screenX: savedBounds.left,
      screenY: savedBounds.top,
      ZenExternalLinkStandalone: { initialNormalBounds: null },
    };

    ok(
      gZenStandaloneWindowManager.persistStandaloneWindowGeometry(fakeWindow),
      "A normal standalone rectangle is persisted"
    );
    for (const [key, pref] of Object.entries(prefs)) {
      Assert.equal(
        Services.prefs.getIntPref(pref),
        savedBounds[key],
        `The saved ${key} is kept in standalone-only preferences`
      );
    }

    const features = Object.fromEntries(
      gZenStandaloneWindowManager
        .getStandaloneWindowFeatures({ openerWindow: window })
        .split(",")
        .map(feature => feature.split("="))
    );
    Assert.equal(
      Number(features.width),
      savedBounds.width,
      "A subsequent standalone window restores the saved width"
    );
    Assert.equal(
      Number(features.height),
      savedBounds.height,
      "A subsequent standalone window restores the saved height"
    );
    Assert.equal(
      Number(features.left),
      savedBounds.left,
      "The first standalone window restores the saved horizontal placement"
    );
    Assert.equal(
      Number(features.top),
      savedBounds.top,
      "The first standalone window restores the saved vertical placement"
    );
  } finally {
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_standalone_top_bar_is_stripped_down() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?top-bar`
  );

  try {
    const document = standaloneWindow.document;

    // Everything below belongs to a workspace, not to a single external page.
    for (const id of [
      "forward-button",
      "stop-reload-button",
      "unified-extensions-button",
      "fxa-toolbar-menu-button",
      "nav-bar-overflow-button",
      "PanelUI-button",
    ]) {
      const element = document.getElementById(id);
      ok(
        isEffectivelyHidden(element),
        `${id} is hidden in a standalone window`
      );
    }

    ok(
      !isEffectivelyHidden(document.getElementById("urlbar-container")),
      "The address bar is the only navigation-bar item left"
    );
    ok(
      !isEffectivelyHidden(
        document.getElementById("zen-standalone-window-keep")
      ),
      "The keep action is visible in the top bar"
    );

    const backButton = document.getElementById("back-button");
    const backCommand = document.getElementById("Browser:Back");
    Assert.equal(
      isEffectivelyHidden(backButton),
      backCommand.hasAttribute("disabled"),
      "The back arrow is shown exactly when there is history to go back to"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_standalone_back_arrow_appears_with_history() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?back-arrow-first`
  );

  try {
    const backButton = standaloneWindow.document.getElementById("back-button");
    ok(
      isEffectivelyHidden(backButton),
      "A freshly opened standalone window shows no back arrow"
    );

    const browser = standaloneWindow.gBrowser.selectedBrowser;
    BrowserTestUtils.startLoadingURIString(
      browser,
      `${TEST_URL_BASE}?back-arrow-second`
    );
    await BrowserTestUtils.browserLoaded(
      browser,
      false,
      `${TEST_URL_BASE}?back-arrow-second`
    );

    await TestUtils.waitForCondition(
      () => !isEffectivelyHidden(backButton),
      "Waiting for the back arrow to appear once the window has history"
    );
    ok(
      !isEffectivelyHidden(backButton),
      "The back arrow appears once the standalone window has history"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_standalone_window_has_no_empty_tab() {
  const openerWorkspaceIds = gZenWorkspaces
    .getWorkspaces()
    .map(workspace => workspace.uuid);
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?no-empty-tab`
  );

  try {
    await Promise.all([
      standaloneWindow.gZenWorkspaces.promiseInitialized,
      standaloneWindow.gZenWorkspaces.promisePinnedInitialized,
    ]);
    Assert.equal(
      standaloneWindow.gBrowser.tabs.length,
      1,
      "Standalone windows never create Zen's empty startup tab"
    );
    ok(
      !standaloneWindow.gZenWorkspaces._emptyTab,
      "No empty tab is registered for the standalone window"
    );
    ok(
      !standaloneWindow.gBrowser.tabs.some(tab =>
        tab.hasAttribute("zen-empty-tab")
      ),
      "No tab in the standalone window is marked as the empty tab"
    );
    ok(
      !standaloneWindow.gZenWorkspaces.shouldHaveWorkspaces,
      "A standalone window is rejected before workspace initialization"
    );
    ok(
      !standaloneWindow.gZenWorkspaces.workspaceEnabled,
      "Workspace behavior is disabled for the standalone window"
    );
    Assert.equal(
      standaloneWindow.gZenWorkspaces.getWorkspaces().length,
      0,
      "No default workspace data is created for the standalone window"
    );
    ok(
      !standaloneWindow.gZenWorkspaces._hasInitializedTabsStrip,
      "No workspace tab-strip sections are initialized"
    );
    ok(
      !standaloneWindow.gBrowser.selectedTab.hasAttribute("zen-workspace-id"),
      "The standalone page is not assigned to a workspace"
    );
    Assert.deepEqual(
      gZenWorkspaces.getWorkspaces().map(workspace => workspace.uuid),
      openerWorkspaceIds,
      "Opening a standalone does not mutate the normal window's spaces"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_external_link_opens_before_startup_finishes() {
  const wasReady = gZenStartup.isReady;
  gZenStartup.isReady = false;
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?cold-start`
  );

  try {
    assertStandaloneWindow(standaloneWindow);
  } finally {
    gZenStartup.isReady = wasReady;
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_multiple_external_links_open_multiple_windows() {
  const firstWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?multiple=1`
  );
  const secondWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?multiple=2`
  );

  try {
    Assert.notEqual(
      firstWindow,
      secondWindow,
      "Each external link gets its own standalone window"
    );
    assertStandaloneWindow(firstWindow);
    assertStandaloneWindow(secondWindow);
    ok(
      firstWindow.screenX !== secondWindow.screenX ||
        firstWindow.screenY !== secondWindow.screenY,
      "Standalone windows cascade instead of stacking in one spot"
    );
  } finally {
    await closeStandaloneWindow(firstWindow);
    await closeStandaloneWindow(secondWindow);
  }
});

add_task(function test_partial_multi_link_construction_rolls_back() {
  const originalOpen =
    gZenStandaloneWindowManager.openExternalLinkStandaloneWindow;
  const firstWindow = {
    closed: false,
    ZenExternalLinkStandalone: { isKeeping: false },
    close() {
      this.closed = true;
    },
  };
  let calls = 0;

  gZenStandaloneWindowManager.openExternalLinkStandaloneWindow = () => {
    calls++;
    return calls === 1 ? firstWindow : null;
  };

  try {
    ok(
      !gZenStandaloneWindowManager.openExternalLinksInStandaloneWindows([
        `${TEST_URL_BASE}?partial=1`,
        `${TEST_URL_BASE}?partial=2`,
      ]),
      "A partially constructed batch falls back to normal URL handling"
    );
    Assert.equal(calls, 2, "Construction stopped at the failed URL");
    ok(firstWindow.closed, "The earlier standalone window was rolled back");
    ok(
      firstWindow.ZenExternalLinkStandalone.isKeeping,
      "Rollback does not archive a page that normal handling will reopen"
    );
  } finally {
    gZenStandaloneWindowManager.openExternalLinkStandaloneWindow = originalOpen;
  }
});

add_task(async function test_pinned_external_tab_is_not_hijacked() {
  const url = `${TEST_URL_BASE}?pinned`;
  const existingWindows = new Set(getStandaloneWindows());
  const tab = gBrowser.addTab(url, {
    fromExternal: true,
    pinned: true,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });

  try {
    ok(tab, "A pinned external tab still opens as a normal tab");
    Assert.equal(
      getStandaloneWindows().filter(win => !existingWindows.has(win)).length,
      0,
      "A pinned external tab does not open a standalone window"
    );
  } finally {
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_browser_external_open_does_not_fallback_to_tab() {
  const url = `${TEST_URL_BASE}?browser-dom-window`;
  const existingWindows = new Set(getStandaloneWindows());
  const initialTabCount = gBrowser.tabs.length;
  const browser = window.browserDOMWindow.openURI(
    Services.io.newURI(url),
    null,
    Ci.nsIBrowserDOMWindow.OPEN_NEWTAB,
    Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL,
    Services.scriptSecurityManager.getSystemPrincipal()
  );

  Assert.equal(browser, null, "The standalone route has no tab browser result");
  const standaloneWindow = await waitForNewStandaloneWindow(
    existingWindows,
    url
  );
  Assert.equal(
    gBrowser.tabs.length,
    initialTabCount,
    "BrowserDOMWindow does not fall back to a normal workspace tab"
  );

  await closeStandaloneWindow(standaloneWindow);
});

add_task(async function test_target_blank_from_standalone_opens_a_new_window() {
  const sourceWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?popup-source`
  );
  const existingWindows = new Set(getStandaloneWindows());
  const url = `${TEST_URL_BASE}?popup-target`;

  try {
    const browser = sourceWindow.browserDOMWindow.openURI(
      Services.io.newURI(url),
      null,
      Ci.nsIBrowserDOMWindow.OPEN_NEWTAB,
      Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL,
      Services.scriptSecurityManager.getSystemPrincipal()
    );

    Assert.equal(
      browser,
      null,
      "The asynchronous standalone destination does not expose a stale source browser"
    );
    const popupWindow = await waitForNewStandaloneWindow(existingWindows, url);
    Assert.equal(
      sourceWindow.gBrowser.tabs.length,
      1,
      "The source standalone keeps exactly one page"
    );
    Assert.equal(
      popupWindow.gBrowser.tabs.length,
      1,
      "The popup standalone contains exactly one page"
    );
    await closeStandaloneWindow(popupWindow);
  } finally {
    await closeStandaloneWindow(sourceWindow);
  }
});

add_task(async function test_scripted_new_window_from_standalone_is_visible() {
  const sourceWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?scripted-source`
  );
  const existingWindows = new Set(getStandaloneWindows());
  const url = `${TEST_URL_BASE}?scripted-target`;

  try {
    const browsingContext = sourceWindow.browserDOMWindow.openURI(
      Services.io.newURI(url),
      null,
      Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW,
      0,
      Services.scriptSecurityManager.getSystemPrincipal()
    );
    ok(
      !browsingContext,
      "A scripted standalone destination is created asynchronously"
    );
    const popupWindow = await waitForNewStandaloneWindow(existingWindows, url);
    Assert.equal(
      popupWindow.gBrowser.tabs.length,
      1,
      "A scripted new-window destination has one visible page"
    );
    await closeStandaloneWindow(popupWindow);
  } finally {
    await closeStandaloneWindow(sourceWindow);
  }
});

add_task(async function test_close_standalone_window_without_keeping() {
  const initialTabCount = gBrowser.tabs.length;
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?close`
  );

  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
  ok(
    gZenStandaloneWindowManager.closeStandaloneWindow(standaloneWindow),
    "The manager closes the standalone window"
  );
  await closed;

  Assert.equal(
    gBrowser.tabs.length,
    initialTabCount,
    "Closing a standalone window does not keep a tab in the normal workspace"
  );
});

add_task(function test_closing_native_opener_is_not_retained() {
  for (const openerWindow of [
    { closed: false, ZenExternalLinkStandalone: { isClosing: true } },
    { closed: true, ZenExternalLinkStandalone: { isClosing: false } },
  ]) {
    const request =
      gZenStandaloneWindowManager.createExternalLinkStandaloneWindowRequest({
        uriString: `${TEST_URL_BASE}?stale-opener`,
        options: { fromExternal: true, isPrivate: true },
        openerWindow,
      });
    Assert.equal(
      request.openerWindow,
      null,
      "A closing or closed standalone is not retained as a native opener"
    );
    ok(
      request.isPrivate,
      "Explicit privacy survives removal of the stale native opener"
    );
  }
});

add_task(async function test_close_command_closes_standalone_window() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?close-command`
  );
  const state = standaloneWindow.ZenExternalLinkStandalone;
  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);

  ok(state.commandListener, "The standalone owns the Close command");
  standaloneWindow.document.getElementById("cmd_close").doCommand();
  await closed;

  ok(
    standaloneWindow.closed,
    "The Close Tab command closes the standalone native window"
  );
  await TestUtils.waitForCondition(
    () => state.commandListener === null,
    "Waiting for standalone unload cleanup"
  );
  Assert.equal(
    state.commandListener,
    null,
    "The standalone Close command listener is removed during cleanup"
  );
});

add_task(async function test_close_window_command_uses_same_lifecycle() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?close-window-command`
  );
  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);

  standaloneWindow.document.getElementById("cmd_closeWindow").doCommand();
  await closed;

  ok(
    standaloneWindow.closed,
    "The Close Window command closes the standalone native window"
  );
});

add_task(async function test_physical_chrome_shortcuts_are_blocked() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?blocked-shortcuts`
  );

  try {
    const initialTabs = standaloneWindow.gBrowser.tabs.length;
    for (const shortcut of [
      { key: "t", metaKey: true },
      { key: "b", metaKey: true },
      { key: "p", metaKey: true, shiftKey: true },
    ]) {
      const event = new standaloneWindow.KeyboardEvent("keydown", {
        ...shortcut,
        bubbles: true,
        cancelable: true,
      });
      standaloneWindow.dispatchEvent(event);
      ok(
        event.defaultPrevented,
        `Standalone consumes Command+${shortcut.key.toUpperCase()} before Firefox chrome`
      );
    }
    Assert.equal(
      standaloneWindow.gBrowser.tabs.length,
      initialTabs,
      "Blocked physical shortcuts do not create a tab in the standalone"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_beforeunload_cancel_keeps_standalone_usable() {
  if (Services.env.get("MOZ_HEADLESS")) {
    ok(
      true,
      "Native beforeunload cancellation is exercised by the headful macOS run"
    );
    return;
  }

  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?beforeunload-cancel`
  );
  const browser = standaloneWindow.gBrowser.selectedBrowser;

  await SpecialPowers.spawn(browser, [], () => {
    content.beforeUnloadCount = 0;
    content.onbeforeunload = event => {
      content.beforeUnloadCount++;
      event.preventDefault();
      event.returnValue = "";
    };
  });

  try {
    const dialog = BrowserTestUtils.promiseAlertDialogOpen("cancel");
    standaloneWindow.document.getElementById("cmd_close").doCommand();
    await dialog;

    ok(!standaloneWindow.closed, "Cancelling beforeunload keeps the window");
    Assert.equal(
      standaloneWindow.gBrowser.tabs.length,
      1,
      "Cancelling leaves the original single tab intact"
    );
    Assert.equal(
      standaloneWindow.gBrowser.selectedBrowser.currentURI.spec,
      `${TEST_URL_BASE}?beforeunload-cancel`,
      "Cancelling leaves the original page loaded"
    );
    ok(
      !standaloneWindow.ZenExternalLinkStandalone.isClosing,
      "The close pipeline can be used again after cancellation"
    );
    Assert.equal(
      await SpecialPowers.spawn(browser, [], () => content.beforeUnloadCount),
      1,
      "One close attempt runs beforeunload exactly once"
    );
  } finally {
    await SpecialPowers.spawn(browser, [], () => {
      content.onbeforeunload = null;
    });
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_removing_only_tab_cannot_leave_empty_window() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?remove-only-tab`
  );
  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
  let replacementTabOpened = false;
  standaloneWindow.addEventListener("TabOpen", () => {
    replacementTabOpened = true;
  });

  standaloneWindow.gBrowser.removeTab(standaloneWindow.gBrowser.selectedTab, {
    animate: false,
    closeWindowWithLastTab: false,
  });
  await closed;

  ok(
    !replacementTabOpened,
    "Removing the standalone page never creates a replacement tab"
  );
  ok(
    standaloneWindow.closed,
    "Removing the standalone page closes its native window"
  );
});

add_task(async function test_keep_button_names_the_target_space() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?named-space`
  );

  try {
    const button = standaloneWindow.document.getElementById(
      "zen-standalone-window-open-in-space-button"
    );
    await standaloneWindow.document.l10n.translateFragment(button);

    const spaceName = gZenWorkspaces.getActiveWorkspaceFromCache()?.name;
    Assert.equal(
      button
        .querySelector(".zen-standalone-window-keep-space")
        ?.getAttribute("value"),
      spaceName,
      "The primary action names the space the page would be kept in"
    );
    Assert.equal(
      button
        .querySelector(".zen-standalone-window-keep-prefix")
        ?.getAttribute("value"),
      "Open in",
      "The space name is preceded by the localized prefix"
    );
    ok(
      button.querySelector(".zen-standalone-window-shortcut"),
      "The primary action shows its keyboard shortcut alongside the label"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_keep_standalone_window_in_default_space() {
  const url = `${TEST_URL_BASE}?keep-default`;
  const standaloneWindow = await openExternalLinkStandaloneWindow(url);
  const button = standaloneWindow.document.getElementById(
    "zen-standalone-window-open-in-space-button"
  );

  const tabOpened = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabOpen"
  );
  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
  clickKeepButton(standaloneWindow, button);

  const tab = (await tabOpened).target;
  await closed;

  try {
    Assert.equal(
      tab.linkedBrowser.currentURI.spec,
      url,
      "The standalone URL becomes a normal tab"
    );
    Assert.equal(gBrowser.selectedTab, tab, "The kept tab is selected");
  } finally {
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_keep_preserves_session_history() {
  const firstURL = `${TEST_URL_BASE}?history=1`;
  const secondURL = `${TEST_URL_BASE}?history=2`;
  const standaloneWindow = await openExternalLinkStandaloneWindow(firstURL);

  BrowserTestUtils.startLoadingURIString(
    standaloneWindow.gBrowser.selectedBrowser,
    secondURL
  );
  await BrowserTestUtils.browserLoaded(
    standaloneWindow.gBrowser.selectedBrowser,
    false,
    secondURL
  );

  const tabOpened = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabOpen"
  );
  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
  clickKeepButton(standaloneWindow);

  const tab = (await tabOpened).target;
  await closed;

  try {
    Assert.equal(
      tab.linkedBrowser.currentURI.spec,
      secondURL,
      "The kept tab is still on the page the standalone window was showing"
    );
    // Adoption swaps the live browser rather than re-opening the URL, so the
    // back history the user built up in the standalone window survives.
    ok(
      tab.linkedBrowser.canGoBack,
      "The kept tab keeps the session history from the standalone window"
    );
  } finally {
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_failed_keep_leaves_source_open_and_enabled() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?keep-failure`
  );
  const originalAdopt = gZenStandaloneWindowManager.adoptStandaloneTab;
  const originalReopen = gZenStandaloneWindowManager.reopenStandaloneUrlInSpace;
  gZenStandaloneWindowManager.adoptStandaloneTab = () => null;
  gZenStandaloneWindowManager.reopenStandaloneUrlInSpace = () => null;

  try {
    clickKeepButton(standaloneWindow);

    ok(!standaloneWindow.closed, "A failed keep leaves the source window open");
    ok(
      !standaloneWindow.ZenExternalLinkStandalone.isKeeping,
      "A failed keep resets the in-flight state"
    );
    for (const button of standaloneWindow.document.querySelectorAll(
      '#zen-standalone-window-toolbar [role="button"]'
    )) {
      ok(
        !button.hasAttribute("disabled"),
        "A failed keep re-enables every keep control"
      );
    }
  } finally {
    gZenStandaloneWindowManager.adoptStandaloneTab = originalAdopt;
    gZenStandaloneWindowManager.reopenStandaloneUrlInSpace = originalReopen;
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_space_picker_rows_show_a_named_icon_tile() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?picker-rows`
  );

  try {
    const document = standaloneWindow.document;
    const panel = document.getElementById(
      "PanelUI-zen-standalone-window-spaces"
    );
    const pickerButton =
      standaloneWindow.ZenExternalLinkStandalone.toolbar.spacePickerButton;
    EventUtils.synthesizeMouseAtCenter(pickerButton, {}, standaloneWindow);
    await TestUtils.waitForCondition(
      () => panel.state === "open",
      "Waiting for the space picker to open from its visible chevron"
    );

    const activeWorkspace = gZenWorkspaces.getActiveWorkspace();
    const row = document.querySelector(
      `#PanelUI-zen-standalone-window-spaces-list [zen-workspace-id="${activeWorkspace.uuid}"]`
    );
    ok(row, "The active space has a row in the picker");
    Assert.equal(
      row.getAttribute("active"),
      "true",
      "The row for the current space is marked as active"
    );

    // MozToolbarbutton leaves a button with children of its own alone, which is
    // what lets a row pair an icon tile with a separate name label.
    ok(
      !row.querySelector(":scope > .toolbarbutton-text"),
      "The row keeps its own content instead of the default button content"
    );
    ok(
      row.querySelector(".zen-standalone-window-space-icon"),
      "The row leads with an icon tile"
    );
    Assert.equal(
      row
        .querySelector(".zen-standalone-window-space-name")
        ?.getAttribute("value"),
      activeWorkspace.name,
      "The row is labelled with the space name"
    );

    const search = document.getElementById(
      "PanelUI-zen-standalone-window-spaces-search"
    );
    const empty = document.getElementById(
      "PanelUI-zen-standalone-window-spaces-empty"
    );
    ok(empty.hidden, "The empty state is hidden while spaces are listed");

    search.value = "no space is called this";
    search.dispatchEvent(new standaloneWindow.Event("input"));
    ok(!empty.hidden, "A search with no matches shows the empty state");

    search.value = "";
    search.dispatchEvent(new standaloneWindow.Event("input"));
    ok(empty.hidden, "Clearing the search hides the empty state again");

    document
      .getElementById("PanelUI-zen-standalone-window-spaces-collapse")
      .doCommand();
    await TestUtils.waitForCondition(
      () => panel.state === "closed",
      "Waiting for the collapse button to close the picker"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_keep_standalone_window_in_selected_space() {
  const originalWorkspace = gZenWorkspaces.getActiveWorkspace();
  const targetWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Standalone Target Space"
  );
  await gZenWorkspaces.changeWorkspace(originalWorkspace);

  const url = `${TEST_URL_BASE}?keep-selected`;
  const standaloneWindow = await openExternalLinkStandaloneWindow(url);
  const pickerList = standaloneWindow.document.getElementById(
    "PanelUI-zen-standalone-window-spaces-list"
  );
  const pickerSearch = standaloneWindow.document.getElementById(
    "PanelUI-zen-standalone-window-spaces-search"
  );

  let tab;
  try {
    ok(
      gZenStandaloneWindowManager.openStandaloneSpacePicker(standaloneWindow),
      "The standalone space picker opens"
    );

    const targetItem = pickerList.querySelector(
      `[zen-workspace-id="${targetWorkspace.uuid}"]`
    );
    ok(targetItem, "The selected target workspace appears in the picker");

    // The search field narrows the list to matching space names.
    pickerSearch.value = "Standalone Target";
    pickerSearch.dispatchEvent(new standaloneWindow.Event("input"));
    ok(!targetItem.hidden, "A matching space stays visible while searching");
    ok(
      [...pickerList.children].some(row => row.hidden),
      "Non-matching spaces are filtered out"
    );
    pickerSearch.value = "";
    pickerSearch.dispatchEvent(new standaloneWindow.Event("input"));

    const tabOpened = BrowserTestUtils.waitForEvent(
      gBrowser.tabContainer,
      "TabOpen"
    );
    const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
    targetItem.doCommand();

    tab = (await tabOpened).target;
    await closed;

    await TestUtils.waitForCondition(
      () => tab.getAttribute("zen-workspace-id") === targetWorkspace.uuid,
      "Waiting for the kept tab to be filed in the selected workspace"
    );
    Assert.equal(
      tab.linkedBrowser.currentURI.spec,
      url,
      "The kept tab still shows the standalone URL"
    );
  } finally {
    if (!standaloneWindow.closed) {
      await closeStandaloneWindow(standaloneWindow);
    }
    await gZenWorkspaces.changeWorkspace(originalWorkspace);
    if (tab) {
      BrowserTestUtils.removeTab(tab);
    }
    await gZenWorkspaces.removeWorkspace(targetWorkspace.uuid);
  }
});

add_task(async function test_standalone_window_is_not_part_of_the_session() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?session`
  );

  try {
    const windowData = SessionStore.getWindowState(standaloneWindow).windows[0];
    ok(
      windowData.isZenStandalone,
      "Session store marks the window as standalone"
    );
    ok(
      windowData.isZenUnsynced,
      "A standalone window is never a synced window"
    );

    const state = JSON.parse(SessionStore.getBrowserState());
    ok(
      !state.windows.some(win => win.isZenStandalone),
      "No standalone window is written into the session state"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_closed_standalone_window_is_not_reopenable() {
  const closedWindowCount = SessionStore.getClosedWindowCount();
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?closed-window`
  );

  await closeStandaloneWindow(standaloneWindow);
  await TestUtils.waitForTick();

  Assert.equal(
    SessionStore.getClosedWindowCount(),
    closedWindowCount,
    "A closed standalone window is not offered as a window to reopen"
  );
});

add_task(async function test_closing_leaves_the_page_as_a_closed_tab() {
  const url = `${TEST_URL_BASE}?undo-close`;
  const matchingClosedTabsBefore = SessionStore.getClosedTabDataForWindow(
    window
  ).filter(tab => tab.state.entries.at(-1)?.url === url).length;
  const standaloneWindow = await openExternalLinkStandaloneWindow(url);

  await closeStandaloneWindow(standaloneWindow);
  await TestUtils.waitForCondition(
    () =>
      SessionStore.getClosedTabDataForWindow(window).some(
        tab => tab.state.entries.at(-1)?.url === url
      ),
    "Waiting for the standalone page to land in the closed tab list"
  );

  Assert.equal(
    SessionStore.getClosedTabDataForWindow(window).filter(
      tab => tab.state.entries.at(-1)?.url === url
    ).length,
    matchingClosedTabsBefore + 1,
    "All close paths converge on one closed-tab archive record"
  );

  const closedTab = SessionStore.getClosedTabDataForWindow(window).find(
    tab => tab.state.entries.at(-1)?.url === url
  );
  ok(
    !closedTab.state.zenWorkspace,
    "The closed tab carries no space of its own, so it reopens where the user is"
  );

  const restored = SessionWindowUI.undoCloseTab(window, 0);
  await TestUtils.waitForCondition(
    () => restored.linkedBrowser?.currentURI?.spec === url,
    "Waiting for the reopened tab to carry the standalone page"
  );

  Assert.equal(
    restored.ownerDocument.defaultView,
    window,
    "Undo close tab reopens the page as a tab of the normal window"
  );
  ok(
    !gZenStandaloneWindowManager.isStandaloneWindow(
      restored.ownerDocument.defaultView
    ),
    "Undo close tab does not bring back a standalone window"
  );

  const restoredSpace = restored.getAttribute("zen-workspace-id");
  Assert.equal(
    restoredSpace || gZenWorkspaces.activeWorkspace,
    gZenWorkspaces.activeWorkspace,
    "The reopened page belongs to no space other than the current one"
  );

  BrowserTestUtils.removeTab(restored);
});

add_task(async function test_external_link_without_an_opener_window() {
  const url = `${TEST_URL_BASE}?no-opener`;
  const standaloneWindow =
    gZenStandaloneWindowManager.openExternalLinkStandaloneWindow({
      uriString: url,
      options: { fromExternal: true },
      openerWindow: null,
    });
  ok(
    standaloneWindow,
    "An external link is handled with no window to open it from"
  );

  await waitForStandaloneWindowReady(standaloneWindow, url);
  try {
    assertStandaloneWindow(standaloneWindow);
    Assert.equal(
      standaloneWindow.ZenExternalLinkStandalone.openerWindow,
      null,
      "The window knows it was opened without an opener"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_startup_window_is_held_for_a_cold_external_link() {
  // When Zen is not running, macOS can deliver a clicked link as its own
  // command line just after the initial, URL-less one. The startup window is
  // therefore held back for a moment, and dropped entirely once the link
  // turns up, so a cold external open produces a standalone and nothing else.
  // The production manager is a process singleton and earlier tasks may have
  // consumed its one-shot startup deferral. Use a fresh manager for this
  // isolated lifecycle test so the assertion describes one launch, not test
  // ordering.
  const startupManager = new nsZenStandaloneWindowManager();
  let openedStartupWindow = false;
  const held = startupManager.deferStartupWindowForExternalLink(() => {
    openedStartupWindow = true;
  });

  if (AppConstants.platform !== "macosx") {
    ok(!held, "Only macOS splits a cold external open across command lines");
    return;
  }

  ok(held, "The classic startup window is held while a link could still come");
  ok(startupManager.isHoldingStartupWindow, "The manager owns the held window");

  const url = `${TEST_URL_BASE}?cold-start`;
  const existingWindows = new Set(getStandaloneWindows());
  ok(
    startupManager.openExternalLinksInStandaloneWindows([url]),
    "The link that launched Zen goes to a standalone window"
  );

  const standaloneWindow = await waitForNewStandaloneWindow(
    existingWindows,
    url,
    startupManager
  );
  try {
    ok(
      !startupManager.isHoldingStartupWindow,
      "The link claims the launch, so the held window is dropped"
    );
    ok(openedStartupWindow === false, "Zen's classic startup never runs");
    ok(
      !startupManager.deferStartupWindowForExternalLink(() => {}),
      "Only the first window of a launch is ever held back"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

function getStandaloneWindows() {
  // A no-opener window is observable through the mediator before its chrome
  // document has assigned the navigator:browser window type. Filter by the
  // standalone marker instead of losing that early lifecycle edge.
  return [...Services.wm.getEnumerator(null)].filter(
    win =>
      !win.closed &&
      win.ZenExternalLinkStandaloneType === ZEN_STANDALONE_WINDOW_TYPE
  );
}

// The keep control is built from boxes rather than <toolbarbutton>, so it is
// activated with a real click instead of doCommand().
function clickKeepButton(standaloneWindow, button) {
  const target =
    button ??
    standaloneWindow.document.getElementById(
      "zen-standalone-window-open-in-space-button"
    );
  EventUtils.synthesizeMouseAtCenter(target, {}, standaloneWindow);
}

function isEffectivelyHidden(element) {
  if (!element) {
    return true;
  }
  const ownerWindow = element.ownerGlobal ?? element.ownerDocument?.defaultView;
  if (!ownerWindow) {
    return true;
  }
  const { visibility, display } = ownerWindow.getComputedStyle(element);
  return display === "none" || visibility === "hidden";
}

async function waitForNewStandaloneWindow(
  _existingWindows,
  url,
  manager = gZenStandaloneWindowManager,
  waitForReady = true
) {
  let standaloneWindow = null;
  await TestUtils.waitForCondition(
    () => {
      standaloneWindow = manager.getStandaloneWindowForURL(url);
      return !!standaloneWindow;
    },
    "Waiting for a new standalone window",
    100,
    100
  );
  if (waitForReady) {
    await waitForStandaloneWindowReady(standaloneWindow, url);
  }
  return standaloneWindow;
}

async function waitForStandaloneWindowReady(standaloneWindow, url) {
  await TestUtils.waitForCondition(
    () => standaloneWindow.ZenExternalLinkStandaloneReady === true,
    "Waiting for standalone initialization to complete",
    100,
    100
  );
  await TestUtils.waitForCondition(
    () => standaloneWindow.gBrowser?.selectedBrowser?.currentURI?.spec === url,
    "Waiting for the standalone browser to commit its URL",
    100,
    100
  );
}

async function openExternalLinkStandaloneWindow(url) {
  const existingWindows = new Set(getStandaloneWindows());
  const initialTabCount = gBrowser.tabs.length;

  const tab = gBrowser.addTab(url, {
    fromExternal: true,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  Assert.equal(tab, null, "External addTab is intercepted before tab creation");

  const standaloneWindow = await waitForNewStandaloneWindow(
    existingWindows,
    url
  );
  Assert.equal(
    gBrowser.tabs.length,
    initialTabCount,
    "Opening an external URL does not create a duplicate workspace tab"
  );
  return standaloneWindow;
}

function assertStandaloneWindow(standaloneWindow) {
  Assert.equal(
    standaloneWindow.gBrowser.tabs.length,
    1,
    "Standalone windows contain one normal page tab"
  );
  Assert.equal(
    standaloneWindow.ZenExternalLinkStandaloneType,
    ZEN_STANDALONE_WINDOW_TYPE,
    "The window has the standalone type marker"
  );
  Assert.equal(
    standaloneWindow.document.documentElement.getAttribute(
      "zen-standalone-window"
    ),
    "true",
    "The chrome document has the standalone marker"
  );
  ok(
    !standaloneWindow.gZenWorkspaces.shouldHaveWorkspaces,
    "The standalone window has no workspace subsystem"
  );
  ok(
    !standaloneWindow.gBrowser.selectedTab.hasAttribute("zen-workspace-id"),
    "The standalone page has no workspace membership"
  );
  // Workspace chrome is hidden by the stylesheet keyed off that marker rather
  // than by hiding individual nodes, so assert on the rendered result.
  // #navigator-toolbox is the sidebar itself: hiding only its children would
  // leave an empty column, since it carries a persisted width.
  for (const id of [
    "navigator-toolbox",
    "sidebar-container",
    "PersonalToolbar",
  ]) {
    ok(
      isEffectivelyHidden(standaloneWindow.document.getElementById(id)),
      `Standalone windows hide #${id}`
    );
  }

  // Shortcuts that would drag workspace chrome back into the window are off.
  for (const id of [
    "cmd_newNavigator",
    "cmd_newNavigatorTab",
    "cmd_newNavigatorTabNoEvent",
    "cmd_newPrivateWindow",
    "Browser:DuplicateTab",
    "Browser:AddTabSplitView",
    "Browser:SeparateTabSplitView",
    "Tools:PrivateBrowsing",
    "Tools:ClassicWindow",
    "History:UndoCloseTab",
    "History:UndoCloseWindow",
    "cmd_toggleCompactModeIgnoreHover",
    "cmd_zenToggleSidebar",
    "cmd_zenCompactModeShowSidebar",
  ]) {
    const command = standaloneWindow.document.getElementById(id);
    if (command) {
      Assert.equal(
        command.getAttribute("disabled"),
        "true",
        `${id} is disabled in standalone windows`
      );
    }
  }

  const tabboxWrapper =
    standaloneWindow.document.getElementById("zen-tabbox-wrapper");
  const margin =
    standaloneWindow.getComputedStyle(tabboxWrapper).marginInlineStart;
  Assert.equal(
    margin,
    "0px",
    "The page sits flush against the window, with no separation margin"
  );
}

async function closeStandaloneWindow(standaloneWindow) {
  if (!standaloneWindow || standaloneWindow.closed) {
    return;
  }

  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
  standaloneWindow.close();
  await closed;
}
