const TEST_URLS = [
  "about:buildconfig",
  "http://mochi.test:8888/browser/browser/components/sessionstore/test/browser_speculative_connect.html",
  "",
];

/**
 * This will open tabs in browser. This will also make the last tab
 * inserted to be the selected tab.
 */
async function openTabs(win) {
  for (let i = 0; i < TEST_URLS.length; ++i) {
    await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URLS[i]);
  }
}

add_task(async function speculative_connect_restore_on_demand() {
  Services.prefs.setBoolPref("browser.sessionstore.restore_on_demand", true);
  is(
    Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand"),
    true,
    "We're restoring on demand"
  );
  forgetClosedWindows();

  // Open a new window and populate with tabs.
  let win = await promiseNewWindowLoaded();
  await openTabs(win);

  // Close the window.
  await BrowserTestUtils.closeWindow(win);

  // Reopen a window.
  let newWin = SessionWindowUI.undoCloseWindow(0);
  // Make sure we wait until this window is restored.
  await promiseWindowRestored(newWin);

  let tabs = newWin.gBrowser.tabs;
  is(tabs.length, TEST_URLS.length + 1, "Restored right number of tabs");

  let e = new MouseEvent("mouseover");

  // First tab should be ignored, since it's the default blank tab when we open a new window.

  // Trigger a mouse enter on second tab.
  tabs[1].dispatchEvent(e);
  ok(
    !tabs[1].__test_connection_prepared,
    "Second tab doesn't have a connection prepared"
  );
  is(tabs[1].__test_connection_url, TEST_URLS[0], "Second tab has correct url");
  ok(
    SessionStore.getLazyTabValue(tabs[1], "connectionPrepared"),
    "Second tab should have connectionPrepared flag after hovered"
  );

  // Trigger a mouse enter on third tab.
  tabs[2].dispatchEvent(e);
  ok(tabs[2].__test_connection_prepared, "Third tab has a connection prepared");
  is(tabs[2].__test_connection_url, TEST_URLS[1], "Third tab has correct url");
  ok(
    SessionStore.getLazyTabValue(tabs[2], "connectionPrepared"),
    "Third tab should have connectionPrepared flag after hovered"
  );

  // Last tab is the previously selected tab.
  tabs[3].dispatchEvent(e);
  is(
    SessionStore.getLazyTabValue(tabs[3], "connectionPrepared"),
    undefined,
    "Previous selected tab shouldn't have connectionPrepared flag"
  );
  is(
    tabs[3].__test_connection_prepared,
    undefined,
    "Previous selected tab should not have a connection prepared"
  );
  is(
    tabs[3].__test_connection_url,
    undefined,
    "Previous selected tab should not have a connection prepared"
  );

  await BrowserTestUtils.closeWindow(newWin);
});

add_task(async function speculative_connect_restore_automatically() {
  Services.prefs.setBoolPref("browser.sessionstore.restore_on_demand", false);
  is(
    Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand"),
    false,
    "We're restoring automatically"
  );
  forgetClosedWindows();

  // Open a new window and populate with tabs.
  let win = await promiseNewWindowLoaded();
  await openTabs(win);

  // Close the window.
  await BrowserTestUtils.closeWindow(win);

  // Reopen a window.
  let newWin = SessionWindowUI.undoCloseWindow(0);
  // Make sure we wait until this window is restored.
  await promiseWindowRestored(newWin);

  let tabs = newWin.gBrowser.tabs;
  is(tabs.length, TEST_URLS.length + 1, "Restored right number of tabs");

  // First tab is ignored, since it's the default tab open when we open new window

  // Second tab.
  ok(
    !tabs[1].__test_connection_prepared,
    "Second tab doesn't have a connection prepared"
  );
  is(
    tabs[1].__test_connection_url,
    TEST_URLS[0],
    "Second tab has correct host url"
  );

  // Third tab.
  ok(tabs[2].__test_connection_prepared, "Third tab has a connection prepared");
  is(
    tabs[2].__test_connection_url,
    TEST_URLS[1],
    "Third tab has correct host url"
  );

  // Last tab is the previously selected tab.
  is(
    tabs[3].__test_connection_prepared,
    undefined,
    "Selected tab should not have a connection prepared"
  );
  is(
    tabs[3].__test_connection_url,
    undefined,
    "Selected tab should not have a connection prepared"
  );

  await BrowserTestUtils.closeWindow(newWin);
});
