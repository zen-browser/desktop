"use strict";

requestLongerTimeout(4);

/**
 * Test that when restoring an 'initial page' with session restore, it
 * produces an empty URL bar, rather than leaving its URL explicitly
 * there as a 'user typed value'.
 */
add_task(async function () {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    "https://example.com/"
  );
  let tabOpenedAndSwitchedTo = BrowserTestUtils.switchTab(
    win.gBrowser,
    () => {}
  );

  // This opens about:newtab:
  win.BrowserCommands.openTab();
  let tab = await tabOpenedAndSwitchedTo;
  is(win.gURLBar.value, "", "URL bar should be empty");
  is(tab.linkedBrowser.userTypedValue, null, "userTypedValue should be null");
  let state = JSON.parse(SessionStore.getTabState(tab));
  ok(
    !state.userTypedValue,
    "userTypedValue should be undefined on the tab's state"
  );
  tab = null;

  await BrowserTestUtils.closeWindow(win);

  ok(SessionStore.getClosedWindowCount(), "Should have a closed window");

  await forceSaveState();

  win = SessionStore.undoCloseWindow(0);
  await TestUtils.topicObserved(
    "sessionstore-single-window-restored",
    subject => subject == win
  );
  // Don't wait for load here because it's about:newtab and we may have swapped in
  // a preloaded browser.
  await TabStateFlusher.flush(win.gBrowser.selectedBrowser);

  is(win.gURLBar.value, "", "URL bar should be empty");
  tab = win.gBrowser.selectedTab;
  is(tab.linkedBrowser.userTypedValue, null, "userTypedValue should be null");
  state = JSON.parse(SessionStore.getTabState(tab));
  ok(
    !state.userTypedValue,
    "userTypedValue should be undefined on the tab's state"
  );

  BrowserTestUtils.removeTab(tab);

  for (let url of gInitialPages) {
    if (url == BROWSER_NEW_TAB_URL || url === "about:opentabs") {
      continue; // We tested about:newtab using BrowserCommands.openTab() above.
    }
    info("Testing " + url + " - " + new Date());
    await BrowserTestUtils.openNewForegroundTab(win.gBrowser, url);
    await BrowserTestUtils.closeWindow(win);

    ok(SessionStore.getClosedWindowCount(), "Should have a closed window");

    await forceSaveState();

    win = SessionStore.undoCloseWindow(0);
    await TestUtils.topicObserved(
      "sessionstore-single-window-restored",
      subject => subject == win
    );
    await BrowserTestUtils.browserLoaded(win.gBrowser.selectedBrowser, {
      wantLoad: url,
    });
    await TabStateFlusher.flush(win.gBrowser.selectedBrowser);

    is(win.gURLBar.value, "", "URL bar should be empty");
    tab = win.gBrowser.selectedTab;
    is(tab.linkedBrowser.userTypedValue, null, "userTypedValue should be null");
    state = JSON.parse(SessionStore.getTabState(tab));
    ok(
      !state.userTypedValue,
      "userTypedValue should be undefined on the tab's state"
    );

    info("Removing tab - " + new Date());
    BrowserTestUtils.removeTab(tab);
    info("Finished removing tab - " + new Date());
  }
  info("Removing window - " + new Date());
  await BrowserTestUtils.closeWindow(win);
  info("Finished removing window - " + new Date());
});
