/**
 * When media changes its audible state, the sound indicator should be
 * updated as well, which should appear only when web audio is audible.
 */
add_task(async function testUpdateSoundIndicatorWhenMediaPlaybackChanges() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab();
  await initMediaPlaybackDocument(tab, "audio.ogg");

  info(`sound indicator should appear when audible audio starts playing`);
  await playMedia(tab);
  await waitForTabSoundIndicatorAppears(tab);

  info(`sound indicator should disappear when audio stops playing`);
  await pauseMedia(tab);
  await waitForTabSoundIndicatorDisappears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testUpdateSoundIndicatorWhenMediaBecomeSilent() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab();
  await initMediaPlaybackDocument(tab, "audioEndedDuringPlaying.webm");

  info(`sound indicator should appear when audible audio starts playing`);
  await playMedia(tab);
  await waitForTabSoundIndicatorAppears(tab);

  info(`sound indicator should disappear when audio becomes silent`);
  await waitForTabSoundIndicatorDisappears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testSoundIndicatorWouldWorkForMediaWithoutPreload() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab();
  await initMediaPlaybackDocument(tab, "audio.ogg", { preload: "none" });

  info(`sound indicator should appear when audible audio starts playing`);
  await playMedia(tab);
  await waitForTabSoundIndicatorAppears(tab);

  info(`sound indicator should disappear when audio stops playing`);
  await pauseMedia(tab);
  await waitForTabSoundIndicatorDisappears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testSoundIndicatorShouldDisappearAfterTabNavigation() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab();
  await initMediaPlaybackDocument(tab, "audio.ogg");

  info(`sound indicator should appear when audible audio starts playing`);
  await playMedia(tab);
  await waitForTabSoundIndicatorAppears(tab);

  info(`sound indicator should disappear after navigating tab to blank page`);
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, "about:blank");
  await waitForTabSoundIndicatorDisappears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testSoundIndicatorForAudioStream() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab();
  await initMediaStreamPlaybackDocument(tab);

  info(`sound indicator should appear when audible audio starts playing`);
  await playMedia(tab);
  await waitForTabSoundIndicatorAppears(tab);

  info(`sound indicator should disappear when audio stops playing`);
  await pauseMedia(tab);
  await waitForTabSoundIndicatorDisappears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testPerformPlayOnMediaLoadingNewSource() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab();
  await initMediaPlaybackDocument(tab, "audio.ogg");

  info(`sound indicator should appear when audible audio starts playing`);
  await playMedia(tab);
  await waitForTabSoundIndicatorAppears(tab);

  info(`sound indicator should disappear when audio stops playing`);
  await pauseMedia(tab);
  await waitForTabSoundIndicatorDisappears(tab);

  info(`reset media src and play it again should make sound indicator appear`);
  await assignNewSourceForAudio(tab, "audio.ogg");
  await playMedia(tab);
  await waitForTabSoundIndicatorAppears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testSoundIndicatorShouldDisappearWhenAbortingMedia() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab();
  await initMediaPlaybackDocument(tab, "audio.ogg");

  info(`sound indicator should appear when audible audio starts playing`);
  await playMedia(tab);
  await waitForTabSoundIndicatorAppears(tab);

  info(`sound indicator should disappear when aborting audio source`);
  await assignNewSourceForAudio(tab, "");
  await waitForTabSoundIndicatorDisappears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testNoSoundIndicatorForMediaWithoutAudioTrack() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab({ needObserver: true });
  await initMediaPlaybackDocument(tab, "noaudio.webm", { createVideo: true });

  info(`no sound indicator should show for playing media without audio track`);
  await playMedia(tab, { resolveOnTimeupdate: true });
  ok(!tab.observer.hasEverUpdated(), "didn't ever update sound indicator");

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testSoundIndicatorWhenChangingMediaMuted() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab({ needObserver: true });
  await initMediaPlaybackDocument(tab, "audio.ogg", { muted: true });

  info(`no sound indicator should show for playing muted media`);
  await playMedia(tab, { resolveOnTimeupdate: true });
  ok(!tab.observer.hasEverUpdated(), "didn't ever update sound indicator");

  info(`unmuted media should make sound indicator appear`);
  await Promise.all([
    waitForTabSoundIndicatorAppears(tab),
    updateMedia(tab, { muted: false }),
  ]);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testSoundIndicatorWhenChangingMediaVolume() {
  info("create a tab loading media document");
  const tab = await createBlankForegroundTab({ needObserver: true });
  await initMediaPlaybackDocument(tab, "audio.ogg", { volume: 0.0 });

  info(`no sound indicator should show for playing volume zero media`);
  await playMedia(tab, { resolveOnTimeupdate: true });
  ok(!tab.observer.hasEverUpdated(), "didn't ever update sound indicator");

  info(`unmuted media by setting volume should make sound indicator appear`);
  await Promise.all([
    waitForTabSoundIndicatorAppears(tab),
    updateMedia(tab, { volume: 1.0 }),
  ]);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

/**
 * Following are helper functions
 */
function initMediaPlaybackDocument(
  tab,
  fileName,
  { preload, createVideo, muted = false, volume = 1.0 } = {}
) {
  return SpecialPowers.spawn(
    tab.linkedBrowser,
    [fileName, preload, createVideo, muted, volume],
    // eslint-disable-next-line no-shadow
    async (fileName, preload, createVideo, muted, volume) => {
      if (createVideo) {
        content.media = content.document.createElement("video");
      } else {
        content.media = content.document.createElement("audio");
      }
      if (preload) {
        content.media.preload = preload;
      }
      content.media.muted = muted;
      content.media.volume = volume;
      content.media.src = fileName;
    }
  );
}

function initMediaStreamPlaybackDocument(tab) {
  return SpecialPowers.spawn(tab.linkedBrowser, [], async _ => {
    content.media = content.document.createElement("audio");
    content.media.srcObject =
      new content.AudioContext().createMediaStreamDestination().stream;
  });
}

function playMedia(tab, { resolveOnTimeupdate } = {}) {
  return SpecialPowers.spawn(
    tab.linkedBrowser,
    [resolveOnTimeupdate],
    // eslint-disable-next-line no-shadow
    async resolveOnTimeupdate => {
      await content.media.play();
      if (resolveOnTimeupdate) {
        await new Promise(r => (content.media.ontimeupdate = r));
      }
    }
  );
}

function pauseMedia(tab) {
  return SpecialPowers.spawn(tab.linkedBrowser, [], async _ => {
    content.media.pause();
  });
}

function assignNewSourceForAudio(tab, fileName) {
  // eslint-disable-next-line no-shadow
  return SpecialPowers.spawn(tab.linkedBrowser, [fileName], async fileName => {
    content.media.src = "";
    content.media.removeAttribute("src");
    content.media.src = fileName;
  });
}

function updateMedia(tab, { muted, volume } = {}) {
  return SpecialPowers.spawn(
    tab.linkedBrowser,
    [muted, volume],
    // eslint-disable-next-line no-shadow
    (muted, volume) => {
      if (muted != undefined) {
        content.media.muted = muted;
      }
      if (volume != undefined) {
        content.media.volume = volume;
      }
    }
  );
}
