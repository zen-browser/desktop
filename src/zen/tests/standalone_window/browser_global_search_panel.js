/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/* eslint-disable mozilla/valid-services -- Services.zen is Zen's custom XPCOM service. */

const {
  ZEN_GLOBAL_SEARCH_DEFAULT_SHORTCUT,
  ZEN_GLOBAL_SEARCH_PANEL_TYPE,
  formatGlobalSearchShortcut,
  gZenGlobalSearchPanel,
  parseGlobalSearchShortcut,
  serializeGlobalSearchShortcut,
} = ChromeUtils.importESModule(
  "resource:///modules/zen/standalonewindow/ZenGlobalSearchPanel.sys.mjs"
);
const { gZenStandaloneWindowManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/standalonewindow/ZenStandaloneWindowManager.sys.mjs"
);

const TEST_URL = "https://example.com/zen-global-search-test";

registerCleanupFunction(async () => {
  gZenGlobalSearchPanel.cancel("test-cleanup");
  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    if (gZenStandaloneWindowManager.isStandaloneWindow(win)) {
      win.skipNextCanClose = true;
      win.close();
    }
  }
});

add_task(function test_shortcut_serialization_and_validation() {
  Assert.deepEqual(
    parseGlobalSearchShortcut(ZEN_GLOBAL_SEARCH_DEFAULT_SHORTCUT),
    { modifiers: ["meta", "alt"], code: "KeyT" },
    "The documented default serialization parses"
  );
  Assert.equal(
    formatGlobalSearchShortcut(ZEN_GLOBAL_SEARCH_DEFAULT_SHORTCUT),
    "⌘ ⌥ T",
    "The default uses the same macOS modifier names as Zen shortcuts"
  );
  Assert.equal(
    serializeGlobalSearchShortcut({
      code: "KeyT",
      ctrlKey: false,
      metaKey: true,
      altKey: true,
      shiftKey: false,
    }),
    ZEN_GLOBAL_SEARCH_DEFAULT_SHORTCUT,
    "A recorder event round-trips to the stable form"
  );
  for (const invalid of [
    "",
    "shift|KeyT",
    "meta|Escape",
    "meta,meta|KeyT",
    "meta|",
    "wat|KeyT",
  ]) {
    Assert.equal(
      parseGlobalSearchShortcut(invalid),
      null,
      `${invalid || "an empty value"} is rejected`
    );
  }

  const nativeResult = JSON.parse(
    Services.zen.registerGlobalSearchHotkey("shift|KeyT")
  );
  Assert.ok(
    !nativeResult.ok,
    "The native bridge independently rejects unsafe input"
  );
  Assert.equal(
    nativeResult.reason,
    "invalid",
    "The failure reason is structured"
  );
});

add_task(function test_global_request_uses_existing_standalone_contract() {
  const request =
    gZenStandaloneWindowManager.createGlobalSearchStandaloneWindowRequest({
      uriString: TEST_URL,
      triggeringPrincipal: null,
      referrerInfo: null,
      policyContainer: null,
      userContextId: 4,
      postData: null,
    });
  Assert.equal(request.source, "global-search", "The source is explicit");
  Assert.equal(
    request.openerWindow,
    null,
    "Panel geometry is never an opener context"
  );
  Assert.equal(request.userContextId, 4, "Container context survives handoff");
  Assert.ok(
    request.broughtApplicationForward,
    "Submission participates in existing close-time focus return"
  );
});

