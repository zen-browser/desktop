// Verify that tab mute state persists across navigation: a tab muted before
// navigation keeps audio muted on the new page, and unmuting restores audibility.

"use strict";

const PAGE = GetTestWebBasedURL("file_mediaPlayback2.html");

// Mute a tab while it is on about:blank, then navigate to a page with audio.
// Verify that the audio in the new page is muted immediately on playback, and
// that unmuting the tab makes the audio audible in content.
add_task(async function test_mute_persists_and_unmute_restores() {
  await SpecialPowers.pushPrefEnv({
    set: [["media.useAudioChannelService.testing", true]],
  });

  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const browser = tab.linkedBrowser;

  ok(!browser.audioMuted, "Tab should not be muted initially");
  tab.toggleMuteAudio();
  ok(browser.audioMuted, "Tab should now be muted");
  ok(tab.hasAttribute("muted"), "Tab element should have muted attribute");

  BrowserTestUtils.startLoadingURIString(browser, PAGE);
  await BrowserTestUtils.browserLoaded(browser, false, PAGE);

  await waitForAudioPlaying(browser);

  let computedMuted = await getAudioComputedMuted(browser);
  is(
    computedMuted,
    true,
    "Audio should be muted in the content page after navigation"
  );
  ok(
    browser.audioMuted,
    "browser.audioMuted should remain true after navigation"
  );
  ok(
    !tab.hasAttribute("soundplaying"),
    "Tab should not show the sound indicator while muted"
  );

  tab.toggleMuteAudio();
  ok(!browser.audioMuted, "Tab should be unmuted now");

  await TestUtils.waitForCondition(async () => {
    return !(await getAudioComputedMuted(browser));
  }, "Audio should become unmuted in content after tab unmute");

  computedMuted = await getAudioComputedMuted(browser);
  is(computedMuted, false, "Audio should no longer be muted after unmute");

  BrowserTestUtils.removeTab(tab);
});

// Following are helper functions.
async function getAudioComputedMuted(browser) {
  return SpecialPowers.spawn(browser, [], () => {
    const audio = content.document.getElementById("v");
    if (!audio) {
      ok(false, "audio element not found");
      return null;
    }
    return audio.computedMuted;
  });
}

async function waitForAudioPlaying(browser) {
  await SpecialPowers.spawn(browser, [], async () => {
    const audio = content.document.getElementById("v");
    if (!audio) {
      ok(false, "audio element not found");
      return;
    }
    if (!audio.paused) {
      return;
    }
    await new Promise(resolve =>
      audio.addEventListener("playing", resolve, { once: true })
    );
  });
}
