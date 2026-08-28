/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const RAND = Math.random();
const URL =
  "http://mochi.test:8888/browser/" +
  "browser/components/sessionstore/test/browser_sessionStorage.html" +
  "?" +
  RAND;

const HAS_FIRST_PARTY_DOMAIN = [
  Ci.nsICookieService.BEHAVIOR_PARTITION_FOREIGN,
].includes(Services.prefs.getIntPref("network.cookie.cookieBehavior"));
const OUTER_ORIGIN = "http://mochi.test:8888";
const FIRST_PARTY_DOMAIN = escape("(http,mochi.test)");
const INNER_ORIGIN = HAS_FIRST_PARTY_DOMAIN
  ? `http://example.com^partitionKey=${FIRST_PARTY_DOMAIN}`
  : "http://example.com";
const SECURE_INNER_ORIGIN = HAS_FIRST_PARTY_DOMAIN
  ? `https://example.com^partitionKey=${FIRST_PARTY_DOMAIN}`
  : "https://example.com";

const OUTER_VALUE = "outer-value-" + RAND;
const INNER_VALUE = "inner-value-" + RAND;

/**
 * This test ensures that setting, modifying and restoring sessionStorage data
 * works as expected.
 */
add_task(async function session_storage() {
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Flush to make sure chrome received all data.
  await TabStateFlusher.flush(browser);

  let { storage } = JSON.parse(ss.getTabState(tab));
  is(
    storage[INNER_ORIGIN].test,
    INNER_VALUE,
    "sessionStorage data for example.com has been serialized correctly"
  );
  is(
    storage[OUTER_ORIGIN].test,
    OUTER_VALUE,
    "sessionStorage data for mochi.test has been serialized correctly"
  );

  // Ensure that modifying sessionStore values works for the inner frame only.
  await modifySessionStorage(browser, { test: "modified1" }, { frameIndex: 0 });
  await TabStateFlusher.flush(browser);

  ({ storage } = JSON.parse(ss.getTabState(tab)));
  is(
    storage[INNER_ORIGIN].test,
    "modified1",
    "sessionStorage data for example.com has been serialized correctly"
  );
  is(
    storage[OUTER_ORIGIN].test,
    OUTER_VALUE,
    "sessionStorage data for mochi.test has been serialized correctly"
  );

  // Ensure that modifying sessionStore values works for both frames.
  await modifySessionStorage(browser, { test: "modified" });
  await modifySessionStorage(browser, { test: "modified2" }, { frameIndex: 0 });
  await TabStateFlusher.flush(browser);

  ({ storage } = JSON.parse(ss.getTabState(tab)));
  is(
    storage[INNER_ORIGIN].test,
    "modified2",
    "sessionStorage data for example.com has been serialized correctly"
  );
  is(
    storage[OUTER_ORIGIN].test,
    "modified",
    "sessionStorage data for mochi.test has been serialized correctly"
  );

  // Test that duplicating a tab works.
  let tab2 = gBrowser.duplicateTab(tab);
  let browser2 = tab2.linkedBrowser;
  // See bug 2001322, need to wait for iframe of tab2 to finish loading
  const subframeLoaded = BrowserTestUtils.browserLoaded(tab2.linkedBrowser, {
    includeSubFrames: true,
    wantLoad: url => url.startsWith("http://example.com"),
  });
  await Promise.all([promiseTabRestored(tab2), subframeLoaded]);

  // Flush to make sure chrome received all data.
  await TabStateFlusher.flush(browser2);

  ({ storage } = JSON.parse(ss.getTabState(tab2)));
  is(
    storage[INNER_ORIGIN].test,
    "modified2",
    "sessionStorage data for example.com has been duplicated correctly"
  );
  is(
    storage[OUTER_ORIGIN].test,
    "modified",
    "sessionStorage data for mochi.test has been duplicated correctly"
  );

  // Ensure that the content script retains restored data
  // (by e.g. duplicateTab) and sends it along with new data.
  await modifySessionStorage(browser2, { test: "modified3" });
  await TabStateFlusher.flush(browser2);

  ({ storage } = JSON.parse(ss.getTabState(tab2)));
  is(
    storage[INNER_ORIGIN].test,
    "modified2",
    "sessionStorage data for example.com has been duplicated correctly"
  );
  is(
    storage[OUTER_ORIGIN].test,
    "modified3",
    "sessionStorage data for mochi.test has been duplicated correctly"
  );

  // Check that loading a new URL discards data.
  BrowserTestUtils.startLoadingURIString(browser2, "http://mochi.test:8888/");
  await promiseBrowserLoaded(browser2);
  await TabStateFlusher.flush(browser2);

  ({ storage } = JSON.parse(ss.getTabState(tab2)));
  is(
    storage[OUTER_ORIGIN].test,
    "modified3",
    "navigating retains correct storage data"
  );

  is(
    storage[INNER_ORIGIN].test,
    "modified2",
    "sessionStorage data for example.com wasn't discarded after top-level same-site navigation"
  );

  // Test that clearing the data in the first tab works properly within
  // the subframe
  await modifySessionStorage(browser, {}, { frameIndex: 0 });
  await TabStateFlusher.flush(browser);
  ({ storage } = JSON.parse(ss.getTabState(tab)));
  is(
    storage[INNER_ORIGIN],
    undefined,
    "sessionStorage data for example.com has been cleared correctly"
  );

  // Test that clearing the data in the first tab works properly within
  // the top-level frame
  await modifySessionStorage(browser, {});
  await TabStateFlusher.flush(browser);
  ({ storage } = JSON.parse(ss.getTabState(tab)));
  ok(
    storage === null || storage === undefined,
    "sessionStorage data for the entire tab has been cleared correctly"
  );

  // Clean up.
  BrowserTestUtils.removeTab(tab);
  BrowserTestUtils.removeTab(tab2);
});