add_task(async function test_disabled_preference_blocks_internal_entry_point() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.standalone-window.enabled", false]],
  });
  Assert.equal(
    await gZenGlobalSearchPanel.open(),
    null,
    "No panel is created when the combined setting is disabled"
  );
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_internal_command_opens_and_cancels_real_panel() {
  const workspaceTabCount = window.gBrowser.tabs.length;
  const closedTabCount = SessionStore.getClosedTabCount(window);

  Services.obs.notifyObservers(null, "zen-open-global-search-panel");
  await TestUtils.waitForCondition(
    () => gZenGlobalSearchPanel.panelWindow?.gURLBar,
    "Waiting for the global-search panel"
  );
  const panel = gZenGlobalSearchPanel.panelWindow;
  const baseWindow = panel.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);

  Assert.equal(
    panel.ZenGlobalSearchPanelType,
    ZEN_GLOBAL_SEARCH_PANEL_TYPE,
    "The panel has its own early identity"
  );
  Assert.ok(panel._zenGlobalSearchPanel, "The transient marker is present");
  Assert.ok(
    !panel._zenStandaloneWindow,
    "The panel is not a standalone window"
  );
  Assert.ok(
    Services.zen.isGlobalSearchPanel(baseWindow),
    "The native host is an NSPanel"
  );
  Assert.equal(
    panel.document.documentURI,
    "chrome://browser/content/zen-global-search-panel.xhtml",
    "The NSPanel loads its dedicated component host, not browser.xhtml"
  );
  Assert.ok(
    panel.gBrowserInit.delayedStartupFinished,
    "The component host exposes an already-complete startup state"
  );
  Assert.equal(
    panel.gBrowserInit.isAdoptingTab(),
    false,
    "Extension navigation sees that the component host is not adopting a tab"
  );
  Assert.equal(
    panel.gBrowser.getTabForBrowser(panel.gBrowser.selectedBrowser),
    panel.gBrowser.selectedTab,
    "Extension tab lookup resolves the panel context browser"
  );
  Assert.equal(panel.gZenWorkspaces, undefined, "It owns no workspace");
  Assert.equal(
    panel.document.getElementById("zen-browser-background"),
    null,
    "The normal Zen background is absent rather than hidden"
  );
  Assert.equal(
    panel.document.getElementById("zen-appcontent-wrapper"),
    null,
    "The browser content wrapper is absent rather than hidden"
  );
  Assert.equal(
    panel.document.documentElement.getAttribute("zen-global-search-panel"),
    "true",
    "Search-only chrome is active"
  );
  Assert.ok(
    panel.gURLBar.hasAttribute("zen-floating-urlbar"),
    "The real URL bar is the panel's only visible component"
  );
  const searchOneOffs = panel.gURLBar.querySelector(".search-one-offs");
  Assert.ok(searchOneOffs, "The search-engine one-offs slot is present");
  Assert.equal(
    panel.gURLBar.view.oneOffSearchButtons.container,
    searchOneOffs,
    "The URL bar initializes its real search-engine one-offs"
  );
  Assert.equal(
    panel.getComputedStyle(panel.gURLBar).backgroundColor,
    "rgb(24, 24, 27)",
    "The search surface is opaque instead of exposing the desktop wallpaper"
  );
  const urlbarBounds = panel.gURLBar.getBoundingClientRect();
  Assert.equal(urlbarBounds.x, 0, "The search surface starts at the left edge");
  Assert.equal(urlbarBounds.y, 0, "The search surface starts at the top edge");
  Assert.equal(
    urlbarBounds.width,
    panel.innerWidth,
    "The search surface fills the window width"
  );
  Assert.equal(
    urlbarBounds.height,
    panel.innerHeight,
    "The search surface fills the window height"
  );
  const rootStyle = panel.getComputedStyle(panel.document.documentElement);
  Assert.equal(
    panel.getComputedStyle(panel.gURLBar).borderRadius,
    rootStyle.getPropertyValue("--border-radius-medium").trim(),
    "The search window uses the floating URL bar's corner radius"
  );
  const toolboxStyle = panel.getComputedStyle(
    panel.document.getElementById("navigator-toolbox")
  );
  Assert.equal(
    toolboxStyle.borderRadius,
    "16px",
    "The outer browser chrome is clipped to the same rounded corners"
  );
  Assert.equal(
    toolboxStyle.boxShadow,
    "none",
    "The outer browser chrome adds no shadow"
  );
  const inputContainerStyle = panel.getComputedStyle(
    panel.gURLBar.querySelector(".urlbar-input-container")
  );
  Assert.equal(
    inputContainerStyle.paddingLeft,
    "16px",
    "The search field keeps readable leading padding"
  );
  const panelSnapshot = SpecialPowers.snapshotWindow(
    panel,
    false,
    undefined,
    "rgba(0, 0, 0, 0)"
  );
  const snapshotContext = panelSnapshot.getContext("2d");
  for (const [corner, x, y] of [
    ["top-left", 0, 0],
    ["top-right", panelSnapshot.width - 1, 0],
    ["bottom-left", 0, panelSnapshot.height - 1],
    ["bottom-right", panelSnapshot.width - 1, panelSnapshot.height - 1],
  ]) {
    Assert.equal(
      snapshotContext.getImageData(x, y, 1, 1).data[3],
      0,
      `The ${corner} window corner is transparent`
    );
  }
  Assert.lessOrEqual(
    Math.abs(
      panel.screenX +
        panel.outerWidth / 2 -
        (panel.screen.availLeft + panel.screen.availWidth / 2)
    ),
    1,
    "The panel is horizontally centered in the available screen"
  );
  Assert.lessOrEqual(
    Math.abs(
      panel.screenY +
        panel.outerHeight / 2 -
        (panel.screen.availTop + panel.screen.availHeight / 2)
    ),
    1,
    "The panel is vertically centered in the available screen"
  );
  Assert.ok(panel.gURLBar.focused, "The existing URL bar owns keyboard focus");
  Assert.equal(
    window.gBrowser.tabs.length,
    workspaceTabCount,
    "Opening the panel creates no normal workspace tab"
  );

  EventUtils.synthesizeKey("KEY_Escape", {}, panel);
  await TestUtils.waitForCondition(
    () => panel.closed,
    "Waiting for Escape to close the panel"
  );
  Assert.equal(
    SessionStore.getClosedTabCount(window),
    closedTabCount,
    "Cancellation creates no Undo Close Tab entry"
  );
});

