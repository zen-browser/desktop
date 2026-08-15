/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_next_track_relays_to_page() {
  const originalTab = gBrowser.selectedTab;
  const mediaTab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, mediaTab);

  try {
    await playVideoIn(mediaTab);
    await setMediaSessionActionHandler(mediaTab, "nexttrack");

    await BrowserTestUtils.switchTab(gBrowser, originalTab);
    await waitForMediaBarVisible();

    const nextButton = frontMediaCard().element.querySelector(
      ".zen-media-nexttrack-button"
    );

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

    const nextButton = frontMediaCard().element.querySelector(
      ".zen-media-nexttrack-button"
    );
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
