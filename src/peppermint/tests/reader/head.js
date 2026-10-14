/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PeppermintReader } = ChromeUtils.importESModule(
  "moz-src:///peppermint/reader/PeppermintReader.sys.mjs"
);
const Store = ChromeUtils.importESModule(
  "moz-src:///peppermint/reader/PeppermintReaderStore.sys.mjs"
);
const Availability = ChromeUtils.importESModule(
  "moz-src:///peppermint/reader/PeppermintReaderAvailability.sys.mjs"
);

const FIXTURES = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);
const ARTICLE_URL = `${FIXTURES}fixtures/article.html`;
const PLAIN_URL = `${FIXTURES}fixtures/plain.html`;
const ARTICLE_TITLE = "Peppermint offline article";

function readerButton() {
  return document.getElementById("reader-mode-button");
}

function saveButton() {
  return document.getElementById("peppermint-reader-save-button");
}

function readerUrl(url) {
  return `about:reader?url=${encodeURIComponent(url)}`;
}

/**
 * Wait until the reader page has either shown its article or given up.
 *
 * @param {XULBrowserElement} browser
 */
function waitForReaderContent(browser) {
  return SpecialPowers.spawn(browser, [], async () => {
    await ContentTaskUtils.waitForCondition(
      () =>
        content.document.body?.classList.contains("loaded") ||
        content.document.documentElement.dataset.isError,
      "The reader page finished loading"
    );
  });
}

/**
 * Turn Reader Mode on in a tab with the toolbar button, as a user would.
 *
 * @param {object} tab
 */
async function enterReaderMode(tab) {
  await TestUtils.waitForCondition(
    () => !readerButton().hidden,
    "The Reader Mode button is available"
  );
  const loaded = BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  readerButton().click();
  await loaded;
  await waitForReaderContent(tab.linkedBrowser);
}

/**
 * @param {XULBrowserElement} browser - A browser showing about:reader
 * @returns {Promise<object>} What the reader page shows
 */
function readerState(browser) {
  return SpecialPowers.spawn(browser, [], () => {
    const doc = content.document;
    return {
      error: !!doc.documentElement.dataset.isError,
      title: doc.querySelector(".reader-title")?.textContent ?? "",
      text: doc.querySelector(".moz-reader-content")?.textContent ?? "",
      imageSrc: doc.querySelector(".moz-reader-content img")?.src ?? "",
    };
  });
}

async function resetStore() {
  await Store.flushStore();
  await Store.clearArticles();
}
