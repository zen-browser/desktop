/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PIP_PLAYER_URI = "chrome://global/content/pictureinpicture/player.xhtml";

// A separate window, so minimizing it leaves the harness window alone. The
// video plays in a background tab, so its card docks it. Window sync is off
// (see the pref lists below) so the window's tabs don't spread to the harness
// window.
async function openWindowWithDockedVideo() {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  await win.gZenWorkspaces.promiseInitialized;
  const mediaTab = await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    MEDIA_PAGE
  );
  await SpecialPowers.spawn(
    mediaTab.linkedBrowser,
    [VIDEO_SELECTOR],
    async selector => {
      const video = content.document.querySelector(selector);
      video.muted = false;
      await video.play();
    }
  );
  await TestUtils.waitForCondition(
    () => mediaTab.soundPlaying,
    "tab reports soundplaying"
  );

  await BrowserTestUtils.switchTab(win.gBrowser, win.gBrowser.tabs[0]);
  await TestUtils.waitForCondition(
    () => win.gZenMediaController.frontCard?.isVideoDocked,
    "the card docks the video"
  );
  return { win, card: win.gZenMediaController.frontCard };
}

function waitForPlayerWindow() {
  return BrowserTestUtils.domWindowOpenedAndLoaded(
    null,
    win => win.location.href == PIP_PLAYER_URI
  );
}

add_task(async function test_minimizing_moves_docked_video_to_pip() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.window-sync.enabled", false],
      ["zen.mediacontrols.video.enabled", true],
      ["media.videocontrols.picture-in-picture.enabled", true],
      // gizmo.mp4 is shorter than the minimum length for auto-opening.
      ["media.videocontrols.picture-in-picture.video-toggle.always-show", true],
      [
        "media.videocontrols.picture-in-picture.enable-when-switching-tabs.enabled",
        false,
      ],
      [
        "media.videocontrols.picture-in-picture.enable-when-occluded.enabled",
        true,
      ],
    ],
  });
  const { win, card } = await openWindowWithDockedVideo();

  try {
    const playerOpened = waitForPlayerWindow();
    const minimized = BrowserTestUtils.waitForEvent(win, "sizemodechange");
    win.minimize();
    await minimized;
    const playerWin = await playerOpened;
    ok(playerWin, "the player window opened when the window was minimized");
    // Firefox positions it from the minimized window, which can put it
    // off-screen; the media controller moves it back.
    await TestUtils.waitForCondition(() => {
      const { availLeft, availTop, availWidth, availHeight } = playerWin.screen;
      const centerX = playerWin.screenX + playerWin.outerWidth / 2;
      const centerY = playerWin.screenY + playerWin.outerHeight / 2;
      return (
        centerX >= availLeft &&
        centerX <= availLeft + availWidth &&
        centerY >= availTop &&
        centerY <= availTop + availHeight
      );
    }, "the player window is on screen");
    ok(!card.isVideoDocked, "the card gave up the video");

    const playerClosed = BrowserTestUtils.domWindowClosed(playerWin);
    win.restore();
    await playerClosed;
    ok(true, "the player window closed when the window was shown again");
    await TestUtils.waitForCondition(
      () => card.isVideoDocked && !card.element.hidden,
      "the card docks the video again"
    );
  } finally {
    for (const pip of Services.wm.getEnumerator("Toolkit:PictureInPicture")) {
      await BrowserTestUtils.closeWindow(pip);
    }
    await BrowserTestUtils.closeWindow(win);
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_minimizing_keeps_docked_video_without_pref() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.window-sync.enabled", false],
      ["zen.mediacontrols.video.enabled", true],
      [
        "media.videocontrols.picture-in-picture.enable-when-switching-tabs.enabled",
        false,
      ],
      [
        "media.videocontrols.picture-in-picture.enable-when-occluded.enabled",
        false,
      ],
    ],
  });
  const { win, card } = await openWindowWithDockedVideo();

  try {
    const minimized = BrowserTestUtils.waitForEvent(win, "sizemodechange");
    win.minimize();
    await minimized;
    // Give a wrongly requested player time to open.
    await new Promise(r => setTimeout(r, 1500));
    ok(
      !Services.wm.getMostRecentWindow("Toolkit:PictureInPicture"),
      "no player window opened"
    );
    ok(card.isVideoDocked, "the card keeps the video");
  } finally {
    await BrowserTestUtils.closeWindow(win);
    await SpecialPowers.popPrefEnv();
  }
});
