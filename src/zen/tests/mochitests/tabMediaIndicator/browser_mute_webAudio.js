// The tab closing code leaves an uncaught rejection. This test has been
// whitelisted until the issue is fixed.
if (!gMultiProcessBrowser) {
  const { PromiseTestUtils } = ChromeUtils.importESModule(
    "resource://testing-common/PromiseTestUtils.sys.mjs"
  );
  PromiseTestUtils.expectUncaughtRejection(/is no longer, usable/);
}

const PAGE = GetTestWebBasedURL("file_webAudio.html");

function start_webAudio() {
  var startButton = content.document.getElementById("start");
  if (!startButton) {
    ok(false, "Can't get the start button!");
  }

  startButton.click();
}

function stop_webAudio() {
  var stopButton = content.document.getElementById("stop");
  if (!stopButton) {
    ok(false, "Can't get the stop button!");
  }

  stopButton.click();
}

add_task(async function setup_test_preference() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["media.useAudioChannelService.testing", true],
      ["media.block-autoplay-until-in-foreground", true],
    ],
  });
});

add_task(async function mute_web_audio() {
  info("- open new tab -");
  let tab = await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    "about:blank"
  );
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, PAGE);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  info("- tab should be audible -");
  await waitForTabSoundIndicatorAppears(tab);

  info("- mute browser -");
  ok(!tab.linkedBrowser.audioMuted, "Audio should not be muted by default");
  await clickIcon(tab.audioButton);
  ok(tab.linkedBrowser.audioMuted, "Audio should be muted now");

  info("- stop web audip -");
  await SpecialPowers.spawn(tab.linkedBrowser, [], stop_webAudio);

  info("- start web audio -");
  await SpecialPowers.spawn(tab.linkedBrowser, [], start_webAudio);

  info("- unmute browser -");
  ok(tab.linkedBrowser.audioMuted, "Audio should be muted now");
  await clickIcon(tab.audioButton);
  ok(!tab.linkedBrowser.audioMuted, "Audio should be unmuted now");

  info("- tab should be audible -");
  await waitForTabSoundIndicatorAppears(tab);

  info("- remove tab -");
  BrowserTestUtils.removeTab(tab);
});
