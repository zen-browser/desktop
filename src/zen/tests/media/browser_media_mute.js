/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// User flow:
//   1. User plays a video, switches tabs, media bar appears.
//   2. User clicks the mute button on the Zen media bar.
//   3. The underlying tab actually goes silent (browser.audioMuted flips).
//   4. The media bar reflects that with the `muted` attribute so the icon
//      changes.
//   5. Clicking again unmutes.
//
// If this breaks, the user sees a mute button that looks toggled but the
// audio keeps playing — or worse, the tab is muted but the button still
// says "unmuted".

add_task(async function test_mute_from_media_bar() {
  const originalTab = gBrowser.selectedTab;
  const mediaTab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, mediaTab);

  try {
    await playVideoIn(mediaTab);
    await BrowserTestUtils.switchTab(gBrowser, originalTab);
    await waitForMediaBarVisible();

    ok(
      !mediaTab.linkedBrowser.audioMuted,
      "precondition: playing tab starts unmuted"
    );
    ok(
      !mediaBar().hasAttribute("muted"),
      "precondition: media bar has no muted attribute"
    );

    clickMediaButton("zen-media-mute-button");
    await BrowserTestUtils.waitForCondition(
      () => mediaTab.linkedBrowser.audioMuted,
      "tab becomes muted after clicking the media bar mute button"
    );
    ok(
      mediaBar().hasAttribute("muted"),
      "media bar reflects the muted state in its attribute"
    );

    clickMediaButton("zen-media-mute-button");
    await BrowserTestUtils.waitForCondition(
      () => !mediaTab.linkedBrowser.audioMuted,
      "clicking again unmutes the tab"
    );
    ok(
      !mediaBar().hasAttribute("muted"),
      "media bar drops the muted attribute"
    );
  } finally {
    if (mediaTab.linkedBrowser.audioMuted) {
      mediaTab.toggleMuteAudio();
    }
    await pauseVideoIn(mediaTab);
    BrowserTestUtils.removeTab(mediaTab);
    gBrowser.selectedTab = originalTab;
  }
});
