/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_media_bar_shows_metadata_from_page() {
  const originalTab = gBrowser.selectedTab;
  const mediaTab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, mediaTab);

  try {
    await setMediaSessionMetadata(mediaTab, {
      title: "Sandstorm",
      artist: "Darude",
    });
    await playVideoIn(mediaTab);
    await BrowserTestUtils.switchTab(gBrowser, originalTab);
    await waitForMediaBarVisible();

    const card = frontMediaCard().element;
    const titleEl = card.querySelector(".zen-media-title");
    const artistEl = card.querySelector(".zen-media-artist");

    await BrowserTestUtils.waitForCondition(
      () => titleEl.textContent === "Sandstorm",
      "title label reflects the page's mediaSession metadata"
    );
    Assert.equal(
      artistEl.textContent,
      "Darude",
      "artist label reflects the page's mediaSession metadata"
    );

    // Page updates metadata mid-playback.
    await setMediaSessionMetadata(mediaTab, {
      title: "Levels",
      artist: "Avicii",
    });
    await BrowserTestUtils.waitForCondition(
      () => titleEl.textContent === "Levels",
      "title updates live when the page changes its mediaSession metadata"
    );
    Assert.equal(
      artistEl.textContent,
      "Avicii",
      "artist updates live alongside the title"
    );
  } finally {
    await pauseVideoIn(mediaTab);
    BrowserTestUtils.removeTab(mediaTab);
    gBrowser.selectedTab = originalTab;
  }
});
