/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "http://example.com"
);

/**
 * Test that the reader mode correctly calculates and displays the
 * estimated reading time for a normal length article
 */
add_task(async function () {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticle.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );
      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;
      await SpecialPowers.spawn(browser, [], async function () {
        // make sure there is a reading time on the page and that it displays the correct information
        let readingTimeElement = content.document.querySelector(
          ".reader-estimated-time"
        );
        ok(readingTimeElement, "Reading time element should be in document");
        const readingTimeText = readingTimeElement.textContent;
        ok(
          /\b9\b.*\b12\b/.test(readingTimeText),
          "Reading time should be '9-12 minutes'"
        );

        let container = content.document.querySelector(".container");
        let lang = container.getAttribute("lang");
        is(lang, "en", "Should have reused lang attr from the original page.");
      });
    }
  );
});

/**
 * Test that the reader mode correctly calculates and displays the
 * estimated reading time for a short article
 */
add_task(async function () {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticleShort.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );
      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;
      await SpecialPowers.spawn(browser, [], async function () {
        // make sure there is a reading time on the page and that it displays the correct information
        let readingTimeElement = content.document.querySelector(
          ".reader-estimated-time"
        );
        ok(readingTimeElement, "Reading time element should be in document");
        const readingTimeText = readingTimeElement.textContent;
        ok(/\b1\b/.test(readingTimeText), "Reading time should be '~1 minute'");

        let container = content.document.querySelector(".container");
        ok(
          !container.hasAttribute("lang"),
          "Can't detect language, shouldn't set a lang attribute."
        );
      });
    }
  );
});

/**
 * Test that the reader mode correctly calculates and displays the
 * estimated reading time for a medium article where a single number
 * is displayed.
 */
add_task(async function () {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticleMedium.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );
      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;
      await SpecialPowers.spawn(browser, [], async function () {
        // make sure there is a reading time on the page and that it displays the correct information
        let readingTimeElement = content.document.querySelector(
          ".reader-estimated-time"
        );
        ok(readingTimeElement, "Reading time element should be in document");
        const readingTimeText = readingTimeElement.textContent;
        ok(
          /\b3\b/.test(readingTimeText),
          "Reading time should be '~3 minutes'"
        );
      });
    }
  );
});

/**
 * Test that the reader mode correctly calculates and displays the
 * estimated reading time for a long article where a single number
 * (hours) is displayed.
 */
add_task(async function () {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticleLong.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );
      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;
      await SpecialPowers.spawn(browser, [], async function () {
        // make sure there is a reading time on the page and that it displays the correct information
        let readingTimeElement = content.document.querySelector(
          ".reader-estimated-time"
        );
        ok(readingTimeElement, "Reading time element should be in document");
        const readingTimeText = readingTimeElement.textContent;
        ok(/\b2\b/.test(readingTimeText), "Reading time should be '~2 hours'");
      });
    }
  );
});

/**
 * Test that the reader mode correctly calculates and displays the
 * estimated reading time for a very long article where a range
 * (hours) is displayed.
 */
add_task(async function () {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticleVeryLong.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );
      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;
      await SpecialPowers.spawn(browser, [], async function () {
        // make sure there is a reading time on the page and that it displays the correct information
        let readingTimeElement = content.document.querySelector(
          ".reader-estimated-time"
        );
        ok(readingTimeElement, "Reading time element should be in document");
        const readingTimeText = readingTimeElement.textContent;
        ok(
          /\b3\b.*\b4\b/.test(readingTimeText),
          "Reading time should be '3-4 hours'"
        );
      });
    }
  );
});
