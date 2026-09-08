/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// This file spawns content tasks.

"use strict";

requestLongerTimeout(10);

const PAGE_1 =
  "data:text/html,<html><body>A%20regular,%20everyday,%20normal%20page.";
const PAGE_2 =
  "data:text/html,<html><body>Another%20regular,%20everyday,%20normal%20page.";

// Turn off tab animations for testing and use a single content process
// for these tests since we want to test tabs within the crashing process here.
gReduceMotionOverride = true;

// Allow tabs to restore on demand so we can test pending states
Services.prefs.clearUserPref("browser.sessionstore.restore_on_demand");

function clickButton(browser, id) {
  info("Clicking " + id);
  return SpecialPowers.spawn(browser, [id], buttonId => {
    let button = content.document.getElementById(buttonId);
    button.click();
  });
}

/**
 * Checks the documentURI of the root document of a remote browser
 * to see if it equals URI.
 *
 * @param browser
 *        The remote <xul:browser> to check the root document URI in.
 * @param URI
 *        A string to match the root document URI against.
 * @return Promise
 */
async function promiseContentDocumentURIEquals(browser, URI) {
  let contentURI = await SpecialPowers.spawn(browser, [], () => {
    return content.document.documentURI;
  });
  is(
    contentURI,
    URI,
    `Content has URI ${contentURI} which does not match ${URI}`
  );
}

/**
 * Checks the window.history.length of the root window of a remote
 * browser to see if it equals length.
 *
 * @param browser
 *        The remote <xul:browser> to check the root window.history.length
 * @param length
 *        The expected history length
 * @return Promise
 */
async function promiseHistoryLength(browser, length) {
  let contentLength = await SpecialPowers.spawn(browser, [], () => {
    return content.history.length;
  });
  is(
    contentLength,
    length,
    `Content has window.history.length ${contentLength} which does ` +
      `not equal expected ${length}`
  );
}

/**
 * Returns a Promise that resolves when a browser has fired the
 * AboutTabCrashedReady event.
 *
 * @param browser
 *        The remote <xul:browser> that will fire the event.
 * @return Promise
 */
function promiseTabCrashedReady(browser) {
  return new Promise(resolve => {
    browser.addEventListener(
      "AboutTabCrashedReady",
      function ready() {
        browser.removeEventListener("AboutTabCrashedReady", ready, false, true);
        resolve();
      },
      false,
      true
    );
  });
}

/**
 * Checks that if a tab crashes, that information about the tab crashed
 * page does not get added to the tab history.
 */
add_task(async function test_crash_page_not_in_history() {
  let newTab = BrowserTestUtils.addTab(gBrowser);
  gBrowser.selectedTab = newTab;
  let browser = newTab.linkedBrowser;
  ok(browser.isRemoteBrowser, "Should be a remote browser");
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);
  await TabStateFlusher.flush(browser);

  // Crash the tab
  await BrowserTestUtils.crashFrame(browser);

  // Check the tab state and make sure the tab crashed page isn't
  // mentioned.
  let { entries } = JSON.parse(ss.getTabState(newTab));
  is(entries.length, 1, "Should have a single history entry");
  is(
    entries[0].url,
    PAGE_1,
    "Single entry should be the page we visited before crashing"
  );

  gBrowser.removeTab(newTab);
});

/**
 * Checks that if a tab crashes, that when we browse away from that page
 * to a non-blacklisted site (so the browser becomes remote again), that
 * we record history for that new visit.
 */
