/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  TaskbarTabsRegistry:
    "resource:///modules/taskbartabs/TaskbarTabsRegistry.sys.mjs",
  TaskbarTabsWindowManager:
    "resource:///modules/taskbartabs/TaskbarTabsWindowManager.sys.mjs",
});

// Bug 2065228 - a window's chrome is fixed at creation time and can't
// be changed by SessionStore's restore machinery afterwards. These tests
// check that SessionStore records a diagnostic Glean event whenever
// setWindowState() is asked to apply a mismatched isPopup value onto an
// existing window.

async function resetTelemetry() {
  await Services.fog.testFlushAllChildren();
  Services.fog.testResetFOG();
}

registerCleanupFunction(resetTelemetry);

/**
 * Given an existing window and a window session state with conflicting window
 * features, try to set the session state on the window and validate that we
 * correctly record the feature mismatch.
 *
 * @param {Window} existingWindow
 * @param {string} existingFeatures
 * @param {{windows: WindowStateData[]}} requestedState
 * @param {string} requestedFeatures
 */
function setWindowState(
  existingWindow,
  existingFeatures,
  requestedState,
  requestedFeatures
) {
  ss.setWindowState(existingWindow, JSON.stringify(requestedState), true);

  let events =
    Glean.sessionRestore.windowFeaturesMismatchIgnored.testGetValue();
  is(events.length, 1, "One mismatch event should have been recorded");
  is(
    events[0].extra.entry_point,
    "set_window_state",
    "entry_point should be set_window_state"
  );
  is(
    events[0].extra.existing_features,
    existingFeatures,
    "existing features were recorded correctly"
  );
  is(
    events[0].extra.requested_features,
    requestedFeatures,
    "requested features were recorded correctly"
  );
}

// Mirrors the features string URILoadingHelper.sys.mjs's openInWindow()
// builds for a "chromeless" open (e.g. onboarding's where: "chromeless").
const CHROMELESS_FEATURES = "toolbar=no,resizable,minimizable,titlebar,close";

// Mirrors the features string browser.windows.create({type: "popup"})
// builds in ext-windows.js.
const EXTENSION_POPUP_FEATURES =
  "toolbar=no,resizable,minimizable,titlebar,close,centerscreen";

/**
 * Note: This uses Services.ww.openWindow directly instead of
 * BrowserTestUtils.openNewBrowserWindow because supplying a custom args
 * array for openNewBrowserWindow will not trigger the "first browser loaded."
 *
 * @param {string} key
 *   Set the extra option `key` to `true` on the new window.
 * @param {string} features
 *   Partial window.open features string.
 * @returns {Promise<Window>}
 */
function openWindowWithExtraOption(key, features) {
  let extraOptions = Cc["@mozilla.org/hash-property-bag;1"].createInstance(
    Ci.nsIWritablePropertyBag2
  );
  extraOptions.setPropertyAsBool(key, true);
  let args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  args.appendElement(null);
  args.appendElement(extraOptions);

  let win = Services.ww.openWindow(
    window,
    AppConstants.BROWSER_CHROME_URL,
    "_blank",
    `chrome,dialog=no,${features}`,
    args
  );
  return new Promise(resolve => {
    win.addEventListener(
      "load",
      () => win.delayedStartupPromise.then(() => resolve(win)),
      { once: true }
    );
  });
}

