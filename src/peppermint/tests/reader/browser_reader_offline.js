/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  await resetStore();
  registerCleanupFunction(async () => {
    Services.io.offline = false;
    await resetStore();
  });
});

add_task(function test_ids_ignore_the_fragment() {
  const id = Store.articleIdFor("https://example.com/a#one");
  ok(Store.ID_PATTERN.test(id), "The id is a SHA-256 hex digest");
  is(id, Store.articleIdFor("https://example.com/a#two"), "Same page, same id");
  isnot(
    id,
    Store.articleIdFor("https://example.com/b"),
    "Another page differs"
  );
  is(Store.articleIdFor("about:blank"), null, "about: pages have no id");
  is(Store.normalizeUrl("https://example.com/a#one"), "https://example.com/a");
});

add_task(async function test_save_remove_and_read_offline() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    ARTICLE_URL
  );
  await enterReaderMode(tab);

  ok(
    PeppermintReader.canSaveCurrent(window),
    "An article in Reader Mode can be saved"
  );
  await TestUtils.waitForCondition(
    () => !saveButton().disabled,
    "The save button is enabled in Reader Mode"
  );
  ok(!saveButton().classList.contains("active"), "It is not saved yet");

  is(await PeppermintReader.toggleSaveCurrent(window), "saved", "Saving works");
  const records = await Store.listArticles();
  is(records.length, 1, "One article is saved");
  is(records[0].url, ARTICLE_URL, "It is stored under the page's address");
  is(records[0].title, ARTICLE_TITLE, "The title is kept");

  const saved = await Store.getArticle(ARTICLE_URL);
  ok(
    saved.content.includes('data-peppermint-src="data:image/svg+xml;base64,'),
    "The picture is stored inline"
  );
  await TestUtils.waitForCondition(
    () => saveButton().classList.contains("active"),
    "The button shows the article as saved"
  );

  // Saving the same page again replaces it instead of adding a copy.
  is(
    await PeppermintReader.toggleSaveCurrent(window),
    "removed",
    "Toggling removes"
  );
  is((await Store.listArticles()).length, 0, "Nothing is saved after removing");
  ok(!(await Store.hasArticle(ARTICLE_URL)), "The article is gone");
  is(
    await PeppermintReader.toggleSaveCurrent(window),
    "saved",
    "Saving again works"
  );
  is((await Store.listArticles()).length, 1, "Still a single copy");

  BrowserTestUtils.removeTab(tab);

  Services.io.offline = true;
  try {
    const offlineTab = await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      readerUrl(ARTICLE_URL)
    );
    await waitForReaderContent(offlineTab.linkedBrowser);
    const state = await readerState(offlineTab.linkedBrowser);
    ok(!state.error, "The saved article opens with no connection");
    is(state.title, ARTICLE_TITLE, "It shows the saved title");
    ok(
      state.text.includes("Reader Mode lets a person read"),
      "It shows the saved text"
    );
    ok(
      state.imageSrc.startsWith("data:image/svg+xml"),
      "The saved picture shows without a connection"
    );
    BrowserTestUtils.removeTab(offlineTab);

    // The test server is on loopback, which offline mode does not block, so
    // this page loads live. It must still never show the saved snapshot.
    const otherTab = await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      readerUrl(`${ARTICLE_URL}?not-saved`)
    );
    await waitForReaderContent(otherTab.linkedBrowser);
    ok(
      !(await readerState(otherTab.linkedBrowser)).imageSrc.startsWith("data:"),
      "A page that was not saved never shows another page's saved copy"
    );
    ok(
      !(await Store.hasArticle(`${ARTICLE_URL}?not-saved`)),
      "It is not saved"
    );
    BrowserTestUtils.removeTab(otherTab);
  } finally {
    Services.io.offline = false;
  }
});

add_task(async function test_private_windows_do_not_save() {
  const privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  ok(
    !PeppermintReader.canSaveCurrent(privateWindow),
    "No saving in a private window"
  );
  await Assert.rejects(
    Store.saveArticle(
      { url: ARTICLE_URL, title: "Private", content: "<p>secret</p>" },
      { isPrivate: true }
    ),
    /private/,
    "The store refuses articles read privately"
  );
  await BrowserTestUtils.closeWindow(privateWindow);
});
