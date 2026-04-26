/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

const TEST_URL = TEST_PATH + "readerModeArticle.html";

add_task(async function test_TODO() {
  await BrowserTestUtils.withNewTab(
    "data:text/html,<p>Opener",
    async browser => {
      let newTabPromise = BrowserTestUtils.waitForNewTab(
        gBrowser,
        TEST_URL,
        true
      );
      await SpecialPowers.spawn(browser, [TEST_URL], url => {
        content.eval(`window.x = open("${url}", "_blank");`);
      });
      let newTab = await newTabPromise;

      let readerButton = document.getElementById("reader-mode-button");
      await BrowserTestUtils.waitForMutationCondition(
        readerButton,
        { attributes: true },
        () => !readerButton.hidden
      );
      let tabLoaded = BrowserTestUtils.browserLoaded(newTab.linkedBrowser);
      readerButton.click();
      await tabLoaded;
      isnot(
        newTab.linkedBrowser.browsingContext.group.id,
        browser.browsingContext.group.id,
        "BC should be in a different group now."
      );
      BrowserTestUtils.removeTab(newTab);
    }
  );
});
