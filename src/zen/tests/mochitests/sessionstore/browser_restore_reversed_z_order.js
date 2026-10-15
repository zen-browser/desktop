"use strict";

const PRIMARY_WINDOW = window;

let gTestURLsMap = new Map([
  ["about:about", null],
  ["about:license", null],
  ["about:robots", null],
  ["about:mozilla", null],
]);
let gBrowserState;

add_setup(async function () {
  let windows = [];
  let count = 0;
  for (let url of gTestURLsMap.keys()) {
    let window = !count
      ? PRIMARY_WINDOW
      : await BrowserTestUtils.openNewBrowserWindow();
    let browserLoaded = BrowserTestUtils.browserLoaded(
      window.gBrowser.selectedBrowser
    );
    BrowserTestUtils.startLoadingURIString(
      window.gBrowser.selectedBrowser,
      url
    );
    await browserLoaded;
    // Capture the title.
    gTestURLsMap.set(url, window.gBrowser.selectedTab.label);
    // Minimize the before-last window, to have a different window feature added
    // to the test.
    if (count == gTestURLsMap.size - 1) {
      let activated = BrowserTestUtils.waitForEvent(
        windows[count - 1],
        "activate"
      );
      window.minimize();
      await activated;
    }
    windows.push(window);
    ++count;
  }

  // Wait until we get the lastest history from all windows.
  await Promise.all(windows.map(window => TabStateFlusher.flushWindow(window)));

  gBrowserState = ss.getBrowserState();

  await promiseAllButPrimaryWindowClosed();
});

add_task(async function test_z_indices_are_saved_correctly() {
  let state = JSON.parse(gBrowserState);
  Assert.equal(
    state.windows.length,
    gTestURLsMap.size,
    "Correct number of windows saved"
  );

  // Check if we saved state in correct order of creation.
  let idx = 0;
  for (let url of gTestURLsMap.keys()) {
    Assert.equal(
      state.windows[idx].tabs[0].entries[0].url,
      url,
      `Window #${idx} is stored in correct creation order`
    );
    ++idx;
  }

  // Check if we saved a valid zIndex (no null, no undefined or no 0).
  for (let window of state.windows) {
    Assert.ok(window.zIndex, "A valid zIndex is stored");
  }

  Assert.equal(
    state.windows[0].zIndex,
    3,
    "Window #1 should have the correct z-index"
  );
  Assert.equal(
    state.windows[1].zIndex,
    2,
    "Window #2 should have correct z-index"
  );
  Assert.equal(
    state.windows[2].zIndex,
    1,
    "Window #3 should be the topmost window"
  );
  Assert.equal(
    state.windows[3].zIndex,
    4,
    "Minimized window should be the last window to restore"
  );
});

add_task(async function test_windows_are_restored_in_reversed_z_order() {
  await promiseBrowserState(gBrowserState);

  let indexedTabLabels = [...gTestURLsMap.values()];
  let tabsRestoredLabels = BrowserWindowTracker.orderedWindows.map(
    window => window.gBrowser.selectedTab.label
  );

  Assert.equal(
    tabsRestoredLabels[0],
    indexedTabLabels[2],
    "First restored tab should be last used tab"
  );
  Assert.equal(
    tabsRestoredLabels[1],
    indexedTabLabels[1],
    "Second restored tab is correct"
  );
  Assert.equal(
    tabsRestoredLabels[2],
    indexedTabLabels[0],
    "Third restored tab is correct"
  );
  Assert.equal(
    tabsRestoredLabels[3],
    indexedTabLabels[3],
    "Last restored tab should be a minimized window"
  );

  await promiseAllButPrimaryWindowClosed();
});