add_task(async function test_normal_window_asked_to_become_private() {
  await resetTelemetry();

  let win = await BrowserTestUtils.openNewBrowserWindow();
  is(
    PrivateBrowsingUtils.isWindowPrivate(win),
    false,
    "New window should not be a private window"
  );

  let state = { windows: [{ tabs: [{ entries: [] }], isPrivate: true }] };
  setWindowState(win, "", state, "private");
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_private_window_asked_to_become_normal() {
  await resetTelemetry();

  let win = await BrowserTestUtils.openNewBrowserWindow({ private: true });
  is(
    PrivateBrowsingUtils.isWindowPrivate(win),
    true,
    "New window should be a private window"
  );

  let state = { windows: [{ tabs: [{ entries: [] }] }] };
  setWindowState(win, "private", state, "");
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_normal_window_asked_to_become_popup() {
  await resetTelemetry();

  let win = await BrowserTestUtils.openNewBrowserWindow();
  is(win.toolbar.visible, true, "New window should not be a popup");

  let state = { windows: [{ tabs: [{ entries: [] }], isPopup: true }] };
  setWindowState(win, "", state, "popup");
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_popup_window_asked_to_become_normal() {
  await resetTelemetry();

  let win = await BrowserTestUtils.openNewBrowserWindow({
    all: false,
    features: "toolbar=no",
  });
  is(win.toolbar.visible, false, "New window should be a popup");

  let state = { windows: [{ tabs: [{ entries: [] }] }] };
  setWindowState(win, "popup", state, "");
  await BrowserTestUtils.closeWindow(win);
});

/**
 * Opens a Taskbar Tab window for https://example.com. Uses an in-memory
 * TaskbarTabsRegistry so that nothing is persisted to disk.
 *
 * @returns {Promise<Window>}
 */
async function openTaskbarTabWindow() {
  let registry = new TaskbarTabsRegistry({ save: () => {} }, []);
  let url = Services.io.newURI("https://example.com");
  let { taskbarTab } = await registry.findOrCreateTaskbarTab(url, 0);

  let windowManager = new TaskbarTabsWindowManager();
  return windowManager.openWindow(taskbarTab);
}

add_task(async function test_normal_window_asked_to_become_taskbar_tab() {
  await resetTelemetry();

  let win = await BrowserTestUtils.openNewBrowserWindow();

  let state = { windows: [{ tabs: [{ entries: [] }], isTaskbarTab: true }] };
  setWindowState(win, "", state, "taskbartab");
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_taskbar_tab_asked_to_become_normal_window() {
  await resetTelemetry();

  let win = await openTaskbarTabWindow();

  let state = { windows: [{ tabs: [{ entries: [] }] }] };
  setWindowState(win, "taskbartab", state, "");
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_normal_window_asked_to_become_chromeless_window() {
  await resetTelemetry();

  let win = await BrowserTestUtils.openNewBrowserWindow();
  is(win.toolbar.visible, true, "New window should not be a popup");

  let state = {
    windows: [
      {
        tabs: [{ entries: [] }],
        isPopup: true,
        args: { "chromeless-window": true },
      },
    ],
  };
  setWindowState(win, "", state, "popup,chromeless-window");
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_chromeless_window_asked_to_become_normal() {
  await resetTelemetry();

  let win = await openWindowWithExtraOption(
    "chromeless-window",
    CHROMELESS_FEATURES
  );
  is(win.toolbar.visible, false, "New window should be a popup");
  is(
    win.document.documentElement.hasAttribute("chromeless-window"),
    true,
    "New window should have the chromeless-window attribute"
  );

  let state = { windows: [{ tabs: [{ entries: [] }] }] };
  setWindowState(win, "popup,chromeless-window", state, "");
  await BrowserTestUtils.closeWindow(win);
});

add_task(
  async function test_normal_window_asked_to_become_web_extension_popup_window() {
    await resetTelemetry();

    let win = await BrowserTestUtils.openNewBrowserWindow();
    is(win.toolbar.visible, true, "New window should not be a popup");

    let state = {
      windows: [
        {
          tabs: [{ entries: [] }],
          isPopup: true,
          args: { "web-extension-popup-window": true },
        },
      ],
    };
    setWindowState(win, "", state, "popup,web-extension-popup-window");
    await BrowserTestUtils.closeWindow(win);
  }
);

add_task(
  async function test_web_extension_popup_window_asked_to_become_normal() {
    await resetTelemetry();

    let win = await openWindowWithExtraOption(
      "web-extension-popup-window",
      EXTENSION_POPUP_FEATURES
    );
    is(win.toolbar.visible, false, "New window should be a popup");
    is(
      win.document.documentElement.hasAttribute("web-extension-popup-window"),
      true,
      "New window should have the web-extension-popup-window attribute"
    );

    let state = { windows: [{ tabs: [{ entries: [] }] }] };
    setWindowState(win, "popup,web-extension-popup-window", state, "");
    await BrowserTestUtils.closeWindow(win);
  }
);

add_task(async function test_matching_state_records_nothing() {
  await resetTelemetry();

  let win = await BrowserTestUtils.openNewBrowserWindow();
  is(win.toolbar.visible, true, "New window should not be a popup");

  let state = { windows: [{ tabs: [{ entries: [] }] }] };
  ss.setWindowState(win, JSON.stringify(state), true);

  is(
    Glean.sessionRestore.windowFeaturesMismatchIgnored.testGetValue(),
    null,
    "No mismatch event should be recorded when isPopup matches"
  );

  await BrowserTestUtils.closeWindow(win);
});
