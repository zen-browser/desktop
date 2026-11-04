/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function videoBrowserOf(card) {
  return card.element.querySelector(".zen-media-video-browser");
}

async function switchAwayAndWaitForCard(originalTab, mediaTab) {
  await BrowserTestUtils.switchTab(gBrowser, originalTab);
  await TestUtils.waitForCondition(
    () =>
      isMediaBarVisible() &&
      frontMediaCard()?.browser.browserId === mediaTab.linkedBrowser.browserId,
    "media card for the media tab is shown"
  );
  return frontMediaCard();
}

add_task(async function test_card_docks_video_and_stays_visible() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.mediacontrols.video.enabled", true]],
  });
  gZenMediaController.closeAllCards();

  const originalTab = gBrowser.selectedTab;
  const mediaTab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, mediaTab);

  try {
    await playVideoIn(mediaTab);
    const card = await switchAwayAndWaitForCard(originalTab, mediaTab);

    await TestUtils.waitForCondition(
      () =>
        card.isVideoDocked && card.controller.isBeingUsedInPIPModeOrFullscreen,
      "card docks the video and the clone is running"
    );
    ok(videoBrowserOf(card), "card holds a player browser");
    ok(card.element.hasAttribute("zen-video"), "card is in video mode");

    // The clone reports Picture-in-Picture mode, which hides cards for real
    // Picture-in-Picture windows. Give a wrongly hidden card time to go.
    await new Promise(r => setTimeout(r, 500));
    ok(!card.element.hidden, "docked card stays visible");
    ok(!card.element.hasAttribute("zen-hiding"), "docked card is not hiding");

    await BrowserTestUtils.switchTab(gBrowser, mediaTab);
    ok(!card.isVideoDocked, "video undocks as soon as its tab is selected");
    ok(!videoBrowserOf(card), "player browser is removed");
    await TestUtils.waitForCondition(
      () => !card.controller.isBeingUsedInPIPModeOrFullscreen,
      "clone stops once the player is removed"
    );
  } finally {
    await pauseVideoIn(mediaTab);
    BrowserTestUtils.removeTab(mediaTab);
    gBrowser.selectedTab = originalTab;
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_disabling_video_undocks() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.mediacontrols.video.enabled", true]],
  });
  gZenMediaController.closeAllCards();

  const originalTab = gBrowser.selectedTab;
  const mediaTab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, mediaTab);

  try {
    await playVideoIn(mediaTab);
    const card = await switchAwayAndWaitForCard(originalTab, mediaTab);
    await TestUtils.waitForCondition(
      () => card.isVideoDocked,
      "card docks the video"
    );

    await SpecialPowers.pushPrefEnv({
      set: [["zen.mediacontrols.video.enabled", false]],
    });
    ok(!card.isVideoDocked, "turning the pref off undocks right away");
    ok(!videoBrowserOf(card), "player browser is removed");
    await new Promise(r => setTimeout(r, 1500));
    ok(!card.element.hidden, "card keeps showing its controls");
    await SpecialPowers.popPrefEnv();
  } finally {
    await pauseVideoIn(mediaTab);
    BrowserTestUtils.removeTab(mediaTab);
    gBrowser.selectedTab = originalTab;
    await SpecialPowers.popPrefEnv();
  }
});