add_task(async function test_submission_creates_fresh_ordinary_standalone() {
  const existing = new Set(
    [...Services.wm.getEnumerator("navigator:browser")].filter(win =>
      gZenStandaloneWindowManager.isStandaloneWindow(win)
    )
  );
  const panel = await gZenGlobalSearchPanel.open({ initialValue: TEST_URL });
  Assert.ok(panel, "A fresh panel opens for submission");
  Assert.ok(
    panel.gURLBar.hasAttribute("action-override"),
    "Switch-to-tab results are converted to URL navigation in this host"
  );
  panel.gURLBar._zenHandleUrlbarClose(true, true);
  Assert.ok(
    !panel.closed && gZenGlobalSearchPanel.panelWindow === panel,
    "The URL bar's pre-navigation close hook leaves submission to _loadURL"
  );

  panel.gURLBar._loadURL(TEST_URL, null, "current", {
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  await TestUtils.waitForCondition(
    () =>
      [...Services.wm.getEnumerator("navigator:browser")].some(
        win =>
          !existing.has(win) &&
          gZenStandaloneWindowManager.isStandaloneWindow(win)
      ),
    "Waiting for the submitted standalone"
  );
  const standalone = [...Services.wm.getEnumerator("navigator:browser")].find(
    win =>
      !existing.has(win) && gZenStandaloneWindowManager.isStandaloneWindow(win)
  );
  await TestUtils.waitForCondition(
    () => standalone.gBrowser?.currentURI?.spec === TEST_URL,
    "Waiting for the standalone URL"
  );

  Assert.ok(panel.closed, "Submission closes the panel before navigation");
  Assert.equal(
    standalone.ZenExternalLinkStandalone.source,
    "global-search",
    "The existing standalone lifecycle records the global-search source"
  );
  const standaloneBaseWindow = standalone.docShell.treeOwner.QueryInterface(
    Ci.nsIBaseWindow
  );
  Assert.ok(
    !Services.zen.isGlobalSearchPanel(standaloneBaseWindow),
    "The loaded standalone is distinct from the search panel"
  );
  if (!Services.env.get("MOZ_HEADLESS")) {
    Assert.ok(
      Services.zen.isStandalonePanel(standaloneBaseWindow),
      "A search submission opens in the dedicated standalone NSPanel"
    );
  }
  standalone.skipNextCanClose = true;
  standalone.close();
});
