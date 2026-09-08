/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

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
    const card = frontMediaCard().element;
    ok(
      !card.hasAttribute("muted"),
      "precondition: media card has no muted attribute"
    );

    clickMediaButton("zen-media-mute-button");
    await BrowserTestUtils.waitForCondition(
      () => mediaTab.linkedBrowser.audioMuted,
      "tab becomes muted after clicking the media bar mute button"
    );
    ok(
      card.hasAttribute("muted"),
      "media card reflects the muted state in its attribute"
    );

    clickMediaButton("zen-media-mute-button");
    await BrowserTestUtils.waitForCondition(
      () => !mediaTab.linkedBrowser.audioMuted,
      "clicking again unmutes the tab"
    );
    ok(!card.hasAttribute("muted"), "media card drops the muted attribute");
  } finally {
    if (mediaTab.linkedBrowser.audioMuted) {
      mediaTab.toggleMuteAudio();
    }
    await pauseVideoIn(mediaTab);
    BrowserTestUtils.removeTab(mediaTab);
    gBrowser.selectedTab = originalTab;
  }
});