add_task(async function test_revived_history_from_remote() {
  let newTab = BrowserTestUtils.addTab(gBrowser);
  gBrowser.selectedTab = newTab;
  let browser = newTab.linkedBrowser;
  ok(browser.isRemoteBrowser, "Should be a remote browser");
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);
  await TabStateFlusher.flush(browser);

  // Crash the tab
  await BrowserTestUtils.crashFrame(browser);

  // Browse to a new site that will cause the browser to
  // become remote again.
  BrowserTestUtils.startLoadingURIString(browser, PAGE_2);
  await promiseBrowserLoaded(browser);
  ok(
    !newTab.hasAttribute("crashed"),
    "Tab shouldn't be marked as crashed anymore."
  );
  ok(browser.isRemoteBrowser, "Should be a remote browser");
  await TabStateFlusher.flush(browser);

  // Check the tab state and make sure the tab crashed page isn't
  // mentioned.
  let { entries } = JSON.parse(ss.getTabState(newTab));
  is(entries.length, 2, "Should have two history entries");
  is(
    entries[0].url,
    PAGE_1,
    "First entry should be the page we visited before crashing"
  );
  is(
    entries[1].url,
    PAGE_2,
    "Second entry should be the page we visited after crashing"
  );

  gBrowser.removeTab(newTab);
});

/**
 * Checks that if a tab crashes, that when we browse away from that page
 * to a blacklisted site (so the browser stays non-remote), that
 * we record history for that new visit.
 */
add_task(async function test_revived_history_from_non_remote() {
  let newTab = BrowserTestUtils.addTab(gBrowser);
  gBrowser.selectedTab = newTab;
  let browser = newTab.linkedBrowser;
  ok(browser.isRemoteBrowser, "Should be a remote browser");
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);
  await TabStateFlusher.flush(browser);

  // Crash the tab
  await BrowserTestUtils.crashFrame(browser);

  // Browse to a new site that will not cause the browser to
  // become remote again.
  BrowserTestUtils.startLoadingURIString(browser, "about:mozilla");
  await promiseBrowserLoaded(browser);
  ok(
    !newTab.hasAttribute("crashed"),
    "Tab shouldn't be marked as crashed anymore."
  );
  ok(!browser.isRemoteBrowser, "Should not be a remote browser");
  await TabStateFlusher.flush(browser);

  // Check the tab state and make sure the tab crashed page isn't
  // mentioned.
  let { entries } = JSON.parse(ss.getTabState(newTab));
  is(entries.length, 2, "Should have two history entries");
  is(
    entries[0].url,
    PAGE_1,
    "First entry should be the page we visited before crashing"
  );
  is(
    entries[1].url,
    "about:mozilla",
    "Second entry should be the page we visited after crashing"
  );

  gBrowser.removeTab(newTab);
});

/**
 * Checks that we can revive a crashed tab back to the page that
 * it was on when it crashed.
 */
add_task(async function test_revive_tab_from_session_store() {
  let newTab = BrowserTestUtils.addTab(gBrowser);
  gBrowser.selectedTab = newTab;
  let browser = newTab.linkedBrowser;
  ok(browser.isRemoteBrowser, "Should be a remote browser");
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);

  let newTab2 = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    remoteType: browser.remoteType,
    initialBrowsingContextGroupId: browser.browsingContext.group.id,
  });
  let browser2 = newTab2.linkedBrowser;
  ok(browser2.isRemoteBrowser, "Should be a remote browser");
  await BrowserTestUtils.browserLoaded(browser2, { wantLoad: "about:blank" });

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);

  BrowserTestUtils.startLoadingURIString(browser, PAGE_2);
  await promiseBrowserLoaded(browser);

  await TabStateFlusher.flush(browser);

  // Crash the tab
  await BrowserTestUtils.crashFrame(browser);
  // Background tabs should not be crashed, but should be in the "to be restored"
  // state.
  ok(!newTab2.hasAttribute("crashed"), "Second tab should not be crashed.");
  ok(newTab2.hasAttribute("pending"), "Second tab should be pending.");

  // Use SessionStore to revive the first tab
  let tabRestoredPromise = promiseTabRestored(newTab);
  await clickButton(browser, "restoreTab");
  await tabRestoredPromise;
  ok(
    !newTab.hasAttribute("crashed"),
    "Tab shouldn't be marked as crashed anymore."
  );
  ok(newTab2.hasAttribute("pending"), "Second tab should still be pending.");

  // We can't just check browser.currentURI.spec, because from
  // the outside, a crashed tab has the same URI as the page
  // it crashed on (much like an about:neterror page). Instead,
  // we have to use the documentURI on the content.
  await promiseContentDocumentURIEquals(browser, PAGE_2);

  // We should also have two entries in the browser history.
  await promiseHistoryLength(browser, 2);

  gBrowser.removeTab(newTab);
  gBrowser.removeTab(newTab2);
});

