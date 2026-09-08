const PAGE = GetTestWebBasedURL("file_mediaPlayback.html");
const FRAME = GetTestWebBasedURL("file_mediaPlaybackFrame.html");

async function test_on_browser(url, browser) {
  info(`run test for ${url}`);
  const tab = gBrowser.getTabForBrowser(browser);
  const startPromise = waitForTabSoundIndicatorAppears(tab);
  BrowserTestUtils.startLoadingURIString(browser, url);
  await startPromise;
  await waitForTabSoundIndicatorDisappears(tab);
}

add_task(async function test_page() {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:blank",
    },
    test_on_browser.bind(undefined, PAGE)
  );
});

add_task(async function test_frame() {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:blank",
    },
    test_on_browser.bind(undefined, FRAME)
  );
});
