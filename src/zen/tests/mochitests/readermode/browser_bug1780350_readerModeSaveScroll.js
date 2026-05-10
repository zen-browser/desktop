/* eslint-disable @microsoft/sdl/no-insecure-url */
/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "http://example.com"
);

// This test verifies that when a link is clicked from
// within reader view, when navigating back to reader view
// the previous scroll position of the page is restored.
add_task(async function test_save_scroll_position() {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticleContainsLink.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );
      let browserLoadedPromise = BrowserTestUtils.browserLoaded(browser);
      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await Promise.all([pageShownPromise, browserLoadedPromise]);
      let scrollEventPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "scroll",
        true
      );
      // Set scroll position in reader to 200px down.
      await SpecialPowers.spawn(browser, [], async function () {
        content.document.documentElement.scrollTop = 200;
      });
      await scrollEventPromise;

      // Click linked page and check that scroll pos resets.
      await SpecialPowers.spawn(browser, [], async function () {
        let linkElement = content.document.getElementById("link");
        linkElement.click();
      });
      await BrowserTestUtils.browserLoaded(browser);
      await SpecialPowers.spawn(browser, [], async function () {
        is(
          content.document.documentElement.scrollTop,
          0,
          "vertical scroll position should reset to zero when navigating to linked page."
        );
        content.window.history.back();
      });

      // Navigate back to reader and check that scroll position is restored.
      await BrowserTestUtils.browserLoaded(browser);
      scrollEventPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "scroll",
        true
      );
      await scrollEventPromise;
      await SpecialPowers.spawn(browser, [], async function () {
        let doc = content.document;
        is(
          doc.documentElement.scrollTop,
          200,
          "should restore saved scroll position when navigating back from link."
        );
      });
    }
  );
});
