/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "http://example.com"
);

const CROSS_SITE_TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "http://example.org"
);

/**
 * Test that switching an article into readermode doesn't change its' remoteType.
 * Test that the reader mode correctly calculates and displays the
 * estimated reading time for a short article
 */
add_task(async function () {
  info("opening readermode normally to ensure process doesn't change");
  let articleRemoteType;
  let aboutReaderURL;
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticleShort.html",
    async function (browser) {
      articleRemoteType = browser.remoteType;

      // Click on the readermode button to switch into reader mode, and get the
      // URL for that reader mode.
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );
      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;

      aboutReaderURL = browser.documentURI.spec;
      ok(
        aboutReaderURL.startsWith("about:reader"),
        "about:reader should have been opened"
      );
      is(
        browser.remoteType,
        articleRemoteType,
        "remote type should not have changed"
      );
    }
  );

  info(
    "opening new tab directly with about reader URL into correct remote type"
  );
  await BrowserTestUtils.withNewTab(aboutReaderURL, async function (browser) {
    is(
      browser.remoteType,
      articleRemoteType,
      "Should have performed about:reader load in the correct remote type"
    );
  });

  info("navigating process into correct remote type");
  await BrowserTestUtils.withNewTab(
    CROSS_SITE_TEST_PATH + "readerModeArticleShort.html",
    async function (browser) {
      if (SpecialPowers.useRemoteSubframes) {
        isnot(
          browser.remoteType,
          articleRemoteType,
          "Cross-site article should have different remote type with fission"
        );
      }

      BrowserTestUtils.startLoadingURIString(browser, aboutReaderURL);
      await BrowserTestUtils.browserLoaded(browser);

      is(
        browser.remoteType,
        articleRemoteType,
        "Should have switched into the correct remote type"
      );
    }
  );
});
