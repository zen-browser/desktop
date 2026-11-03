/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

/**
 * Test tab navigation through the main toolbar and to the site domain link.
 */
add_task(async function test_tabnavigation() {
  // Open a browser tab, enter reader mode, and test if the reset button
  // restores the page layout to the default pref values.
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

      await SpecialPowers.spawn(browser, [], async () => {
        let doc = content.document;
        await ContentTaskUtils.waitForCondition(() =>
          doc.querySelector(".narrate-toggle:not([hidden])")
        );
        function ensureFocusOrder(list, shiftKey = false) {
          let first = list.shift();
          first.focus();
          while (list.length) {
            let next = list.shift();
            EventUtils.synthesizeKey("KEY_Tab", { shiftKey }, content);
            is(
              doc.activeElement,
              next,
              `Focus should be on ${next.className}, was on ${doc.activeElement?.className}`
            );
          }
        }
        let expectedFocuses = Array.from(
          doc.querySelectorAll(".toolbar-button")
        ).filter(n => !n.matches("[hidden] *"));
        expectedFocuses.push(doc.querySelector(".reader-domain"));

        ensureFocusOrder(Array.from(expectedFocuses));

        let reversed = Array.from(expectedFocuses);
        reversed.reverse();
        ensureFocusOrder(reversed, true);
      });
    }
  );
});
