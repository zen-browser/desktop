/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const RAND = Math.random();
const URL =
  "http://mochi.test:8888/browser/" +
  "browser/components/sessionstore/test/browser_sessionStorage.html" +
  "?" +
  RAND;

const OUTER_VALUE = "outer-value-" + RAND;

// Lower the size limit for DOM Storage content. Check that DOM Storage
// is not updated, but that other things remain updated.
add_task(async function test_large_content() {
  Services.prefs.setIntPref("browser.sessionstore.dom_storage_limit", 5);

  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Flush to make sure chrome received all data.
  await TabStateFlusher.flush(browser);

  let state = JSON.parse(ss.getTabState(tab));
  info(JSON.stringify(state, null, "\t"));
  Assert.equal(state.storage, null, "We have no storage for the tab");
  Assert.equal(state.entries[0].title, OUTER_VALUE);
  BrowserTestUtils.removeTab(tab);

  Services.prefs.clearUserPref("browser.sessionstore.dom_storage_limit");
});
