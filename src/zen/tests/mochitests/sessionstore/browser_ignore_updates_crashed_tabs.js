// This test checks that browsers are removed from the SessionStore's
// crashed browser set at a correct time, so that it can stop ignoring update
// events coming from those browsers.

/**
 * Open a tab, crash it, navigate it to a remote uri, and check that it
 * is removed from a crashed set.
 */
add_task(async function test_update_crashed_tab_after_navigate_to_remote() {
  let tab = BrowserTestUtils.addTab(gBrowser, "https://example.com/");
  let browser = tab.linkedBrowser;
  gBrowser.selectedTab = tab;
  await promiseBrowserLoaded(browser);
  ok(
    !SessionStore.isBrowserInCrashedSet(browser),
    "browser is not in the crashed set"
  );

  await BrowserTestUtils.crashFrame(browser);
  ok(
    SessionStore.isBrowserInCrashedSet(browser),
    "browser is in the crashed set"
  );

  BrowserTestUtils.startLoadingURIString(browser, "https://example.org/");
  await BrowserTestUtils.browserLoaded(browser, false, "https://example.org/");
  ok(
    !SessionStore.isBrowserInCrashedSet(browser),
    "browser is not in the crashed set"
  );
  ok(
    !tab.hasAttribute("crashed"),
    "Tab shouldn't be marked as crashed anymore."
  );
  gBrowser.removeTab(tab);
});

/**
 * Open a tab, crash it, navigate it to a non-remote uri, and check that it
 * is removed from a crashed set.
 */
add_task(async function test_update_crashed_tab_after_navigate_to_non_remote() {
  let tab = BrowserTestUtils.addTab(gBrowser, "https://example.com/");
  let browser = tab.linkedBrowser;
  gBrowser.selectedTab = tab;
  await promiseBrowserLoaded(browser);
  ok(
    !SessionStore.isBrowserInCrashedSet(browser),
    "browser is not in the crashed set"
  );

  await BrowserTestUtils.crashFrame(browser);
  ok(
    SessionStore.isBrowserInCrashedSet(browser),
    "browser is in the crashed set"
  );

  BrowserTestUtils.startLoadingURIString(browser, "about:mozilla");
  await BrowserTestUtils.browserLoaded(browser, false, "about:mozilla");
  ok(
    !SessionStore.isBrowserInCrashedSet(browser),
    "browser is not in the crashed set"
  );
  ok(
    !gBrowser.selectedTab.hasAttribute("crashed"),
    "Tab shouldn't be marked as crashed anymore."
  );
  gBrowser.removeTab(tab);
});

/**
 * Open a tab, crash it, restore it from history, and check that it
 * is removed from a crashed set.
 */
add_task(async function test_update_crashed_tab_after_session_restore() {
  let tab = BrowserTestUtils.addTab(gBrowser, "https://example.com/");
  let browser = tab.linkedBrowser;
  gBrowser.selectedTab = tab;
  await promiseBrowserLoaded(browser);
  ok(
    !SessionStore.isBrowserInCrashedSet(browser),
    "browser is not in the crashed set"
  );

  await BrowserTestUtils.crashFrame(browser);
  ok(
    SessionStore.isBrowserInCrashedSet(browser),
    "browser is in the crashed set"
  );

  let tabRestoredPromise = promiseTabRestored(tab);
  // Click restoreTab button
  await SpecialPowers.spawn(browser, [], () => {
    let button = content.document.getElementById("restoreTab");
    button.click();
  });
  await tabRestoredPromise;
  ok(
    !tab.hasAttribute("crashed"),
    "Tab shouldn't be marked as crashed anymore."
  );
  ok(
    !SessionStore.isBrowserInCrashedSet(browser),
    "browser is not in the crashed set"
  );

  gBrowser.removeTab(tab);
});
