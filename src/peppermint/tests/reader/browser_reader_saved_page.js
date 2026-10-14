/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SAVED_URL = "https://example.com/never-served-by-the-network";

add_setup(async function () {
  await resetStore();
  registerCleanupFunction(resetStore);
});

function listedTitles(browser) {
  return SpecialPowers.spawn(browser, [], () =>
    [...content.document.querySelectorAll(".saved-item-title")].map(
      node => node.textContent
    )
  );
}

add_task(async function test_saved_page_lists_opens_and_removes() {
  await Store.saveArticle({
    url: SAVED_URL,
    title: "First saved",
    byline: "Someone",
    excerpt: "A short summary",
    content: "<p>Saved body text that is long enough to read.</p>",
    readingTimeMinsSlow: 3,
    readingTimeMinsFast: 2,
  });

  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:saved"
  );
  const browser = tab.linkedBrowser;

  await TestUtils.waitForCondition(
    async () => (await listedTitles(browser)).length === 1,
    "The saved article is listed"
  );
  Assert.deepEqual(await listedTitles(browser), ["First saved"]);

  // Search narrows the list.
  await SpecialPowers.spawn(browser, [], async () => {
    const search = content.document.getElementById("saved-search");
    search.value = "nothing matches this";
    search.dispatchEvent(new content.Event("input", { bubbles: true }));
  });
  Assert.deepEqual(await listedTitles(browser), [], "The search hides it");
  await SpecialPowers.spawn(browser, [], async () => {
    const search = content.document.getElementById("saved-search");
    search.value = "";
    search.dispatchEvent(new content.Event("input", { bubbles: true }));
  });
  Assert.deepEqual(await listedTitles(browser), ["First saved"]);

  // Opening it shows the saved copy; the address would not load otherwise.
  const loaded = BrowserTestUtils.browserLoaded(browser);
  await SpecialPowers.spawn(browser, [], () => {
    content.document.querySelector(".saved-link").click();
  });
  await loaded;
  ok(
    browser.currentURI.spec.startsWith("about:reader?"),
    "The article opened in Reader Mode"
  );
  await waitForReaderContent(browser);
  const state = await readerState(browser);
  ok(!state.error, "It opened without downloading the page");
  is(state.title, "First saved", "It shows the saved title");
  ok(state.text.includes("Saved body text"), "It shows the saved text");

  // Back on the list, removing the article empties it.
  const back = BrowserTestUtils.waitForLocationChange(gBrowser, "about:saved");
  gBrowser.goBack();
  await back;
  await TestUtils.waitForCondition(
    async () => (await listedTitles(browser)).length === 1,
    "The list is back"
  );
  await SpecialPowers.spawn(browser, [], () => {
    content.document.querySelector(".saved-remove").click();
  });
  await TestUtils.waitForCondition(
    async () => (await listedTitles(browser)).length === 0,
    "The removed article is gone from the list"
  );
  await SpecialPowers.spawn(browser, [], () => {
    ok(
      !content.document.getElementById("saved-empty").hidden,
      "The empty state shows"
    );
  });
  is((await Store.listArticles()).length, 0, "It is gone from the store too");

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_clear_all_asks_twice() {
  await Store.saveArticle({
    url: `${SAVED_URL}-1`,
    title: "One",
    content: "<p>One</p>",
  });
  await Store.saveArticle({
    url: `${SAVED_URL}-2`,
    title: "Two",
    content: "<p>Two</p>",
  });
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:saved"
  );
  const browser = tab.linkedBrowser;
  await TestUtils.waitForCondition(
    async () => (await listedTitles(browser)).length === 2,
    "Both articles are listed"
  );

  const click = () =>
    SpecialPowers.spawn(browser, [], () =>
      content.document.getElementById("saved-clear").click()
    );
  await click();
  is((await Store.listArticles()).length, 2, "The first click only asks");
  await click();
  await TestUtils.waitForCondition(
    async () => (await Store.listArticles()).length === 0,
    "The second click clears everything"
  );
  BrowserTestUtils.removeTab(tab);
});
