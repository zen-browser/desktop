/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

add_setup(async function () {
  /** Test for Bug 625016 - Restore windows closed in succession to quit (non-OSX only) */

  // We'll test this by opening a new window, waiting for the save
  // event, then closing that window. We'll observe the
  // "sessionstore-state-write-complete" notification and check that
  // the state contains no _closedWindows. We'll then add a new tab
  // and make sure that the state following that was reset and the
  // closed window is now in _closedWindows.

  requestLongerTimeout(2);

  await forceSaveState();

  // We'll clear all closed windows to make sure our state is clean
  // forgetClosedWindow doesn't trigger a delayed save
  forgetClosedWindows();
  is(ss.getClosedWindowCount(), 0, "starting with no closed windows");
});

add_task(async function new_window() {
  let newWin;
  try {
    newWin = await promiseNewWindowLoaded();
    let tab = BrowserTestUtils.addTab(
      newWin.gBrowser,
      "http://example.com/browser_625016.js?" + Math.random()
    );
    await promiseBrowserLoaded(tab.linkedBrowser);

    // Double check that we have no closed windows
    is(ss.getClosedWindowCount(), 0, "no closed windows on first save");

    await BrowserTestUtils.closeWindow(newWin);
    newWin = null;

    let state = JSON.parse(await promiseRecoveryFileContents());
    is(state.windows.length, 1, "observe1: 1 window in data written to disk");
    is(
      state._closedWindows.length,
      0,
      "observe1: no closed windows in data written to disk"
    );

    // The API still treats the closed window as closed, so ensure that window is there
    is(
      ss.getClosedWindowCount(),
      1,
      "observe1: 1 closed window according to API"
    );
  } finally {
    if (newWin) {
      await BrowserTestUtils.closeWindow(newWin);
    }
    await forceSaveState();
  }
});

// We'll open a tab, which should trigger another state save which would wipe
// the _shouldRestore attribute from the closed window
add_task(async function new_tab() {
  let newTab;
  try {
    newTab = BrowserTestUtils.addTab(gBrowser, "about:mozilla");
    await promiseBrowserLoaded(newTab.linkedBrowser);
    await TabStateFlusher.flush(newTab.linkedBrowser);

    let state = JSON.parse(await promiseRecoveryFileContents());
    is(
      state.windows.length,
      1,
      "observe2: 1 window in data being written to disk"
    );
    is(
      state._closedWindows.length,
      1,
      "observe2: 1 closed window in data being written to disk"
    );

    // The API still treats the closed window as closed, so ensure that window is there
    is(
      ss.getClosedWindowCount(),
      1,
      "observe2: 1 closed window according to API"
    );
  } finally {
    if (newTab) {
      gBrowser.removeTab(newTab);
    }
  }
});

add_task(async function done() {
  // The API still represents the closed window as closed, so we can clear it
  // with the API, but just to make sure...
  //  is(ss.getClosedWindowCount(), 1, "1 closed window according to API");
  await promiseAllButPrimaryWindowClosed();
  forgetClosedWindows();
  Services.prefs.clearUserPref("browser.sessionstore.interval");
});
