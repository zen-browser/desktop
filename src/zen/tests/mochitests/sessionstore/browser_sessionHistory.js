/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

requestLongerTimeout(2);

/**
 * Ensure that starting a load invalidates shistory.
 */
add_task(async function test_load_start() {
  // Create a new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  const PAGE = "http://example.com/";

  // Load a new URI.
  let historyReplacePromise = promiseOnHistoryReplaceEntry(browser);
  BrowserTestUtils.startLoadingURIString(browser, PAGE);

  // Remove the tab before it has finished loading.
  await historyReplacePromise;
  await promiseRemoveTabAndSessionState(tab);

  // Undo close the tab.
  tab = ss.undoCloseTab(window, 0);
  browser = tab.linkedBrowser;
  await promiseTabRestored(tab);

  // Check that the correct URL was restored.
  is(browser.currentURI.spec, PAGE, "url is correct");

  // Cleanup.
  gBrowser.removeTab(tab);
});

/**
 * Ensure that anchor navigation invalidates shistory.
 */
add_task(async function test_hashchange() {
  const PATH = getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content/",
    "http://example.com/"
  );
  const URL = PATH + "file_sessionHistory_hashchange.html";
  // Create a new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Check that we start with a single shistory entry.
  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 1, "there is one shistory entry");

  // Click the link and wait for a hashchange event.
  let eventPromise = BrowserTestUtils.waitForContentEvent(
    browser,
    "hashchange",
    true
  );
  await SpecialPowers.spawn(browser, [], async function () {
    content.document.querySelector("#a").click();
  });
  info("About to watch for a hash change event");
  await eventPromise;
  info("Got a hash change event");

  // Check that we now have two shistory entries.
  await TabStateFlusher.flush(browser);
  ({ entries } = JSON.parse(ss.getTabState(tab)));
  is(entries.length, 2, "there are two shistory entries");

  // Cleanup.
  gBrowser.removeTab(tab);
});

/**
 * Ensure that loading pages from the bfcache invalidates shistory.
 */
add_task(async function test_pageshow() {
  const URL = "data:text/html;charset=utf-8,<h1>first</h1>";
  const URL2 = "data:text/html;charset=utf-8,<h1>second</h1>";

  // Create a new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Create a second shistory entry.
  BrowserTestUtils.startLoadingURIString(browser, URL2);
  await promiseBrowserLoaded(browser);

  // Wait until shistory changes.
  let pageShowPromise = BrowserTestUtils.waitForContentEvent(
    browser,
    "pageshow",
    true
  );

  // Go back to the previous url which is loaded from the bfcache.
  browser.goBack();
  await pageShowPromise;
  is(browser.currentURI.spec, URL, "correct url after going back");

  // Check that loading from bfcache did invalidate shistory.
  await TabStateFlusher.flush(browser);
  let { index } = JSON.parse(ss.getTabState(tab));
  is(index, 1, "first history entry is selected");

  // Cleanup.
  gBrowser.removeTab(tab);
});

/**
 * Ensure that subframe navigation invalidates shistory.
 */
