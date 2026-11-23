/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PromptTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromptTestUtils.sys.mjs"
);

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

/**
 * Closing all tabs of a window tries to close the window. If a beforeunload
 * prompt cancels the close, the window must not be marked to drop its tabs at
 * the next restore.
 */
add_task(async function test_cancelled_close_of_all_tabs() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.tabs.closeWindowWithLastTab", true],
      ["dom.require_user_interaction_for_beforeunload", false],
    ],
  });

  let newWin = await BrowserTestUtils.openNewBrowserWindow();
  BrowserTestUtils.startLoadingURIString(
    newWin.gBrowser.selectedBrowser,
    "https://example.com/"
  );
  await BrowserTestUtils.browserLoaded(newWin.gBrowser.selectedBrowser);
  let tab = await BrowserTestUtils.openNewForegroundTab(
    newWin.gBrowser,
    "https://example.org/"
  );
  await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    content.addEventListener("beforeunload", event => event.preventDefault());
  });

  let promptHandled = PromptTestUtils.handleNextPrompt(
    tab.linkedBrowser,
    { modalType: Services.prompt.MODAL_TYPE_CONTENT, promptType: "confirmEx" },
    { buttonNumClick: 1 }
  );
  newWin.gBrowser.selectAllTabs();
  newWin.gBrowser.removeMultiSelectedTabs();
  await promptHandled;

  ok(!newWin.closed, "The window should stay open");
  is(newWin.gBrowser.tabs.length, 2, "The window should keep its tabs");
  ok(
    !SessionStore.getWindowState(newWin).windows[0]._maybeDontRestoreTabs,
    "The window should not be marked to drop its tabs at restore"
  );

  let leavePromptHandled = PromptTestUtils.handleNextPrompt(
    tab.linkedBrowser,
    { modalType: Services.prompt.MODAL_TYPE_CONTENT, promptType: "confirmEx" },
    { buttonNumClick: 0 }
  );
  await BrowserTestUtils.closeWindow(newWin);
  await leavePromptHandled;
});
