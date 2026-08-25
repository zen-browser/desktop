ChromeUtils.defineESModuleGetters(this, {
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
});

add_task(async function () {
  await BrowserTestUtils.withNewTab(
    "http://example.com",
    async function (aBrowser) {
      let tab = gBrowser.getTabForBrowser(aBrowser);
      await TabStateFlusher.flush(aBrowser);
      let before = TabStateCache.get(aBrowser.permanentKey);

      let newTab = SessionStore.duplicateTab(window, tab);
      await Promise.all([
        BrowserTestUtils.browserLoaded(newTab.linkedBrowser),
        TestUtils.topicObserved("sessionstore-debug-tab-restored"),
      ]);
      let after = TabStateCache.get(newTab.linkedBrowser.permanentKey);

      isnot(
        before.history.entries,
        after.history.entries,
        "The entry objects should not be shared"
      );

      BrowserTestUtils.removeTab(newTab);
    }
  );
});
