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
    ok(
      standaloneWindow.document.getElementById(
        "zen-standalone-window-open-in-space-button"
      ),
      "Standalone window has the primary Open in Space button"
    );
    ok(
      standaloneWindow.document.getElementById(
        "zen-standalone-window-space-picker-button"
      ),
      "Standalone window has the workspace picker button"
    );
  } finally {
    await closeStandaloneWindow(standaloneWindow);
  }
});

add_task(async function test_multiple_external_links_open_multiple_windows() {
  const firstWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?multiple=1`,
    { requireToolbar: false }
  );
  const secondWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?multiple=2`,
    { requireToolbar: false }
  );

  try {
    Assert.notEqual(
      firstWindow,
      secondWindow,
      "Each external link gets its own standalone window"
    );
    assertStandaloneWindow(firstWindow);
    assertStandaloneWindow(secondWindow);
  } finally {
    await closeStandaloneWindow(firstWindow);
    await closeStandaloneWindow(secondWindow);
  }
});

add_task(async function test_close_standalone_window_without_keeping() {
  const initialTabCount = gBrowser.tabs.length;
  const standaloneWindow = await openExternalLinkStandaloneWindow(
    `${TEST_URL_BASE}?close`,
    { requireToolbar: false }
  );

  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
  ok(
    gZenStandaloneWindowManager.closeStandaloneWindow(standaloneWindow),
    "Standalone manager starts closing the standalone window"
  );
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

  const tabOpened = BrowserTestUtils.waitForNewTab(gBrowser, url, true);
  const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
  button.doCommand();

  const tab = await tabOpened;
  await closed;

  try {
    Assert.equal(
      tab.linkedBrowser.currentURI.spec,
      url,
      "The standalone URL opens as a normal tab"
    );
    Assert.equal(gBrowser.selectedTab, tab, "The kept tab is selected");
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
  const pickerButton = standaloneWindow.document.getElementById(
    "zen-standalone-window-space-picker-button"
  );
  const pickerPopup = standaloneWindow.document.getElementById(
    "zen-standalone-window-space-picker-popup"
  );

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

    const tabOpened = BrowserTestUtils.waitForNewTab(gBrowser, url, true);
    const closed = BrowserTestUtils.domWindowClosed(standaloneWindow);
    targetItem.doCommand();

    const tab = await tabOpened;
    await closed;

    try {
      Assert.equal(
        tab.getAttribute("zen-workspace-id"),
        targetWorkspace.uuid,
        "The kept tab is assigned to the selected workspace"
      );
    } finally {
      await gZenWorkspaces.changeWorkspace(originalWorkspace);
      BrowserTestUtils.removeTab(tab);
    }
  } finally {
    if (!standaloneWindow.closed) {
      await closeStandaloneWindow(standaloneWindow);
    }
    await gZenWorkspaces.removeWorkspace(targetWorkspace.uuid);
  }
});

function getStandaloneWindows() {
  return [...Services.wm.getEnumerator("navigator:browser")].filter(
    win =>
      !win.closed &&
      (win.ZenExternalLinkStandaloneType === ZEN_STANDALONE_WINDOW_TYPE ||
        win.document.documentElement.getAttribute("zen-standalone-window") ===
          "true")
  );
}

async function openExternalLinkStandaloneWindow(url, options = {}) {
  const existingWindows = new Set(getStandaloneWindows());
  const triggeringPrincipal =
    Services.scriptSecurityManager.getSystemPrincipal();

  const tab = gBrowser.addTab(url, {
    fromExternal: true,
    triggeringPrincipal,
  });
  Assert.equal(tab, null, "External addTab is intercepted before tab creation");

  await TestUtils.waitForCondition(
    () =>
      getStandaloneWindows().some(
        win =>
          !existingWindows.has(win) &&
          isStandaloneWindowReady(win, url, options)
      ),
    "Waiting for a new standalone window",
    100,
    100
  );

  const standaloneWindow = getStandaloneWindows().find(
    win =>
      !existingWindows.has(win) && isStandaloneWindowReady(win, url, options)
  );
  await waitForStandaloneWindowReady(standaloneWindow, url, options);
  return standaloneWindow;
}

async function waitForStandaloneWindowReady(standaloneWindow, url, options) {
  if (!standaloneWindow.gBrowserInit?.delayedStartupFinished) {
    await TestUtils.topicObserved(
      "browser-delayed-startup-finished",
      subject => subject === standaloneWindow
    );
  }

  await TestUtils.waitForCondition(
    () => isStandaloneWindowReady(standaloneWindow, url, options),
    "Waiting for standalone window chrome to initialize",
    100,
    100
  );
}

function isStandaloneWindowReady(standaloneWindow, url, options = {}) {
  const { requireToolbar = true } = options;
  const stateURL = standaloneWindow?.ZenExternalLinkStandalone?.uriString;
  const loadedURL =
    standaloneWindow?.gBrowser?.selectedBrowser?.currentURI?.spec;
  return (
    standaloneWindow?.document?.documentElement?.getAttribute(
      "zen-standalone-window"
    ) === "true" &&
    (!requireToolbar ||
      standaloneWindow.document.getElementById(
        "zen-standalone-window-open-in-space-button"
      )) &&
    (stateURL === url || loadedURL === url)
  );
}

function assertStandaloneWindow(standaloneWindow) {
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
    standaloneWindow.document.getElementById("navigator-toolbox").hidden,
    "Standalone windows hide the normal Zen sidebar/toolbox"
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
