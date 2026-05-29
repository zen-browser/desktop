/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_BASE_URI = getResolvedURI(getRootDirectory(gTestPath)).spec;

let readerButton = document.getElementById("reader-mode-button");

/**
 * Reader mode should work on local files.
 */
add_task(async function test_readermode_available_for_local_files() {
  await BrowserTestUtils.withNewTab(
    TEST_BASE_URI + "readerModeArticle.html",
    async function (browser) {
      await TestUtils.waitForCondition(
        () => !readerButton.hidden,
        "Reader mode button should become visible"
      );

      is_element_visible(
        readerButton,
        "Reader mode button is present on a reader-able page"
      );

      // Switch page into reader mode.
      let promiseTabLoad = BrowserTestUtils.browserLoaded(browser);
      readerButton.click();
      await promiseTabLoad;

      let readerUrl = gBrowser.selectedBrowser.currentURI.spec;
      ok(
        readerUrl.startsWith("about:reader"),
        "about:reader loaded after clicking reader mode button"
      );
      is_element_visible(
        readerButton,
        "Reader mode button is present on about:reader"
      );

      is(
        gURLBar.untrimmedValue,
        TEST_BASE_URI + "readerModeArticle.html",
        "gURLBar value is about:reader URL"
      );
      is(
        gURLBar.value,
        gURLBar.untrimmedValue,
        "gURLBar is displaying original article URL"
      );
    }
  );
});
