/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { _LastSession, _lastClosedActions } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionStore.sys.mjs"
);

async function testLastClosedActionsEntries() {
  SessionStore.resetLastClosedActions();

  let win2 = await BrowserTestUtils.openNewBrowserWindow();
  BrowserTestUtils.startLoadingURIString(
    win2.gBrowser.selectedBrowser,
    "https://www.mozilla.org/"
  );

  await BrowserTestUtils.browserLoaded(win2.gBrowser.selectedBrowser);
  await openAndCloseTab(win2, "https://example.org/");

  Assert.equal(
    SessionStore.lastClosedActions.length,
    1,
    `1 closed action has been recorded`
  );

  await BrowserTestUtils.closeWindow(win2);

  Assert.equal(
    SessionStore.lastClosedActions.length,
    2,
    `2 closed actions have been recorded`
  );
}

add_setup(() => {
  forgetClosedTabs(window);
  registerCleanupFunction(() => {
    forgetClosedTabs(window);
  });

  // needed for verify tests so that forgetting tabs isn't recorded
  SessionStore.resetLastClosedActions();
});

/**
 * Tests that if the user invokes restoreLastClosedTabOrWindowOrSession it will
 * result in either the last session will be restored, if possible, the last
 * tab (or multiple selected tabs) that was closed is reopened, or the last
 * window that is closed is reopened.
 */
add_task(async function test_undo_last_action() {
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
        ],
        selected: 3,
      },
    ],
  };

  _LastSession.setState(state);

  let sessionRestored = promiseSessionStoreLoads(3 /* total restored tabs */);
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  await sessionRestored;
  Assert.equal(
    window.gBrowser.tabs.length,
    3,
    "Window has three tabs after session is restored"
  );

  // open and close a window, then reopen it
  let win2 = await BrowserTestUtils.openNewBrowserWindow();
  Assert.equal(win2.gBrowser.tabs.length, 1, "Second window has one open tab");
  BrowserTestUtils.startLoadingURIString(
    win2.gBrowser.selectedBrowser,
    "https://example.com/"
  );
  await BrowserTestUtils.browserLoaded(win2.gBrowser.selectedBrowser);
  await BrowserTestUtils.closeWindow(win2);
  let restoredWinPromise = BrowserTestUtils.waitForNewWindow({
    url: "https://example.com/",
  });
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  let restoredWin = await restoredWinPromise;
  Assert.equal(
    restoredWin.gBrowser.tabs.length,
    1,
    "First tab in the second window has been reopened"
  );
  await BrowserTestUtils.closeWindow(restoredWin);
  SessionStore.forgetClosedWindow(restoredWin.index);
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);

  // close one tab and reopen it
  BrowserTestUtils.removeTab(window.gBrowser.tabs[2]);
  Assert.equal(window.gBrowser.tabs.length, 2, "Window has two open tabs");
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  Assert.equal(
    window.gBrowser.tabs.length,
    3,
    "Window now has three open tabs"
  );

  // select 2 tabs and close both via the 'close 2 tabs' context menu option
  let tab2 = window.gBrowser.tabs[1];
  let tab3 = window.gBrowser.tabs[2];
  await triggerClickOn(tab2, { ctrlKey: true });
  Assert.equal(tab2.multiselected, true);
  Assert.equal(tab3.multiselected, true);

  let menu = await openTabMenuFor(tab3);
  let menuItemCloseTab = document.getElementById("context_closeTab");
  let tab2Closing = BrowserTestUtils.waitForTabClosing(tab2);
  let tab3Closing = BrowserTestUtils.waitForTabClosing(tab3);
  menu.activateItem(menuItemCloseTab);
  await tab2Closing;
  await tab3Closing;
  Assert.equal(window.gBrowser.tabs[0].selected, true);
  await TestUtils.waitForCondition(() => window.gBrowser.tabs.length == 1);
  Assert.equal(
    window.gBrowser.tabs.length,
    1,
    "Window now has one open tab after closing two multi-selected tabs"
  );

  // ensure both tabs are reopened with a single click
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  Assert.equal(
    window.gBrowser.tabs.length,
    3,
    "Window now has three open tabs after reopening closed tabs"
  );

  // close one tab and forget it - it should not be reopened
  BrowserTestUtils.removeTab(window.gBrowser.tabs[2]);
  Assert.equal(window.gBrowser.tabs.length, 2, "Window has two open tabs");
  SessionStore.forgetClosedTab(window, 0);
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  Assert.equal(
    window.gBrowser.tabs.length,
    2,
    "Window still has two open tabs"
  );

  // create a tab group, delete it, and re-open it
  const groupedTab = BrowserTestUtils.addTab(
    window.gBrowser,
    "https://example.com"
  );
  await BrowserTestUtils.browserLoaded(groupedTab.linkedBrowser);
  const tabGroup = window.gBrowser.addTabGroup([groupedTab]);
  Assert.equal(
    window.gBrowser.tabs.length,
    3,
    "Window has three tabs after creating tab group"
  );

  await TabStateFlusher.flushWindow(window);
  let removePromise = BrowserTestUtils.waitForEvent(
    tabGroup,
    "TabGroupRemoved"
  );
  window.gBrowser.removeTabGroup(tabGroup);
  await removePromise;

  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  Assert.equal(
    window.gBrowser.tabs.length,
    3,
    "Window has three tabs after restoring tab group"
  );
  Assert.equal(
    window.gBrowser.tabGroups.length,
    1,
    "Tab group exists on the tab strip after restore"
  );

  // Save and close the tab group, and then re-open it
  const groupedTabToSave = BrowserTestUtils.addTab(
    window.gBrowser,
    "https://example.com"
  );
  await BrowserTestUtils.browserLoaded(groupedTabToSave.linkedBrowser);
  const tabGroupToSave = window.gBrowser.addTabGroup([groupedTabToSave]);
  Assert.equal(
    window.gBrowser.tabs.length,
    4,
    "Window has four tabs after creating tab group"
  );

  await TabStateFlusher.flushWindow(window);
  tabGroupToSave.save();
  removePromise = BrowserTestUtils.waitForEvent(
    tabGroupToSave,
    "TabGroupRemoved"
  );
  window.gBrowser.removeTabGroup(tabGroupToSave);
  await removePromise;

  await TabStateFlusher.flushWindow(window);
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  Assert.equal(
    window.gBrowser.tabs.length,
    4,
    "Window has four tabs after restoring tab group"
  );
  Assert.equal(
    window.gBrowser.tabGroups.length,
    2,
    "Tab group exists on the tab strip after restore"
  );

  gBrowser.removeAllTabsBut(gBrowser.tabs[0], { animate: false });
});

