/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_reader_button_on_a_page_that_is_not_an_article() {
  await BrowserTestUtils.withNewTab(PLAIN_URL, async browser => {
    await TestUtils.waitForCondition(
      () => !readerButton().hidden,
      "The Reader Mode button shows on a page with a little text"
    );
    ok(!browser.isArticle, "Firefox's own check does not call it an article");
    ok(
      !document.getElementById("key_toggleReaderMode").hasAttribute("disabled"),
      "The shortcut is enabled too"
    );
  });
});

add_task(async function test_reader_button_hidden_on_internal_pages() {
  await BrowserTestUtils.withNewTab("about:blank", async () => {
    await TestUtils.waitForCondition(
      () => readerButton().hidden,
      "No Reader Mode button on about:blank"
    );
  });
});

add_task(async function test_eligibility() {
  await BrowserTestUtils.withNewTab(PLAIN_URL, async browser => {
    ok(Availability.isReaderEligible(browser), "A web page is eligible");
    await SpecialPowers.pushPrefEnv({
      set: [["peppermint.reader.always-available", false]],
    });
    ok(
      !Availability.isReaderEligible(browser),
      "The pref turns the wider availability off"
    );
    await SpecialPowers.popPrefEnv();
  });

  await BrowserTestUtils.withNewTab("about:blank", async browser => {
    ok(!Availability.isReaderEligible(browser), "about: pages are not");
  });

  ok(Availability.isSavableUrl("https://example.com/a"), "https is savable");
  ok(!Availability.isSavableUrl("about:reader?url=x"), "about: is not");
  ok(!Availability.isSavableUrl("data:text/html,hi"), "data: is not");
});

add_task(async function test_page_can_be_opened_in_reader_mode() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PLAIN_URL);
  await enterReaderMode(tab);
  ok(
    gBrowser.selectedBrowser.currentURI.spec.startsWith("about:reader?"),
    "The page opened in Reader Mode"
  );
  BrowserTestUtils.removeTab(tab);
});
