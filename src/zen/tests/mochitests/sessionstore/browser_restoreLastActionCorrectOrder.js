"use strict";

const { _LastSession, _lastClosedActions } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionStore.sys.mjs"
);

/**
 * Tests that the _lastClosedAction list is truncated correctly
 * by removing oldest actions in SessionStore._addClosedAction
 */
add_task(async function test_undo_last_action_correct_order() {
  SpecialPowers.pushPrefEnv({
    set: [
      ["browser.sessionstore.max_tabs_undo", 3],
      ["browser.sessionstore.max_windows_undo", 1],
    ],
  });

  gBrowser.removeAllTabsBut(gBrowser.tabs[0]);
  await TabStateFlusher.flushWindow(window);

  forgetClosedTabs(window);

  const state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              {
                title: "example.org",
                url: "https://example.org/",
                triggeringPrincipal_base64,
              },
            ],
          },
          {
            entries: [
              {
                title: "example.com",
                url: "https://example.com/",
                triggeringPrincipal_base64,
              },
            ],
          },
          {
            entries: [
              {
                title: "mozilla",
                url: "https://www.mozilla.org/",
                triggeringPrincipal_base64,
              },
            ],
          },
          {
            entries: [
              {
                title: "mozilla privacy policy",
                url: "https://www.mozilla.org/privacy",
                triggeringPrincipal_base64,
              },
            ],
          },
        ],
        selected: 3,
      },
    ],
  };

  _LastSession.setState(state);
  SessionStore.resetLastClosedActions();

  let sessionRestored = promiseSessionStoreLoads(4 /* total restored tabs */);
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  await sessionRestored;

  Assert.equal(window.gBrowser.tabs.length, 4, "4 tabs have been restored");

  BrowserTestUtils.removeTab(window.gBrowser.tabs[3]);
  BrowserTestUtils.removeTab(window.gBrowser.tabs[2]);
  Assert.equal(window.gBrowser.tabs.length, 2, "Window has one open tab");

  // open and close a window
  let win2 = await BrowserTestUtils.openNewBrowserWindow();
  Assert.equal(win2.gBrowser.tabs.length, 1, "Second window has one open tab");
  BrowserTestUtils.startLoadingURIString(
    win2.gBrowser.selectedBrowser,
    "https://example.com/"
  );
  await BrowserTestUtils.browserLoaded(win2.gBrowser.selectedBrowser);
  await BrowserTestUtils.closeWindow(win2);

  // close one tab and reopen it
  BrowserTestUtils.removeTab(window.gBrowser.tabs[1]);
  Assert.equal(window.gBrowser.tabs.length, 1, "Window has one open tabs");
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  Assert.equal(window.gBrowser.tabs.length, 2, "Window now has two open tabs");

  await SpecialPowers.popPrefEnv();
  gBrowser.removeAllTabsBut(gBrowser.tabs[0]);
});
