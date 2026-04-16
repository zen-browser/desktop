/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// User flow:
//   1. User opens a page with audio and hits play.
//   2. User switches to a different tab.
//   3. The Zen media control bar should appear (so the user can still
//      pause/skip without going back to the noisy tab).
//   4. User switches back to the audio tab.
//   5. The media bar should hide again — it's redundant next to the real
//      page controls.
//
// This covers the real contract users see: the DOMAudioPlaybackStarted →
// TabSelect → showMediaControls chain in nsZenMediaController, plus the
// inverse path on selecting the playing tab. A regression anywhere in that
// chain (event wiring, the 500ms tab-switch debounce, the hidden attribute
// flip) surfaces as a bar that either never shows or never hides.

// note: We keep setting timeouts because media player takes a bit to
// get removed (after the animation, more specifically)

add_task(async function test_media_bar_shows_when_switching_off_playing_tab() {
  gZenMediaController.onControllerClose();
  await BrowserTestUtils.waitForCondition(
    () => !isMediaBarVisible(),
    "media bar hides again once the playing tab regains focus"
  );

  const originalTab = gBrowser.selectedTab;
  const mediaTab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, mediaTab);

  ok(
    !isMediaBarVisible(),
    "media bar is hidden while the playing tab is the active tab"
  );

  try {
    await playVideoIn(mediaTab);

    ok(
      !isMediaBarVisible(),
      "media bar remains hidden while focused on the playing tab"
    );

    // Switch away. The controller schedules showMediaControls() on a 500ms
    // timer; wait for the visibility flip rather than racing it.
    await BrowserTestUtils.switchTab(gBrowser, originalTab);
    await new Promise(r => setTimeout(r, 1000));
    await BrowserTestUtils.waitForCondition(
      isMediaBarVisible,
      "media bar becomes visible after switching off the playing tab"
    );

    Assert.equal(
      gZenMediaController._currentBrowser?.browserId,
      mediaTab.linkedBrowser.browserId,
      "media controller is bound to the media tab's browser, not the selected tab"
    );

    await BrowserTestUtils.switchTab(gBrowser, mediaTab);
    await new Promise(r => setTimeout(r, 1000));
    await BrowserTestUtils.waitForCondition(
      () => !isMediaBarVisible(),
      "media bar hides again once the playing tab regains focus"
    );
  } finally {
    await pauseVideoIn(mediaTab);
    BrowserTestUtils.removeTab(mediaTab);
    gBrowser.selectedTab = originalTab;
  }
});
