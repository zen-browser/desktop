/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test that the reader mode button appears and works properly on
 * reader-able content.
 */
const TEST_PREFS = [["reader.parse-on-load.enabled", true]];

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "http://example.com"
);

var readerButton = document.getElementById("reader-mode-button");

add_task(async function test_reader_button() {
  registerCleanupFunction(function () {
    // Reset test prefs.
    TEST_PREFS.forEach(([name]) => {
      Services.prefs.clearUserPref(name);
    });
    while (gBrowser.tabs.length > 1) {
      gBrowser.removeCurrentTab();
    }
  });

  // Set required test prefs.
  TEST_PREFS.forEach(([name, value]) => {
    Services.prefs.setBoolPref(name, value);
  });

  let tab = (gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser));
  is_element_hidden(
    readerButton,
    "Reader mode button is not present on a new tab"
  );
  // Point tab to a test page that is not reader-able due to hidden nodes.
  let url = TEST_PATH + "readerModeArticleHiddenNodes.html";
  let paintPromise = BrowserTestUtils.waitForContentEvent(
    tab.linkedBrowser,
    "MozAfterPaint",
    false,
    e =>
      e.originalTarget.location.href.endsWith("HiddenNodes.html") &&
      e.originalTarget.document.readyState == "complete"
  );
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);
  await paintPromise;

  is_element_hidden(
    readerButton,
    "Reader mode button is still not present on tab with unreadable content."
  );
});
