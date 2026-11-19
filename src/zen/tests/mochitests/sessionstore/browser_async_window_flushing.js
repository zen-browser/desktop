"use strict";

const PAGE = "http://example.com/";

/**
 * Tests that if we initially discard a window as not interesting
 * to save in the closed windows array, that we revisit that decision
 * after a window flush has completed.
 */
add_task(async function test_add_interesting_window() {
  // We want to suppress all non-final updates from the browser tabs
  // so as to eliminate any racy-ness with this test.
  await pushPrefs(["browser.sessionstore.debug.no_auto_updates", true]);

  // Depending on previous tests, we might already have some closed
  // windows stored. We'll use its length to determine whether or not
  // the window was added or not.
  let initialClosedWindows = ss.getClosedWindowCount();

  // Make sure we can actually store another closed window
  await pushPrefs([
    "browser.sessionstore.max_windows_undo",
    initialClosedWindows + 1,
  ]);

  // Create a new browser window. Since the default window will start
  // at about:blank, SessionStore should find this tab (and therefore the
  // whole window) uninteresting, and should not initially put it into
  // the closed windows array.
  let newWin = await BrowserTestUtils.openNewBrowserWindow();

  let browser = newWin.gBrowser.selectedBrowser;

  // Send a message that will cause the content to change its location
  // to someplace more interesting. We've disabled auto updates from
  // the browser, so the parent won't know about this
  await SpecialPowers.spawn(browser, [PAGE], async function (newPage) {
    content.location = newPage;
  });

  await promiseOnHistoryReplaceEntry(browser);

  // Clear out the userTypedValue so that the new window looks like
  // it's really not worth restoring.
  browser.userTypedValue = null;

  // Once this windowClosed Promise resolves, we should have finished
  // the flush and revisited our decision to put this window into
  // the closed windows array.
  let windowClosed = BrowserTestUtils.windowClosed(newWin);

  let handled = false;
  whenDomWindowClosedHandled(() => {
    // SessionStore's onClose handler should have just run.
    let currentClosedWindows = ss.getClosedWindowCount();
    is(
      currentClosedWindows,
      initialClosedWindows,
      "We should not have added the window to the closed windows array"
    );

    handled = true;
  });

  // Ok, let's close the window.
  newWin.close();

  await windowClosed;

  ok(handled, "domwindowclosed should already be handled here");

  // The window flush has finished
  let currentClosedWindows = ss.getClosedWindowCount();
  is(
    currentClosedWindows,
    initialClosedWindows + 1,
    "We should have added the window to the closed windows array"
  );
});

/**
 * Tests that if we initially store a closed window as interesting
 * to save in the closed windows array, that we revisit that decision
 * after a window flush has completed, and stop storing a window that
 * we've deemed no longer interesting.
 */
add_task(async function test_remove_uninteresting_window() {
  // We want to suppress all non-final updates from the browser tabs
  // so as to eliminate any racy-ness with this test.
  await pushPrefs(["browser.sessionstore.debug.no_auto_updates", true]);

  // Depending on previous tests, we might already have some closed
  // windows stored. We'll use its length to determine whether or not
  // the window was added or not.
  let initialClosedWindows = ss.getClosedWindowCount();

  // Make sure we can actually store another closed window
  await pushPrefs([
    "browser.sessionstore.max_windows_undo",
    initialClosedWindows + 1,
  ]);

  let newWin = await BrowserTestUtils.openNewBrowserWindow();

  // Now browse the initial tab of that window to an interesting
  // site.
  let tab = newWin.gBrowser.selectedTab;
  let browser = tab.linkedBrowser;
  BrowserTestUtils.startLoadingURIString(browser, PAGE);

  await BrowserTestUtils.browserLoaded(browser, false, PAGE);
  await TabStateFlusher.flush(browser);

  // Send a message that will cause the content to purge its
  // history entries and make itself seem uninteresting.
  await SpecialPowers.spawn(browser, [], async function () {
    // Epic hackery to make this browser seem suddenly boring.
    docShell.setCurrentURIForSessionStore(Services.io.newURI("about:blank"));
  });

  let { sessionHistory } = browser.browsingContext;
  sessionHistory.purgeHistory(sessionHistory.count);

  // Once this windowClosed Promise resolves, we should have finished
  // the flush and revisited our decision to put this window into
  // the closed windows array.
  let windowClosed = BrowserTestUtils.windowClosed(newWin);

  let handled = false;
  whenDomWindowClosedHandled(() => {
    // SessionStore's onClose handler should have just run.
    let currentClosedWindows = ss.getClosedWindowCount();
    is(
      currentClosedWindows,
      initialClosedWindows + 1,
      "We should have added the window to the closed windows array"
    );

    handled = true;
  });

  // Ok, let's close the window.
  newWin.close();

  await windowClosed;

  ok(handled, "domwindowclosed should already be handled here");

  // The window flush has finished
  let currentClosedWindows = ss.getClosedWindowCount();
  is(
    currentClosedWindows,
    initialClosedWindows,
    "We should have removed the window from the closed windows array"
  );
});

/**
 * Tests that when we close a window, it is immediately removed from the
 * _windows array.
 */
add_task(async function test_synchronously_remove_window_state() {
  // Depending on previous tests, we might already have some closed
  // windows stored. We'll use its length to determine whether or not
  // the window was added or not.
  let state = JSON.parse(ss.getBrowserState());
  ok(state, "Make sure we can get the state");
  let initialWindows = state.windows.length;

  // Open a new window and send the first tab somewhere
  // interesting.
  let newWin = await BrowserTestUtils.openNewBrowserWindow();
  let browser = newWin.gBrowser.selectedBrowser;
  BrowserTestUtils.startLoadingURIString(browser, PAGE);
  await BrowserTestUtils.browserLoaded(browser, false, PAGE);
  await TabStateFlusher.flush(browser);

  state = JSON.parse(ss.getBrowserState());
  is(
    state.windows.length,
    initialWindows + 1,
    "The new window to be in the state"
  );

  // Now close the window, and make sure that the window was removed
  // from the windows list from the SessionState. We're specifically
  // testing the case where the window is _not_ removed in between
  // the close-initiated flush request and the flush response.
  let windowClosed = BrowserTestUtils.windowClosed(newWin);
  newWin.close();

  state = JSON.parse(ss.getBrowserState());
  is(
    state.windows.length,
    initialWindows,
    "The new window should have been removed from the state"
  );

  // Wait for our window to go away
  await windowClosed;
});
