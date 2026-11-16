/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { UrlbarTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/UrlbarTestUtils.sys.mjs"
);

add_task(async function test_little_window_urlbar_only() {
  const win = await openLittleWindow();
  const root = win.document.documentElement;

  await UrlbarTestUtils.promiseSearchComplete(win);

  ok(win.gZenLittleWindow.isUrlbarOnly, "An empty window is only a URL bar");
  win.gURLBar.search("example");
  await UrlbarTestUtils.promiseSearchComplete(win);
  ok(win.gURLBar.view.isOpen, "The URL bar is open with its suggestions");
  ok(root.hasAttribute("zen-little-window-urlbar-only"), "And is marked so");
  ok(isShown(win, "urlbar-container"), "The URL bar is shown");
  const urlbar = win.document.getElementById("urlbar");
  await TestUtils.waitForCondition(() => {
    const rect = urlbar.getBoundingClientRect();
    return (
      rect.x == 0 &&
      rect.y == 0 &&
      rect.width == win.innerWidth &&
      Math.ceil(rect.height) == win.innerHeight
    );
  }, "The window is exactly as big as the URL bar");
  const background = urlbar
    .querySelector(".urlbar-background")
    .getBoundingClientRect();
  is(background.width, win.innerWidth, "The URL bar is filled edge to edge");

  is(
    win.gURLBar.inputField.dataset.l10nId,
    "urlbar-placeholder",
    "The placeholder is already the one it ends up with"
  );

  const { availLeft, availWidth } = win.screen;
  is(
    win.screenX,
    Math.round(availLeft + (availWidth - win.outerWidth) / 2),
    "The window is in the middle of the screen"
  );

  const { innerWidth, innerHeight } = win;
  win.resizeTo(innerWidth + 200, innerHeight + 200);
  await new Promise(resolve => win.requestAnimationFrame(resolve));
  is(win.innerWidth, innerWidth, "The window cannot be made wider");
  is(win.innerHeight, innerHeight, "The window cannot be made taller");

  const browser = win.gBrowser.selectedBrowser;
  const loaded = BrowserTestUtils.browserLoaded(browser, false, TEST_URL);
  win.gURLBar.search(TEST_URL);
  await UrlbarTestUtils.promiseSearchComplete(win);
  EventUtils.synthesizeKey("KEY_Enter", {}, win);
  await loaded;

  ok(!win.closed, "Loading a page from the URL bar keeps the window");
  ok(!win.gZenLittleWindow.isUrlbarOnly, "And ends its being only a URL bar");
  ok(!root.hasAttribute("zen-little-window-urlbar-only"), "For the chrome too");
  const { width, height } = ZenLittleWindow.windowSize;
  await TestUtils.waitForCondition(
    () => win.outerWidth == width && win.outerHeight == height,
    "The window grew to the regular size"
  );
  ok(isShown(win, "zen-little-window-open-button"), "Open in space is back");

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_closes_with_its_urlbar() {
  const win = await openLittleWindow();
  win.gURLBar.search("example");
  await UrlbarTestUtils.promiseSearchComplete(win);
  ok(win.gURLBar.view.isOpen, "The URL bar is open");

  const closed = BrowserTestUtils.windowClosed(win);
  EventUtils.synthesizeKey("KEY_Escape", {}, win);
  await closed;
  ok(true, "Closing the URL bar closed the window");
});

add_task(async function test_little_window_closes_when_its_urlbar_is_left() {
  const win = await openLittleWindow();
  await TestUtils.waitForCondition(
    () =>
      win.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow).visibility &&
      win.gURLBar.focused,
    "The window is shown with its URL bar focused"
  );

  const closed = BrowserTestUtils.windowClosed(win);
  win.gURLBar.inputField.blur();
  await closed;
  ok(true, "Leaving the URL bar closed the window");
});
