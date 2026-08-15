/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_media_bar_shows_when_switching_off_playing_tab() {
  gZenMediaController.closeAllCards();
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
      frontMediaCard()?.browser.browserId,
      mediaTab.linkedBrowser.browserId,
      "media card is bound to the media tab's browser, not the selected tab"
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
