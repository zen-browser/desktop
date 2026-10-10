/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * It's possible for us to restore windows without tabs,
 * when on Windows/Linux the user closes the last tab as
 * a means of closing the last window. That last tab
 * would appear as a closed tab in session state for the
 * window, with no open tabs (so the state would be resumed
 * as showing the homepage). See bug 490136 for context.
 * This test checks that in this case, the resulting window
 * is functional and indeed has the required previously
 * closed tabs available.
 */
add_task(async function test_restoring_tabless_window() {
  let newWin = await BrowserTestUtils.openNewBrowserWindow();
  let newState = {
    windows: [
      {
        tabs: [],
        _closedTabs: [
          {
            state: { entries: [{ url: "about:" }] },
            title: "About:",
          },
        ],
      },
    ],
  };

  await setWindowState(newWin, newState, true);
  let tab = await BrowserTestUtils.openNewForegroundTab(
    newWin.gBrowser,
    "https://example.com"
  );
  await TabStateFlusher.flush(tab.linkedBrowser);
  let receivedState = SessionStore.getWindowState(newWin);
  let { tabs, selected } = receivedState.windows[0];
  is(tabs.length, 2, "Should have two tabs");
  is(selected, 2, "Should have selected the new tab");
  ok(
    tabs[1]?.entries.some(e => e.url == "https://example.com/"),
    "Should have found the new URL"
  );

  let closedTabData = SessionStore.getClosedTabDataForWindow(newWin);
  is(closedTabData.length, 1, "Should have found 1 closed tab");
  is(
    closedTabData[0]?.state.entries[0].url,
    "about:",
    "Should have found the right URL for the closed tab"
  );
  await BrowserTestUtils.closeWindow(newWin);
});
