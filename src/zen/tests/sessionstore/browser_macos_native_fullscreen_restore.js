/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { SessionStore: sessionStore } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs",
);

async function closeFullscreenTestWindow(win) {
  if (win.closed) {
    return;
  }
  if (win.document.documentElement.hasAttribute("inDOMFullscreen")) {
    await SpecialPowers.spawn(win.gBrowser.selectedBrowser, [], () =>
      content.document.exitFullscreen(),
    );
  }
  if (win.windowState == win.STATE_FULLSCREEN) {
    win.fullScreen = false;
    await TestUtils.waitForCondition(
      () =>
        win.windowState != win.STATE_FULLSCREEN &&
        !win.isInFullScreenTransition,
      "Window should leave native fullscreen during cleanup",
    );
  }
  await BrowserTestUtils.closeWindow(win);
}

async function openFullscreenTestWindow() {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  registerCleanupFunction(() => closeFullscreenTestWindow(win));
  // Zen can copy the previous window's sizemode into a new window.
  // Each scenario must start outside browser fullscreen.
  win.fullScreen = false;
  await TestUtils.waitForCondition(
    () => !win.fullScreen && !win.isInFullScreenTransition,
    "Test window should start outside browser fullscreen",
  );
  return win;
}

add_task(async function test_native_fullscreen_survives_session_restore() {
  const win = await openFullscreenTestWindow();

  win.fullScreen = true;
  await TestUtils.waitForCondition(
    () =>
      win.windowState == win.STATE_FULLSCREEN &&
      win.document.documentElement.hasAttribute("macOSNativeFullscreen") &&
      !win.isInFullScreenTransition,
    "Window should enter native fullscreen",
  );

  const state = sessionStore.getWindowState(win);
  Assert.equal(
    state.windows[0].sizemode,
    "fullscreen",
    "SessionStore should save native fullscreen distinctly from maximized",
  );

  win.fullScreen = false;
  await TestUtils.waitForCondition(
    () =>
      win.windowState != win.STATE_FULLSCREEN && !win.isInFullScreenTransition,
    "Window should leave native fullscreen",
  );

  // Test restoration independently even if the save assertion fails.
  state.windows[0].sizemode = "fullscreen";
  sessionStore.setWindowState(win, JSON.stringify(state), true);
  await TestUtils.waitForCondition(
    () =>
      win.windowState == win.STATE_FULLSCREEN &&
      win.document.documentElement.hasAttribute("macOSNativeFullscreen") &&
      !win.isInFullScreenTransition,
    "SessionStore should restore native fullscreen",
  );
  await closeFullscreenTestWindow(win);
});

async function checkDOMFullscreenSaveMode(startInBrowserFullscreen) {
  const win = await openFullscreenTestWindow();
  const tab = await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    "data:text/html,<button id='enter' onclick='document.documentElement.requestFullscreen()'>Fullscreen</button>",
  );
  if (startInBrowserFullscreen) {
    win.fullScreen = true;
    await TestUtils.waitForCondition(
      () =>
        win.windowState == win.STATE_FULLSCREEN &&
        win.document.documentElement.hasAttribute("macOSNativeFullscreen") &&
        !win.isInFullScreenTransition,
      "Browser should enter native fullscreen before the DOM request",
    );
  }

  Assert.equal(
    win.fullScreen,
    startInBrowserFullscreen,
    "Browser fullscreen precondition should match the scenario",
  );
  await BrowserTestUtils.synthesizeMouseAtCenter(
    "#enter",
    {},
    tab.linkedBrowser,
  );
  await TestUtils.waitForCondition(
    () =>
      win.windowState == win.STATE_FULLSCREEN &&
      win.document.documentElement.hasAttribute("inDOMFullscreen") &&
      !win.isInFullScreenTransition,
    "Window should enter DOM fullscreen",
  );
  Assert.equal(
    sessionStore.getWindowState(win).windows[0].sizemode,
    startInBrowserFullscreen ? "fullscreen" : "maximized",
    "DOM fullscreen should preserve the underlying browser fullscreen mode",
  );

  await SpecialPowers.spawn(tab.linkedBrowser, [], () =>
    content.document.exitFullscreen(),
  );
  await TestUtils.waitForCondition(
    () =>
      !win.document.documentElement.hasAttribute("inDOMFullscreen") &&
      win.fullScreen == startInBrowserFullscreen &&
      !win.isInFullScreenTransition,
    "Leaving DOM fullscreen should restore the underlying browser mode",
  );
  await closeFullscreenTestWindow(win);
}

add_task(
  async function test_dom_only_fullscreen_is_not_saved_as_browser_mode() {
    await checkDOMFullscreenSaveMode(false);
  },
);

add_task(async function test_dom_fullscreen_preserves_browser_fullscreen() {
  await checkDOMFullscreenSaveMode(true);
});
