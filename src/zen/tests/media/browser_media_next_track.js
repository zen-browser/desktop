/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// User flow:
//   1. A music page registers a "nexttrack" action handler (like most
//      streaming sites do).
//   2. User is on another tab, media bar is showing with the next-track
//      button enabled.
//   3. User clicks next-track.
//   4. The action fires inside the page — the page is responsible for
//      loading the next song. Zen's job here is to relay the click.
//
// Also guards the button-enablement logic: if the page does NOT register a
// handler, the next-track button must be disabled. Otherwise clicks go
// nowhere and users think the bar is broken.

add_task(async function test_next_track_relays_to_page() {
  const originalTab = gBrowser.selectedTab;
  const mediaTab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, mediaTab);

  try {
    await playVideoIn(mediaTab);
    await setMediaSessionActionHandler(mediaTab, "nexttrack");

    await BrowserTestUtils.switchTab(gBrowser, originalTab);
    await waitForMediaBarVisible();

    const nextButton = document.getElementById("zen-media-nexttrack-button");

    // supportedkeyschange propagates asynchronously; wait for the bar's
    // next-track button to become enabled before clicking.
    await BrowserTestUtils.waitForCondition(
      () => !nextButton.disabled,
      "next-track button becomes enabled once the page registers a handler"
    );

    const actionFired = waitForMediaSessionAction(mediaTab);
    clickMediaButton("zen-media-nexttrack-button");

    const result = await actionFired;
    ok(result, "page's nexttrack MediaSession handler was invoked");
  } finally {
    await pauseVideoIn(mediaTab);
    BrowserTestUtils.removeTab(mediaTab);
    gBrowser.selectedTab = originalTab;
  }
});

add_task(async function test_next_track_button_disabled_without_handler() {
  const originalTab = gBrowser.selectedTab;
  const mediaTab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, mediaTab);

  try {
    // Deliberately do NOT install a nexttrack handler.
    await playVideoIn(mediaTab);
    await BrowserTestUtils.switchTab(gBrowser, originalTab);
    await waitForMediaBarVisible();

    const nextButton = document.getElementById("zen-media-nexttrack-button");
    Assert.equal(
      nextButton.disabled,
      true,
      "next-track button stays disabled when the page registers no handler"
    );
  } finally {
    await pauseVideoIn(mediaTab);
    BrowserTestUtils.removeTab(mediaTab);
    gBrowser.selectedTab = originalTab;
  }
});
