/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Bug 597071 - Closed windows should only be resurrected when there is a single
 * popup window
 */
add_task(async function test_close_last_nonpopup_window() {
  // Purge the list of closed windows.
  forgetClosedWindows();

  let oldState = ss.getWindowState(window);

  let popupState = {
    windows: [{ tabs: [{ entries: [] }], isPopup: true, hidden: "toolbar" }],
  };

  // Set this window to be a popup.
  ss.setWindowState(window, JSON.stringify(popupState), true);

  // Open a new window with a tab.
  let win = await BrowserTestUtils.openNewBrowserWindow({ private: false });
  let tab = BrowserTestUtils.addTab(win.gBrowser, "http://example.com/");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  // Make sure sessionstore sees this window.
  let state = JSON.parse(ss.getBrowserState());
  is(state.windows.length, 2, "sessionstore knows about this window");

  // Closed the window and check the closed window count.
  await BrowserTestUtils.closeWindow(win);
  is(ss.getClosedWindowCount(), 1, "correct closed window count");

  // Cleanup.
  ss.setWindowState(window, oldState, true);
});
