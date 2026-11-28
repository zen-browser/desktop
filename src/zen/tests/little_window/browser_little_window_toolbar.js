/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { UrlbarTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/UrlbarTestUtils.sys.mjs"
);

function isDisplayed(win, id) {
  return win.document.getElementById(id).getBoundingClientRect().width > 0;
}

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

add_task(
  async function test_little_window_controls_are_named_and_keyboard_usable() {
    const win = await openLittleWindowWithPage();
    const close = win.document.getElementById("zen-little-window-urlbar-close");
    await win.document.l10n.translateElements([close]);
    ok(close.getAttribute("aria-label"), "The close button has a name");

    // The toolbar keyboard navigation is what makes these focusable.
    const pill = win.document.getElementById("zen-little-window-container");
    const popup = win.document.getElementById(
      "zen-little-window-container-popup"
    );
    pill.setAttribute("tabindex", "-1");
    pill.focus();
    const shown = BrowserTestUtils.waitForEvent(popup, "popupshown");
    EventUtils.synthesizeKey("KEY_Enter", {}, win);
    await shown;
    ok(true, "Enter on the container pill opens its menu");
    const hidden = BrowserTestUtils.waitForEvent(popup, "popuphidden");
    popup.hidePopup();
    await hidden;

    const open = win.document.getElementById("zen-little-window-open-button");
    open.setAttribute("tabindex", "-1");
    open.focus();
    const tabCount = gBrowser.tabs.length;
    const closed = BrowserTestUtils.windowClosed(win);
    EventUtils.synthesizeKey(" ", {}, win);
    await closed;
    is(
      gBrowser.tabs.length,
      tabCount + 1,
      "Space on the button moves the page"
    );

    BrowserTestUtils.removeTab(gBrowser.selectedTab);
  }
);
