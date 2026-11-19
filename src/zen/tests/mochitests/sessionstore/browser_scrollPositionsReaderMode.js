/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const BASE = "http://example.com/browser/browser/components/sessionstore/test/";
const READER_MODE_URL =
  "about:reader?url=" +
  encodeURIComponent(BASE + "browser_scrollPositions_readerModeArticle.html");

// Randomized set of scroll positions we will use in this test.
const SCROLL_READER_MODE_Y = Math.round(400 * (1 + Math.random()));
const SCROLL_READER_MODE_STR = "0," + SCROLL_READER_MODE_Y;

requestLongerTimeout(2);

/**
 * Test that scroll positions of about reader page after restoring background
 * tabs in a restored window (bug 1153393).
 */
add_task(async function test_scroll_background_about_reader_tabs() {
  await pushPrefs(["browser.sessionstore.restore_on_demand", true]);

  let newWin = await BrowserTestUtils.openNewBrowserWindow();
  let tab = BrowserTestUtils.addTab(newWin.gBrowser, READER_MODE_URL);
  let browser = tab.linkedBrowser;
  await Promise.all([
    BrowserTestUtils.browserLoaded(browser),
    BrowserTestUtils.waitForContentEvent(browser, "AboutReaderContentReady"),
  ]);

  // Scroll down a little.
  await setScrollPosition(browser, 0, SCROLL_READER_MODE_Y);
  await checkScroll(tab, { scroll: SCROLL_READER_MODE_STR }, "scroll is fine");

  // Close the window
  await BrowserTestUtils.closeWindow(newWin);

  await forceSaveState();

  // Now restore the window
  newWin = ss.undoCloseWindow(0);

  // Make sure to wait for the window to be restored.
  await BrowserTestUtils.waitForEvent(newWin, "SSWindowStateReady");

  is(newWin.gBrowser.tabs.length, 2, "There should be two tabs");

  // The second tab should be the one we loaded URL at still
  tab = newWin.gBrowser.tabs[1];

  ok(tab.hasAttribute("pending"), "Tab should be pending");
  browser = tab.linkedBrowser;

  // Ensure there are no pending queued messages in the child.
  await TabStateFlusher.flush(browser);

  // Now check to see if the background tab remembers where it
  // should be scrolled to.
  newWin.gBrowser.selectedTab = tab;
  await Promise.all([
    promiseTabRestored(tab),
    BrowserTestUtils.waitForContentEvent(
      tab.linkedBrowser,
      "AboutReaderContentReady"
    ),
  ]);

  await checkScroll(
    tab,
    { scroll: SCROLL_READER_MODE_STR },
    "scroll is still fine"
  );

  await BrowserTestUtils.closeWindow(newWin);
});
