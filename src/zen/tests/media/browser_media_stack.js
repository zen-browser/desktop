/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_media_stack_shows_multiple_cards() {
  const originalTab = gBrowser.selectedTab;
  const tabA = await addMediaTab();
  const tabB = await addMediaTab();

  try {
    await BrowserTestUtils.switchTab(gBrowser, tabA);
    await setMediaSessionMetadata(tabA, { title: "Song A", artist: "A" });
    await playVideoIn(tabA);

    await BrowserTestUtils.switchTab(gBrowser, tabB);
    await setMediaSessionMetadata(tabB, { title: "Song B", artist: "B" });
    await playVideoIn(tabB);

    await BrowserTestUtils.switchTab(gBrowser, originalTab);
    await waitForMediaBarVisible();

    // Cards reappear on the 500ms tab-switch debounce; wait for both.
    await BrowserTestUtils.waitForCondition(
      () => visibleMediaCards().length === 2,
      "both playing tabs get their own card in the stack"
    );

    Assert.equal(
      frontMediaCard().browser.browserId,
      tabB.linkedBrowser.browserId,
      "front card belongs to the most recently started media"
    );

    await BrowserTestUtils.waitForCondition(() => {
      const titles = visibleMediaCards().map(
        card => card.querySelector(".zen-media-title").textContent
      );
      return titles.includes("Song A") && titles.includes("Song B");
    }, "each card shows its own session's metadata");

    // Closing the front card only removes that session.
    clickMediaButton("zen-media-close-button");
    await BrowserTestUtils.waitForCondition(
      () => visibleMediaCards().length === 1,
      "closing the front card only removes that card"
    );
    ok(isMediaBarVisible(), "media bar stays visible with the remaining card");
    Assert.equal(
      frontMediaCard().browser.browserId,
      tabA.linkedBrowser.browserId,
      "remaining card takes the front slot"
    );
  } finally {
    await pauseVideoIn(tabA);
    await pauseVideoIn(tabB);
    BrowserTestUtils.removeTab(tabA);
    BrowserTestUtils.removeTab(tabB);
    gBrowser.selectedTab = originalTab;
  }
});
