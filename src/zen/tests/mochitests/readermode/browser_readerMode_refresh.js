/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "http://example.com"
);

async function testRefresh(url) {
  // Open an article in a browser tab
  await BrowserTestUtils.withNewTab(url, async function (browser) {
    let pageShownPromise = BrowserTestUtils.waitForContentEvent(
      browser,
      "AboutReaderContentReady"
    );

    let readerButton = document.getElementById("reader-mode-button");
    let refreshButton = document.getElementById("reload-button");

    // Enter Reader Mode
    readerButton.click();
    await pageShownPromise;

    // Wait for refreshing to be available.
    await BrowserTestUtils.waitForMutationCondition(
      refreshButton,
      { attributes: true },
      () => !refreshButton.disabled
    );

    // Refresh the page
    pageShownPromise = BrowserTestUtils.waitForContentEvent(
      browser,
      "AboutReaderContentReady"
    );
    refreshButton.click();
    await pageShownPromise;
    await SpecialPowers.spawn(browser, [], () => {
      ok(
        !content.document.documentElement.hasAttribute("data-is-error"),
        "The data-is-error attribute is present when Reader Mode failed to load an article."
      );
    });
  });
}

add_task(async function () {
  // Testing a non-text/plain document
  await testRefresh(TEST_PATH + "readerModeArticle.html");

  // Testing a test/plain document
  await testRefresh(TEST_PATH + "readerModeArticleTextPlain.txt");
});
