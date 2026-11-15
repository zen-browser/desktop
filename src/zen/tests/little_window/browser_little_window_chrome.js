/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { BrowserWindowTracker } = ChromeUtils.importESModule(
  "resource:///modules/BrowserWindowTracker.sys.mjs"
);

add_task(async function test_little_window_chrome() {
  const win = await openLittleWindow({ url: TEST_URL });
  const root = win.document.documentElement;

  ok(ZenLittleWindow.isLittleWindow(win), "The window is a little window");
  ok(!ZenLittleWindow.isLittleWindow(window), "The opener is not one");
  ok(
    root.hasAttribute("zen-unsynced-window"),
    "A little window is a blank window"
  );
  ok(
    !root.hasAttribute("zen-single-toolbar"),
    "A little window keeps the toolbar on top"
  );
  ok(!root.hasAttribute("persist"), "Its size is not persisted");
  Assert.less(
    win.outerWidth,
    window.outerWidth,
    "A little window is smaller than a regular one"
  );

  ok(!isShown(win, "navigator-toolbox"), "The sidebar is hidden");
  ok(isShown(win, "urlbar-container"), "The URL bar is shown");
  ok(isShown(win, "zen-little-window-open-button"), "Open in space is shown");
  ok(isShown(win, "zen-little-window-container"), "The container is shown");
  ok(!isShown(win, "PanelUI-button"), "The app menu button is hidden");
  ok(
    win.document.getElementById("zen-little-window-container-icon").hidden,
    "No container means no container icon"
  );
  is(
    win.document.getElementById("zen-little-window-container-label").value,
    "Default",
    "And the name spaces give that"
  );

  is(
    win.gURLBar.zenUrlbarBehavior,
    "float",
    "The URL bar always opens floating, however it is opened"
  );
  await TestUtils.waitForCondition(
    () => win.gURLBar.value == "example.com",
    "The URL bar shows only the domain"
  );
  is(
    win.getComputedStyle(win.gURLBar.inputField).cursor,
    "default",
    "The closed URL bar does not take the text cursor"
  );

  Assert.notEqual(
    BrowserWindowTracker.getTopWindow(),
    win,
    "A little window is never the window links open in"
  );

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_intro() {
  const PREF = "zen.little-window.intro-dismissed";
  Services.prefs.clearUserPref(PREF);
  registerCleanupFunction(() => Services.prefs.clearUserPref(PREF));

  let win = await openLittleWindow({ url: TEST_URL });
  const intro = win.document.getElementById("zen-little-window-intro");
  Assert.greater(
    intro?.getBoundingClientRect().width,
    0,
    "A new window says what it is"
  );
  win.document.getElementById("zen-little-window-intro-close").doCommand();
  ok(
    !win.document.getElementById("zen-little-window-intro"),
    "Closing the message removes it"
  );
  await BrowserTestUtils.closeWindow(win);

  win = await openLittleWindow({ url: TEST_URL });
  ok(
    !win.document.getElementById("zen-little-window-intro"),
    "And it does not come back in the next window"
  );
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_disabled() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.little-window.enabled", false]],
  });
  ok(!ZenLittleWindow.enabled, "Little windows follow the preference");
  is(
    ZenLittleWindow.open({ openerWindow: window }),
    null,
    "None opens while they are disabled"
  );
  await SpecialPowers.popPrefEnv();
});
