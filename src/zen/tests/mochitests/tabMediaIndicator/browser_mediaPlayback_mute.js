const PAGE = GetTestWebBasedURL("file_mediaPlayback2.html");
const FRAME = GetTestWebBasedURL("file_mediaPlaybackFrame2.html");

function wait_for_event(browser, event) {
  return BrowserTestUtils.waitForEvent(browser, event, false, e => {
    is(
      e.originalTarget,
      browser,
      "Event must be dispatched to correct browser."
    );
    return true;
  });
}

function test_audio_in_browser() {
  function get_audio_element() {
    var doc = content.document;
    var list = doc.getElementsByTagName("audio");
    if (list.length == 1) {
      return list[0];
    }

    // iframe?
    list = doc.getElementsByTagName("iframe");

    var iframe = list[0];
    list = iframe.contentDocument.getElementsByTagName("audio");
    return list[0];
  }

  var audio = get_audio_element();
  return {
    computedVolume: audio.computedVolume,
    computedMuted: audio.computedMuted,
  };
}

async function test_on_browser(url, browser) {
  BrowserTestUtils.startLoadingURIString(browser, url);
  await wait_for_event(browser, "DOMAudioPlaybackStarted");

  var result = await SpecialPowers.spawn(browser, [], test_audio_in_browser);
  is(result.computedVolume, 1, "Audio volume is 1");
  is(result.computedMuted, false, "Audio is not muted");

  ok(!browser.audioMuted, "Audio should not be muted by default");
  browser.mute();
  ok(browser.audioMuted, "Audio should be muted now");

  await wait_for_event(browser, "DOMAudioPlaybackStopped");

  result = await SpecialPowers.spawn(browser, [], test_audio_in_browser);
  is(result.computedVolume, 0, "Audio volume is 0 when muted");
  is(result.computedMuted, true, "Audio is muted");
}

async function test_visibility(url, browser) {
  BrowserTestUtils.startLoadingURIString(browser, url);
  await wait_for_event(browser, "DOMAudioPlaybackStarted");

  var result = await SpecialPowers.spawn(browser, [], test_audio_in_browser);
  is(result.computedVolume, 1, "Audio volume is 1");
  is(result.computedMuted, false, "Audio is not muted");

  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:blank",
    },
    function () {}
  );

  ok(!browser.audioMuted, "Audio should not be muted by default");
  browser.mute();
  ok(browser.audioMuted, "Audio should be muted now");

  await wait_for_event(browser, "DOMAudioPlaybackStopped");

  result = await SpecialPowers.spawn(browser, [], test_audio_in_browser);
  is(result.computedVolume, 0, "Audio volume is 0 when muted");
  is(result.computedMuted, true, "Audio is muted");
}

add_task(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["media.useAudioChannelService.testing", true]],
  });
});

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

add_task(async function test_frame() {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:blank",
    },
    test_visibility.bind(undefined, PAGE)
  );
});