add_task(async function test_subframes() {
  const URL =
    "data:text/html;charset=utf-8," +
    "<iframe src=http%3A//example.com/ name=t></iframe>" +
    "<a id=a1 href=http%3A//example.com/1 target=t>clickme</a>" +
    "<a id=a2 href=http%3A//example.com/%23section target=t>clickme</a>";

  // Create a new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Check that we have a single shistory entry.
  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 1, "there is one shistory entry");
  is(entries[0].children.length, 1, "the entry has one child");

  // Navigate the subframe.
  await SpecialPowers.spawn(browser, [], async function () {
    content.document.notifyUserGestureActivation();
    content.document.querySelector("#a1").click();
  });
  await promiseBrowserLoaded(
    browser,
    false /* wait for subframe load only */,
    "http://example.com/1"
  );

  // Check shistory.
  await TabStateFlusher.flush(browser);
  ({ entries } = JSON.parse(ss.getTabState(tab)));
  is(entries.length, 2, "there now are two shistory entries");
  is(entries[1].children.length, 1, "the second entry has one child");

  // Go back in history.
  let goneBack = promiseBrowserLoaded(
    browser,
    false /* wait for subframe load only */,
    "http://example.com/"
  );
  info("About to go back in history");
  browser.goBack();
  await goneBack;

  // Navigate the subframe again.
  let eventPromise = BrowserTestUtils.waitForContentEvent(
    browser,
    "hashchange",
    true
  );
  await SpecialPowers.spawn(browser, [], async function () {
    content.document.querySelector("#a2").click();
  });
  await eventPromise;

  // Check shistory.
  await TabStateFlusher.flush(browser);
  ({ entries } = JSON.parse(ss.getTabState(tab)));
  is(entries.length, 2, "there now are two shistory entries");
  is(entries[1].children.length, 1, "the second entry has one child");

  // Cleanup.
  gBrowser.removeTab(tab);
});

/**
 * Ensure that navigating from an about page invalidates shistory.
 */
add_task(async function test_about_page_navigate() {
  // Create a new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  // Check that we have a single shistory entry.
  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 1, "there is one shistory entry");
  is(entries[0].url, "about:blank", "url is correct");

  // Verify that the title is also recorded.
  is(entries[0].title, "about:blank", "title is correct");

  BrowserTestUtils.startLoadingURIString(browser, "about:robots");
  await promiseBrowserLoaded(browser);

  // Check that we have changed the history entry.
  await TabStateFlusher.flush(browser);
  ({ entries } = JSON.parse(ss.getTabState(tab)));
  is(entries.length, 1, "there is one shistory entry");
  is(entries[0].url, "about:robots", "url is correct");

  // Cleanup.
  gBrowser.removeTab(tab);
});

/**
 * Ensure that history.pushState and history.replaceState invalidate shistory.
 */
add_task(async function test_pushstate_replacestate() {
  // Create a new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "http://example.com/1");
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Check that we have a single shistory entry.
  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 1, "there is one shistory entry");
  is(entries[0].url, "http://example.com/1", "url is correct");

  await SpecialPowers.spawn(browser, [], async function () {
    content.window.history.pushState({}, "", "test-entry/");
  });

  // Check that we have added the history entry.
  await TabStateFlusher.flush(browser);
  ({ entries } = JSON.parse(ss.getTabState(tab)));
  is(entries.length, 2, "there is another shistory entry");
  is(entries[1].url, "http://example.com/test-entry/", "url is correct");

  await SpecialPowers.spawn(browser, [], async function () {
    content.window.history.replaceState({}, "", "test-entry2/");
  });

  // Check that we have modified the history entry.
  await TabStateFlusher.flush(browser);
  ({ entries } = JSON.parse(ss.getTabState(tab)));
  is(entries.length, 2, "there is still two shistory entries");
  is(
    entries[1].url,
    "http://example.com/test-entry/test-entry2/",
    "url is correct"
  );

  // Cleanup.
  gBrowser.removeTab(tab);
});

/**
 * Ensure that slow loading subframes will invalidate shistory.
 */
add_task(async function test_slow_subframe_load() {
  const SLOW_URL =
    "http://mochi.test:8888/browser/browser/components/" +
    "sessionstore/test/browser_sessionHistory_slow.sjs";

  const URL =
    "data:text/html;charset=utf-8," +
    "<frameset cols=50%25,50%25>" +
    "<frame src='" +
    SLOW_URL +
    "'>" +
    "</frameset>";

  // Add a new tab with a slow loading subframe
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));

  // Check the number of children.
  is(entries.length, 1, "there is one root entry ...");
  is(entries[0].children.length, 1, "... with one child entries");

  // Check URLs.
  ok(entries[0].url.startsWith("data:text/html"), "correct root url");
  is(entries[0].children[0].url, SLOW_URL, "correct url for subframe");

  // Cleanup.
  gBrowser.removeTab(tab);
});
