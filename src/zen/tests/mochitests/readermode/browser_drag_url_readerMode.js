/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

add_task(async function test_readerModeURLDrag() {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: TEST_PATH + "readerModeArticle.html",
    },

    async browser => {
      let readerButton = document.getElementById("reader-mode-button");
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
      let urlbar = gURLBar.inputField;
      let readerUrl = gBrowser.selectedBrowser.currentURI.spec;
      ok(
        readerUrl.startsWith("about:reader"),
        "about:reader loaded after clicking reader mode button"
      );

      let dataTran = new DataTransfer();
      let urlEvent = new DragEvent("dragstart", { dataTransfer: dataTran });
      let oldUrl = TEST_PATH + "readerModeArticle.html";
      let urlBarContainer = gURLBar.querySelector(".urlbar-input-container");
      // We intentionally turn off a11y_checks for the following click, because
      // it is send to prepare the URL Bar for the mouse-specific action - for a
      // drag event, while there are other ways are accessible for users of
      // assistive technology and keyboards, therefore this test can be excluded
      // from the accessibility tests.
      AccessibilityUtils.setEnv({ mustHaveAccessibleRule: false });
      urlBarContainer.click();
      AccessibilityUtils.resetEnv();
      urlbar.dispatchEvent(urlEvent);

      let newUrl = urlEvent.dataTransfer.getData("text/plain");
      ok(!newUrl.includes("about:reader"), "URL does not contain about:reader");

      Assert.equal(newUrl, oldUrl, "URL is the same");
    }
  );
});