/**
 * This test ensures that purging domain data also purges data from the
 * sessionStorage data collected for tabs.
 */
add_task(async function purge_domain() {
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Purge data for "mochi.test".
  await purgeDomainData(browser, "mochi.test");

  // Flush to make sure chrome received all data.
  await TabStateFlusher.flush(browser);

  let { storage } = JSON.parse(ss.getTabState(tab));
  ok(
    !storage[OUTER_ORIGIN],
    "sessionStorage data for mochi.test has been purged"
  );
  is(
    storage[INNER_ORIGIN].test,
    INNER_VALUE,
    "sessionStorage data for example.com has been preserved"
  );

  BrowserTestUtils.removeTab(tab);
});

/**
 * This test ensures that collecting sessionStorage data respects the privacy
 * levels as set by the user.
 */
add_task(async function respect_privacy_level() {
  let tab = BrowserTestUtils.addTab(gBrowser, URL + "&secure");
  await promiseBrowserLoaded(tab.linkedBrowser);
  await TabStateFlusher.flush(tab.linkedBrowser);
  await promiseRemoveTabAndSessionState(tab);

  let [
    {
      state: { storage },
    },
  ] = ss.getClosedTabDataForWindow(window);
  is(
    storage[OUTER_ORIGIN].test,
    OUTER_VALUE,
    "http sessionStorage data has been saved"
  );
  is(
    storage[SECURE_INNER_ORIGIN].test,
    INNER_VALUE,
    "https sessionStorage data has been saved"
  );

  // Disable saving data for encrypted sites.
  Services.prefs.setIntPref("browser.sessionstore.privacy_level", 1);

  tab = BrowserTestUtils.addTab(gBrowser, URL + "&secure");
  await promiseBrowserLoaded(tab.linkedBrowser);
  await TabStateFlusher.flush(tab.linkedBrowser);
  await promiseRemoveTabAndSessionState(tab);

  [
    {
      state: { storage },
    },
  ] = ss.getClosedTabDataForWindow(window);
  is(
    storage[OUTER_ORIGIN].test,
    OUTER_VALUE,
    "http sessionStorage data has been saved"
  );
  ok(
    !storage[SECURE_INNER_ORIGIN],
    "https sessionStorage data has *not* been saved"
  );

  // Disable saving data for any site.
  Services.prefs.setIntPref("browser.sessionstore.privacy_level", 2);

  // Check that duplicating a tab copies all private data.
  tab = BrowserTestUtils.addTab(gBrowser, URL + "&secure");
  await promiseBrowserLoaded(tab.linkedBrowser);
  let tab2 = gBrowser.duplicateTab(tab);
  // See bug 2001322, need to wait for iframe of tab2 to finish loading
  const subframeLoaded = BrowserTestUtils.browserLoaded(tab2.linkedBrowser, {
    includeSubFrames: true,
    wantLoad: url => url.startsWith("https://example.com"),
  });
  await Promise.all([promiseTabRestored(tab2), subframeLoaded]);
  await promiseRemoveTabAndSessionState(tab);

  // With privacy_level=2 the |tab| shouldn't have any sessionStorage data.
  [
    {
      state: { storage },
    },
  ] = ss.getClosedTabDataForWindow(window);
  ok(!storage, "sessionStorage data has *not* been saved");

  // Remove all closed tabs before continuing with the next test.
  // As Date.now() isn't monotonic we might sometimes check
  // the wrong closedTabData entry.
  forgetClosedTabs(window);

  // Restore the default privacy level and close the duplicated tab.
  Services.prefs.clearUserPref("browser.sessionstore.privacy_level");
  await promiseRemoveTabAndSessionState(tab2);

  // With privacy_level=0 the duplicated |tab2| should persist all data.
  [
    {
      state: { storage },
    },
  ] = ss.getClosedTabDataForWindow(window);
  is(
    storage[OUTER_ORIGIN].test,
    OUTER_VALUE,
    "http sessionStorage data has been saved"
  );
  is(
    storage[SECURE_INNER_ORIGIN].test,
    INNER_VALUE,
    "https sessionStorage data has been saved"
  );
});

function purgeDomainData(browser, domain) {
  return new Promise(resolve => {
    Services.clearData.deleteDataFromHost(
      domain,
      true,
      Services.clearData.CLEAR_HISTORY,
      resolve
    );
  });
}
