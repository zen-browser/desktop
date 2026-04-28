const PAGE = GetTestWebBasedURL("file_mediaPlayback.html");
const FRAME = GetTestWebBasedURL("file_mediaPlaybackFrame.html");

function wait_for_event(browser, event) {
  return BrowserTestUtils.waitForEvent(browser, event, false, e => {
    is(
      e.originalTarget,
      browser,
      "Event must be dispatched to correct browser."
    );
    ok(!e.cancelable, "The event should not be cancelable");
    return true;
  });
}

async function test_on_browser(url, browser) {
  info(`run test for ${url}`);
  const startPromise = wait_for_event(browser, "DOMAudioPlaybackStarted");
  BrowserTestUtils.startLoadingURIString(browser, url);
  await startPromise;
  await wait_for_event(browser, "DOMAudioPlaybackStopped");
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