add_task(async function test_forget_closed_window() {
  await testLastClosedActionsEntries();
  SessionStore.forgetClosedWindow();

  // both the forgotten window and its closed tab has been removed from the list
  Assert.ok(
    !SessionStore.lastClosedActions.length,
    `0 closed actions have been recorded`
  );
});

add_task(async function test_user_clears_history() {
  await testLastClosedActionsEntries();
  Services.obs.notifyObservers(null, "browser:purge-session-history");

  // both the forgotten window and its closed tab has been removed from the list
  Assert.ok(
    !SessionStore.lastClosedActions.length,
    `0 closed actions have been recorded`
  );
});

/**
 * It the browser has restarted and the closed actions list is empty, we
 * should fallback to re-opening the last closed tab if one exists.
 */
add_task(async function test_reopen_last_tab_if_no_closed_actions() {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:blank",
    },
    async () => {
      const TEST_URL = "https://example.com/";
      let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_URL);
      let update = BrowserTestUtils.waitForSessionStoreUpdate(tab);
      BrowserTestUtils.removeTab(tab);
      await update;

      SessionStore.resetLastClosedActions();

      let promiseTab = BrowserTestUtils.waitForNewTab(gBrowser, TEST_URL);
      SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
      let newTab = await promiseTab;
      Assert.equal(newTab.linkedBrowser.currentURI.spec, TEST_URL);
    }
  );
});

/**
 * It the browser has restarted and the closed actions list is empty, and
 * no closed tabs exist for the window, we should fallback to re-opening
 * the last session if one exists.
 */
add_task(async function test_reopen_last_session_if_no_closed_actions() {
  gBrowser.removeAllTabsBut(gBrowser.tabs[0], { animate: false });
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
        ],
        selected: 3,
      },
    ],
  };

  _LastSession.setState(state);
  SessionStore.resetLastClosedActions();

  let sessionRestored = promiseSessionStoreLoads(3 /* total restored tabs */);
  SessionWindowUI.restoreLastClosedTabOrWindowOrSession(window);
  await sessionRestored;
  Assert.equal(gBrowser.tabs.length, 4, "Got the expected number of tabs");
  gBrowser.removeAllTabsBut(gBrowser.tabs[0], { animate: false });
});
