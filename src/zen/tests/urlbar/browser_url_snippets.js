/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
  UrlbarShared: "chrome://browser/content/urlbar/UrlbarShared.mjs",
  gZenUrlSnippets:
    "resource:///modules/zen/urlsnippets/ZenUrlSnippetsManager.sys.mjs",
});

UrlbarTestUtils.init(this);

add_setup(async function () {
  await gZenUrlSnippets.ready();
  await gZenUrlSnippets.resetStore();
  registerCleanupFunction(async () => {
    await gZenUrlSnippets.resetStore();
    await UrlbarTestUtils.promisePopupClose(window);
  });
});

async function openSnippetQuery(value) {
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus,
    value,
  });
  await UrlbarTestUtils.promiseSearchComplete(window);
}

add_task(async function test_greater_than_yt_opens_youtube_snippet() {
  await openSnippetQuery(">yt");

  Assert.equal(
    gURLBar.searchMode?.source,
    UrlbarShared.RESULT_SOURCE.SNIPPETS,
    "A leading > enters snippets mode"
  );
  Assert.equal(gURLBar.value, "yt", "The > token is consumed");

  const count = UrlbarTestUtils.getResultCount(window);
  Assert.greater(count, 0, "Snippets mode shows results");
  const first = await UrlbarTestUtils.getDetailsOfResultAt(window, 0);
  Assert.equal(
    first.result.providerName,
    "ZenUrlbarProviderSnippets",
    "The first row is a snippet"
  );
  Assert.equal(
    first.result.payload.url,
    "https://youtube.com",
    ">yt resolves to YouTube"
  );
  Assert.equal(first.result.heuristic, true, "The exact shortcut is selected");

  await UrlbarTestUtils.promisePopupClose(window);
  gURLBar.searchMode = null;
});

add_task(async function test_prefix_still_matches_youtube() {
  await openSnippetQuery(">y");
  const first = await UrlbarTestUtils.getDetailsOfResultAt(window, 0);
  Assert.equal(first.result.payload.url, "https://youtube.com");
  await UrlbarTestUtils.promisePopupClose(window);
  gURLBar.searchMode = null;
});

add_task(async function test_plain_query_does_not_insert_snippets() {
  await openSnippetQuery("yt");
  Assert.ok(!gURLBar.searchMode, "A query without > stays out of snippets mode");
  const count = UrlbarTestUtils.getResultCount(window);
  for (let i = 0; i < count; i++) {
    const details = await UrlbarTestUtils.getDetailsOfResultAt(window, i);
    Assert.notEqual(
      details.result.providerName,
      "ZenUrlbarProviderSnippets",
      "Snippet rows are not inserted without >"
    );
  }
  await UrlbarTestUtils.promisePopupClose(window);
});

add_task(async function test_enter_loads_the_snippet_url() {
  const [youtube] = gZenUrlSnippets.getAll();
  youtube.url = "http://example.com/";
  await gZenUrlSnippets.update(youtube);

  await openSnippetQuery(">yt");
  const loaded = BrowserTestUtils.browserLoaded(
    gBrowser.selectedBrowser,
    false,
    "http://example.com/"
  );
  EventUtils.synthesizeKey("KEY_Enter");
  await loaded;
  Assert.equal(
    gBrowser.selectedBrowser.currentURI.spec,
    "http://example.com/",
    "Enter loads the snippet URL"
  );
});