/**
 * Checks that we can revive multiple crashed tabs back to the pages
 * that they were on when they crashed.
 */
add_task(async function test_revive_all_tabs_from_session_store() {
  let newTab = BrowserTestUtils.addTab(gBrowser);
  gBrowser.selectedTab = newTab;
  let browser = newTab.linkedBrowser;
  ok(browser.isRemoteBrowser, "Should be a remote browser");
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);

  // In order to see a second about:tabcrashed page, we'll need
  // a second window, since only selected tabs will show
  // about:tabcrashed.
  let win2 = await BrowserTestUtils.openNewBrowserWindow();
  let newTab2 = BrowserTestUtils.addTab(win2.gBrowser, PAGE_1, {
    remoteType: browser.remoteType,
    initialBrowsingContextGroupId: browser.browsingContext.group.id,
  });
  win2.gBrowser.selectedTab = newTab2;
  let browser2 = newTab2.linkedBrowser;
  ok(browser2.isRemoteBrowser, "Should be a remote browser");
  await promiseBrowserLoaded(browser2);

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);

  BrowserTestUtils.startLoadingURIString(browser, PAGE_2);
  await promiseBrowserLoaded(browser);

  await TabStateFlusher.flush(browser);
  await TabStateFlusher.flush(browser2);

  // Crash the tab
  await BrowserTestUtils.crashFrame(browser);
  // Both tabs should now be crashed.
  is(newTab.getAttribute("crashed"), "true", "First tab should be crashed");
  is(
    newTab2.getAttribute("crashed"),
    "true",
    "Second window tab should be crashed"
  );

  // Use SessionStore to revive all the tabs
  let tabRestoredPromises = Promise.all([
    promiseTabRestored(newTab),
    promiseTabRestored(newTab2),
  ]);
  await clickButton(browser, "restoreAll");
  await tabRestoredPromises;

  ok(
    !newTab.hasAttribute("crashed"),
    "Tab shouldn't be marked as crashed anymore."
  );
  ok(!newTab.hasAttribute("pending"), "Tab shouldn't be pending.");
  ok(
    !newTab2.hasAttribute("crashed"),
    "Second tab shouldn't be marked as crashed anymore."
  );
  ok(!newTab2.hasAttribute("pending"), "Second tab shouldn't be pending.");

  // We can't just check browser.currentURI.spec, because from
  // the outside, a crashed tab has the same URI as the page
  // it crashed on (much like an about:neterror page). Instead,
  // we have to use the documentURI on the content.
  await promiseContentDocumentURIEquals(browser, PAGE_2);
  await promiseContentDocumentURIEquals(browser2, PAGE_1);

  // We should also have two entries in the browser history.
  await promiseHistoryLength(browser, 2);

  await BrowserTestUtils.closeWindow(win2);
  gBrowser.removeTab(newTab);
});

/**
 * Checks that about:tabcrashed can close the current tab
 */
add_task(async function test_close_tab_after_crash() {
  let newTab = BrowserTestUtils.addTab(gBrowser);
  gBrowser.selectedTab = newTab;
  let browser = newTab.linkedBrowser;
  ok(browser.isRemoteBrowser, "Should be a remote browser");
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);

  await TabStateFlusher.flush(browser);

  // Crash the tab
  await BrowserTestUtils.crashFrame(browser);

  let promise = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabClose"
  );

  // Click the close tab button
  await clickButton(browser, "closeTab");
  await promise;

  is(gBrowser.tabs.length, 1, "Should have closed the tab");
});

