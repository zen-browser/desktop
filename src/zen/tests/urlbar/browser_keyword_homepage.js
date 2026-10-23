/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  ProvidersManager:
    "moz-src:///browser/components/urlbar/UrlbarProvidersManager.sys.mjs",
  UrlbarShared: "chrome://browser/content/urlbar/UrlbarShared.mjs",
  UrlbarResult: "chrome://browser/content/urlbar/UrlbarResult.mjs",
  SearchService: "moz-src:///toolkit/components/search/SearchService.sys.mjs",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
  UrlbarUtils: "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs",
});

add_task(async function test_keyword_homepage() {
  await SearchService.init();
  await SpecialPowers.pushPrefEnv({
    set: [["browser.search.suggest.enabled", false]],
  });
  const engines = [];
  const originalOpen = window.openTrustedLinkIn;
  const opened = [];
  window.openTrustedLinkIn = (url, where, options) => {
    opened.push({ url, where, options });
  };
  try {
    for (const keyword of ["yt", "gh", "go", "@youtube"]) {
      engines.push(
        await SearchService.addUserEngine({
          name: `Keyword homepage ${keyword}`,
          alias: keyword,
          url: "https://example.com/search?q={searchTerms}",
        })
      );
    }
    const fixture = getRootDirectory(gTestPath).replace(
      "chrome://mochitests/content",
      "https://example.com"
    );
    const postEngine = await SearchService.addOpenSearchEngine(
      `${fixture}keyword-homepage-post.xml`
    );
    postEngine.alias = "post";
    engines.push(postEngine);
    Assert.equal(
      postEngine.searchForm,
      "https://example.com/catalog/",
      "An engine can specify a homepage below its origin"
    );

    for (const engine of engines) {
      for (const query of ["rust & café #1", "", "   "]) {
        await gURLBar.setSearchMode(null, gBrowser.selectedBrowser);
        await UrlbarTestUtils.promiseAutocompleteResultPopup({
          window,
          waitForFocus,
          value: `${engine.alias} ${query}`,
        });
        await UrlbarTestUtils.promiseSearchComplete(window);
        Assert.equal(gURLBar.searchMode?.engineName, engine.name);
        const count = opened.length;
        EventUtils.synthesizeKey("KEY_Enter");
        await TestUtils.waitForCondition(() => opened.length > count);
        const navigation = opened.at(-1);
        if (query.trim()) {
          const submission = engine.getSubmission(query);
          Assert.equal(
            navigation.url,
            submission.uri.spec,
            `${engine.alias} preserves its native search submission`
          );
          Assert.equal(
            !!navigation.options.postData,
            !!submission.postData,
            `${engine.alias} preserves the search method`
          );
          if (submission.postData) {
            const actual = navigation.options.postData;
            const expected = submission.postData;
            Assert.equal(
              NetUtil.readInputStreamToString(actual, actual.available()),
              NetUtil.readInputStreamToString(expected, expected.available()),
              "The POST body preserves the query"
            );
          }
        } else {
          Assert.equal(
            navigation.url,
            engine.searchForm,
            `${engine.alias} opens its homepage for ${JSON.stringify(query)}`
          );
          Assert.ok(
            !navigation.options.postData,
            "Homepage navigation has no search POST body"
          );
        }
        Assert.equal(navigation.where, "current");
        await UrlbarTestUtils.promisePopupClose(window);
      }
      const [url, postData] = UrlbarUtils.getSearchQueryUrl(engine, "");
      const submission = engine.getSubmission("");
      Assert.equal(
        url,
        submission.uri.spec,
        "Other empty searches stay native"
      );
      Assert.equal(!!postData, !!submission.postData);
    }

    const engine = engines[0];
    const suggestion = new UrlbarResult({
      type: UrlbarShared.RESULT_TYPE.SEARCH,
      source: UrlbarShared.RESULT_SOURCE.SEARCH,
      payload: {
        engine: engine.name,
        query: "",
        suggestion: "selected suggestion",
      },
    });
    const provider = new UrlbarTestUtils.TestProvider({
      results: [suggestion],
      priority: 1,
    });
    const manager = ProvidersManager.getInstanceForSap("urlbar");
    manager.registerProvider(provider);
    try {
      await gURLBar.setSearchMode(
        {
          engineName: engine.name,
          entry: "keyword",
          source: UrlbarShared.RESULT_SOURCE.SEARCH,
        },
        gBrowser.selectedBrowser
      );
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window,
        waitForFocus,
        value: "",
      });
      const index = UrlbarTestUtils.getResultCount(window) - 1;
      const row = await UrlbarTestUtils.getRowAt(window, index);
      Assert.equal(row.result.payload.suggestion, "selected suggestion");
      UrlbarTestUtils.setSelectedRowIndex(window, index);
      const count = opened.length;
      EventUtils.synthesizeKey("KEY_Enter");
      await TestUtils.waitForCondition(() => opened.length > count);
      Assert.equal(
        opened.at(-1).url,
        engine.getSubmission("selected suggestion").uri.spec,
        "An explicitly selected suggestion still searches"
      );
      await UrlbarTestUtils.promisePopupClose(window);
    } finally {
      manager.unregisterProvider(provider);
    }

    const privateWindow = await BrowserTestUtils.openNewBrowserWindow({
      private: true,
    });
    const originalPrivateOpen = privateWindow.openTrustedLinkIn;
    privateWindow.openTrustedLinkIn = (url, where, options) =>
      opened.push({ url, where, options });
    try {
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window: privateWindow,
        waitForFocus,
        value: "yt ",
      });
      Assert.equal(privateWindow.gURLBar.searchMode?.engineName, engine.name);
      const count = opened.length;
      EventUtils.synthesizeKey("KEY_Enter", {}, privateWindow);
      await TestUtils.waitForCondition(() => opened.length > count);
      Assert.equal(
        opened.at(-1).url,
        engine.searchForm,
        "Private search mode opens the homepage"
      );
      Assert.equal(opened.at(-1).where, "current");
    } finally {
      privateWindow.openTrustedLinkIn = originalPrivateOpen;
      await BrowserTestUtils.closeWindow(privateWindow);
    }

    await gURLBar.setSearchMode(null, gBrowser.selectedBrowser);
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value: "yt ",
    });
    const programmaticCount = opened.length;
    gURLBar.handleCommand();
    await TestUtils.waitForTick();
    Assert.equal(
      opened.length,
      programmaticCount + 1,
      "A command without an event opens the homepage"
    );
    Assert.equal(opened.at(-1).url, engine.searchForm);
    await UrlbarTestUtils.promisePopupClose(window);

    await gURLBar.setSearchMode(null, gBrowser.selectedBrowser);
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value: "",
    });
    const count = opened.length;
    EventUtils.synthesizeKey("KEY_Enter");
    await TestUtils.waitForTick();
    Assert.equal(
      opened.length,
      count,
      "Empty input without search mode does not navigate"
    );
    await UrlbarTestUtils.promisePopupClose(window);
  } finally {
    window.openTrustedLinkIn = originalOpen;
    await gURLBar.setSearchMode(null, gBrowser.selectedBrowser);
    await UrlbarTestUtils.promisePopupClose(window);
    for (const engine of engines) {
      await SearchService.removeEngine(engine);
    }
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_background_homepage_restores_input() {
  const engine = await SearchService.addUserEngine({
    name: "Background keyword homepage",
    alias: "backgroundhome",
    url: "https://example.com/?q={searchTerms}",
  });
  try {
    await BrowserTestUtils.withNewTab("about:robots", async browser => {
      const originalTab = gBrowser.selectedTab;
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window,
        waitForFocus,
        value: "backgroundhome ",
      });
      const opened = BrowserTestUtils.waitForNewTab(
        gBrowser,
        new URL(engine.searchForm).href,
        true
      );
      EventUtils.synthesizeKey("KEY_Enter", { altKey: true, shiftKey: true });
      const tab = await opened;
      try {
        Assert.equal(
          gBrowser.selectedTab,
          originalTab,
          "The original tab stays selected"
        );
        Assert.equal(
          gURLBar.value,
          "about:robots",
          "The original URL is restored"
        );
        Assert.equal(
          gURLBar.searchMode,
          null,
          "The original search mode is cleared"
        );
        Assert.equal(
          browser.userTypedValue,
          null,
          "The original typed input is cleared"
        );
      } finally {
        BrowserTestUtils.removeTab(tab);
      }
    });
  } finally {
    await SearchService.removeEngine(engine);
  }
});
