/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { UrlbarTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/UrlbarTestUtils.sys.mjs"
);

function isDisplayed(win, id) {
  return win.document.getElementById(id).getBoundingClientRect().width > 0;
}

add_task(async function test_little_window_back_button() {
  const win = await openLittleWindowWithPage();
  const browser = win.gBrowser.selectedBrowser;
  ok(
    !isDisplayed(win, "zen-little-window-back"),
    "There is no back button with nothing to go back to"
  );

  BrowserTestUtils.startLoadingURIString(browser, OTHER_URL);
  await TestUtils.waitForCondition(
    () => isDisplayed(win, "zen-little-window-back"),
    "The back button shows once there is a page to go back to"
  );

  win.document.getElementById("zen-little-window-back").doCommand();
  await TestUtils.waitForCondition(
    () => browser.currentURI.spec == TEST_URL,
    "The button goes back"
  );
  await TestUtils.waitForCondition(
    () => !isDisplayed(win, "zen-little-window-back"),
    "And goes away again after going back"
  );

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_urlbar_close_button() {
  let win = await openLittleWindowWithPage();
  ok(
    !isDisplayed(win, "zen-little-window-urlbar-close"),
    "A closed URL bar has no close button"
  );
  win.gURLBar.search("example");
  await UrlbarTestUtils.promiseSearchComplete(win);
  await TestUtils.waitForCondition(
    () => isDisplayed(win, "zen-little-window-urlbar-close"),
    "An open one does"
  );
  EventUtils.synthesizeMouseAtCenter(
    win.document.getElementById("zen-little-window-urlbar-close"),
    {},
    win
  );
  await TestUtils.waitForCondition(
    () => !win.gURLBar.view.isOpen,
    "Which closes the URL bar"
  );
  ok(!win.closed, "And leaves a window that shows a page open");
  await BrowserTestUtils.closeWindow(win);

  win = await openLittleWindow();
  ok(
    isDisplayed(win, "zen-little-window-urlbar-close"),
    "A window that is only its URL bar always has it"
  );
  const closed = BrowserTestUtils.windowClosed(win);
  EventUtils.synthesizeMouseAtCenter(
    win.document.getElementById("zen-little-window-urlbar-close"),
    {},
    win
  );
  await closed;
  ok(true, "There it closes the window");
});
