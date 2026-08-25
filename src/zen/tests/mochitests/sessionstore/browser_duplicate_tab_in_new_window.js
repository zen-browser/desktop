ChromeUtils.defineESModuleGetters(this, {
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
});

add_task(async function () {
  await BrowserTestUtils.withNewTab(
    "https://example.com",
    async function (aBrowser) {
      BrowserTestUtils.startLoadingURIString(aBrowser, "https://example.org");
      await BrowserTestUtils.browserLoaded(aBrowser);

      let windowOpened = BrowserTestUtils.waitForNewWindow(
        "https://example.org"
      );
      let newWindow = gBrowser.replaceTabWithWindow(
        gBrowser.getTabForBrowser(aBrowser)
      );
      await windowOpened;
      let newTab = SessionStore.duplicateTab(
        newWindow,
        newWindow.gBrowser.selectedTab
      );

      await BrowserTestUtils.browserLoaded(newTab.linkedBrowser);

      await SpecialPowers.spawn(
        newTab.linkedBrowser,
        ["https://example.org"],
        async ORIGIN => {
          is(content.window.origin, ORIGIN);
        }
      );

      BrowserTestUtils.closeWindow(newWindow);
    }
  );
});
