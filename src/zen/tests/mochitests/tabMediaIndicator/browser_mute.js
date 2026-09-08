const PAGE = "data:text/html,page";

function test_on_browser(browser) {
  ok(!browser.audioMuted, "Audio should not be muted by default");
  browser.browsingContext.mediaController.mute();
  ok(browser.audioMuted, "Audio should be muted now");
  browser.browsingContext.mediaController.unmute();
  ok(!browser.audioMuted, "Audio should be unmuted now");
}

add_task(async function () {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: PAGE,
    },
    test_on_browser
  );
});