/**
 * Checks that "restore all" button is only shown if more than one tab
 * is showing about:tabcrashed
 */
add_task(async function test_hide_restore_all_button() {
  let newTab = BrowserTestUtils.addTab(gBrowser);
  gBrowser.selectedTab = newTab;
  let browser = newTab.linkedBrowser;
  ok(browser.isRemoteBrowser, "Should be a remote browser");
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);

  await TabStateFlusher.flush(browser);

  // Crash the tab
  await BrowserTestUtils.crashFrame(browser);

  let doc = browser.contentDocument;
  let restoreAllButton = doc.getElementById("restoreAll");
  let restoreOneButton = doc.getElementById("restoreTab");

  let restoreAllStyles = window.getComputedStyle(restoreAllButton);
  is(restoreAllStyles.display, "none", "Restore All button should be hidden");
  ok(
    restoreOneButton.classList.contains("primary"),
    "Restore Tab button should have the primary class"
  );

  let newTab2 = BrowserTestUtils.addTab(gBrowser);
  gBrowser.selectedTab = newTab;

  BrowserTestUtils.startLoadingURIString(browser, PAGE_2);
  await promiseBrowserLoaded(browser);

  // Load up a second window so we can get another tab to show
  // about:tabcrashed
  let win2 = await BrowserTestUtils.openNewBrowserWindow();
  let newTab3 = BrowserTestUtils.addTab(win2.gBrowser, PAGE_2, {
    remoteType: browser.remoteType,
    initialBrowsingContextGroupId: browser.browsingContext.group.id,
  });
  win2.gBrowser.selectedTab = newTab3;
  let otherWinBrowser = newTab3.linkedBrowser;
  await promiseBrowserLoaded(otherWinBrowser);
  // We'll need to make sure the second tab's browser has finished
  // sending its AboutTabCrashedReady event before we know for
  // sure whether or not we're showing the right Restore buttons.
  let otherBrowserReady = promiseTabCrashedReady(otherWinBrowser);

  // Crash the first tab.
  await BrowserTestUtils.crashFrame(browser);
  await otherBrowserReady;

  doc = browser.contentDocument;
  restoreAllButton = doc.getElementById("restoreAll");
  restoreOneButton = doc.getElementById("restoreTab");

  restoreAllStyles = window.getComputedStyle(restoreAllButton);
  isnot(
    restoreAllStyles.display,
    "none",
    "Restore All button should not be hidden"
  );
  ok(
    !restoreOneButton.classList.contains("primary"),
    "Restore Tab button should not have the primary class"
  );

  await BrowserTestUtils.closeWindow(win2);
  gBrowser.removeTab(newTab);
  gBrowser.removeTab(newTab2);
});

add_task(async function test_aboutcrashedtabzoom() {
  let newTab = BrowserTestUtils.addTab(gBrowser);
  gBrowser.selectedTab = newTab;
  let browser = newTab.linkedBrowser;
  ok(browser.isRemoteBrowser, "Should be a remote browser");
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  await promiseBrowserLoaded(browser);

  FullZoom.enlarge();
  let zoomLevel = ZoomManager.getZoomForBrowser(browser);
  Assert.notStrictEqual(zoomLevel, 1, "should have enlarged");

  await TabStateFlusher.flush(browser);

  // Crash the tab
  await BrowserTestUtils.crashFrame(browser);

  Assert.strictEqual(
    ZoomManager.getZoomForBrowser(browser),
    1,
    "zoom should have reset on crash"
  );

  let tabRestoredPromise = promiseTabRestored(newTab);
  await clickButton(browser, "restoreTab");
  await tabRestoredPromise;

  Assert.strictEqual(
    ZoomManager.getZoomForBrowser(browser),
    zoomLevel,
    "zoom should have gone back to enlarged"
  );
  FullZoom.reset();

  gBrowser.removeTab(newTab);
});
