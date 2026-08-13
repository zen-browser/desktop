/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenStandaloneWindowManager, ZEN_STANDALONE_WINDOW_TYPE } =
  ChromeUtils.importESModule(
    "resource:///modules/zen/standalonewindow/ZenStandaloneWindowManager.sys.mjs"
  );

const TEST_URL_BASE = "https://example.com/zen-standalone-window-test";

add_setup(async function () {
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
      "zen-standalone-window-open-in-space-button",
      "zen-standalone-window-space-picker-button",
      "zen-standalone-window-close-button",
    ]) {
      ok(
        standaloneWindow.document.getElementById(id),
        `Standalone window has the ${id} control`
      );
    }

    const navBar = standaloneWindow.document.getElementById("nav-bar");
    const urlBar = standaloneWindow.document.getElementById("urlbar");
    ok(
      !isEffectivelyHidden(navBar),
      "Standalone window keeps the normal nav bar"
    );
    ok(urlBar && !urlBar.readOnly, "Standalone URL bar remains editable");
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_standalone_window_has_no_empty_tab() {
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?no-empty-tab`
  );

  try {
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

add_task(async function test_close_standalone_window_from_toolbar() {
  const initialTabCount = gBrowser.tabs.length;
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?close`
  );
  const closeButton = standaloneWindow.document.getElementById(
    "zen-standalone-window-close-button"
  );

  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
  closeButton.doCommand();
  await closed;

  Assert.equal(
    gBrowser.tabs.length,
    initialTabCount,
    "Closing a standalone window does not keep a tab in the normal workspace"
  );
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
  button.doCommand();

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
  standaloneWindow.document
    .getElementById("zen-standalone-window-open-in-space-button")
    .doCommand();

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

add_task(async function test_keep_standalone_window_in_selected_space() {
  const originalWorkspace = gZenWorkspaces.getActiveWorkspace();
  const targetWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Standalone Target Space"
  );
  await gZenWorkspaces.changeWorkspace(originalWorkspace);

  const url = `${TEST_URL_BASE}?keep-selected`;
  const standaloneWindow = await openExternalLinkStandaloneWindow(url);
  const pickerPopup = standaloneWindow.document.getElementById(
    "zen-standalone-window-space-picker-popup"
  );

  let tab;
  try {
    ok(
      gZenStandaloneWindowManager.openStandaloneSpacePicker(standaloneWindow),
      "The standalone space picker opens"
    );

    const targetItem = pickerPopup.querySelector(
      `menuitem[zen-workspace-id="${targetWorkspace.uuid}"]`
    );
    ok(targetItem, "The selected target workspace appears in the picker");
    pickerPopup.hidePopup();

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

function getStandaloneWindows() {
  return [...Services.wm.getEnumerator("navigator:browser")].filter(
    win =>
      !win.closed &&
      win.ZenExternalLinkStandaloneType === ZEN_STANDALONE_WINDOW_TYPE
  );
}

function isEffectivelyHidden(element) {
  if (!element) {
    return true;
  }
  const { visibility, display } = element.ownerGlobal.getComputedStyle(element);
  return display === "none" || visibility === "hidden";
}

async function waitForNewStandaloneWindow(existingWindows, url) {
  await TestUtils.waitForCondition(
    () =>
      getStandaloneWindows().some(
        win => !existingWindows.has(win) && isStandaloneWindowReady(win, url)
      ),
    "Waiting for a new standalone window",
    100,
    100
  );

  return getStandaloneWindows().find(
    win => !existingWindows.has(win) && isStandaloneWindowReady(win, url)
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

function isStandaloneWindowReady(standaloneWindow, url) {
  if (!standaloneWindow?.gBrowserInit?.delayedStartupFinished) {
    return false;
  }

  const stateURL = standaloneWindow.ZenExternalLinkStandalone?.uriString;
  const loadedURL =
    standaloneWindow.gBrowser?.selectedBrowser?.currentURI?.spec;
  return (
    standaloneWindow.document.documentElement.getAttribute(
      "zen-standalone-window"
    ) === "true" &&
    !!standaloneWindow.document.getElementById(
      "zen-standalone-window-open-in-space-button"
    ) &&
    (stateURL === url || loadedURL === url)
  );
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
  // Workspace chrome is hidden by the stylesheet keyed off that marker rather
  // than by hiding individual nodes, so assert on the rendered result.
  for (const id of ["TabsToolbar", "sidebar-container", "PersonalToolbar"]) {
    ok(
      isEffectivelyHidden(standaloneWindow.document.getElementById(id)),
      `Standalone windows hide #${id}`
    );
  }
}

async function closeStandaloneWindow(standaloneWindow) {
  if (!standaloneWindow || standaloneWindow.closed) {
    return;
  }

  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
  standaloneWindow.close();
  await closed;
}
