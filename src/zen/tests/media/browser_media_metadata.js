/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// User flow:
//   1. A page (think Spotify, YouTube Music) plays media and publishes
//      title/artist via navigator.mediaSession.metadata.
//   2. User switches off that tab, media bar appears.
//   3. The title and artist labels in the bar show what the page published.
//   4. The page then updates the metadata mid-playback (next song starts).
//   5. The bar updates live, without the user having to switch tabs again.
//
// This is what makes the bar feel connected to the playing page instead of
// a generic "something is playing" indicator.

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

    const titleEl = document.getElementById("zen-media-title");
    const artistEl = document.getElementById("zen-media-artist");

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
