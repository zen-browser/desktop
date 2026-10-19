const SILENT_PAGE = GetTestWebBasedURL("file_silentAudioTrack.html");
const ALMOST_SILENT_PAGE = GetTestWebBasedURL(
  "file_almostSilentAudioTrack.html"
);

function check_audio_playing_state(isPlaying) {
  let autoPlay = content.document.getElementById("autoplay");
  if (!autoPlay) {
    ok(false, "Can't get the audio element!");
  }

  is(
    autoPlay.paused,
    !isPlaying,
    "The playing state of autoplay audio is correct."
  );

  // wait for a while to make sure the video is playing and related event has
  // been dispatched (if any).
  let PLAYING_TIME_SEC = 0.5;
  Assert.less(
    PLAYING_TIME_SEC,
    autoPlay.duration,
    "The playing time is valid."
  );

  return new Promise(resolve => {
    autoPlay.ontimeupdate = function () {
      if (autoPlay.currentTime > PLAYING_TIME_SEC) {
        resolve();
      }
    };
  });
}

add_task(async function should_not_show_sound_indicator_for_silent_video() {
  info("- open new foreground tab -");
  let tab = await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    "about:blank"
  );

  info("- tab should not have sound indicator before playing silent video -");
  await waitForTabSoundIndicatorDisappears(tab);

  info("- loading autoplay silent video -");
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, SILENT_PAGE);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await SpecialPowers.spawn(
    tab.linkedBrowser,
    [true],
    check_audio_playing_state
  );

  info("- tab should not have sound indicator after playing silent video -");
  await waitForTabSoundIndicatorDisappears(tab);

  info("- remove tab -");
  BrowserTestUtils.removeTab(tab);
});

add_task(
  async function should_not_show_sound_indicator_for_almost_silent_video() {
    info("- open new foreground tab -");
    let tab = await BrowserTestUtils.openNewForegroundTab(
      window.gBrowser,
      "about:blank"
    );

    info(
      "- tab should not have sound indicator before playing almost silent video -"
    );
    await waitForTabSoundIndicatorDisappears(tab);

    info("- loading autoplay almost silent video -");
    BrowserTestUtils.startLoadingURIString(
      tab.linkedBrowser,
      ALMOST_SILENT_PAGE
    );
    await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
    await SpecialPowers.spawn(
      tab.linkedBrowser,
      [true],
      check_audio_playing_state
    );

    info(
      "- tab should not have sound indicator after playing almost silent video -"
    );
    await waitForTabSoundIndicatorDisappears(tab);

    info("- remove tab -");
    BrowserTestUtils.removeTab(tab);
  }
);
