const gExampleComRoot = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content/",
  "https://example.com/"
);
const IFRAME_FILE = "file_contentAreaClick_subframe_javascript.html";

add_task(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.link.alternative_click.block_javascript", false]],
  });

  await BrowserTestUtils.withNewTab(
    `data:text/html,<iframe src="${gExampleComRoot + IFRAME_FILE}"></iframe>`,
    async browser => {
      let newTabPromise = BrowserTestUtils.waitForNewTab(
        gBrowser,
        "about:blank"
      );
      let javascriptRanPromise = TestUtils.topicObserved(
        "contentAreaClick-javascriptRan"
      );

      // ctrl/cmd-click the link in the subframe. This should cause it to be
      // loaded in a new tab.
      info("Clicking link");
      let expectedRemoteType =
        browser.browsingContext.children[0].currentRemoteType;
      await BrowserTestUtils.synthesizeMouseAtCenter(
        "a",
        { ctrlKey: true, metaKey: true },
        browser.browsingContext.children[0]
      );

      info("Waiting for new tab");
      let newTab = await newTabPromise;

      info("Waiting to be notified that the javascript ran");
      await javascriptRanPromise;
      is(
        newTab.linkedBrowser.remoteType,
        expectedRemoteType,
        "new tab was loaded in expected process"
      );

      info("Removing the tab");
      BrowserTestUtils.removeTab(newTab);
    }
  );
});
