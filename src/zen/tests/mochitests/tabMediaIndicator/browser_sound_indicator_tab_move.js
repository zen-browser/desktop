/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Moving a tab to another window hands its browsing context to a different
 * browser, which also changes the media controller the tab has to listen to.
 * For each way a tab can reach another window, these tests check that the sound
 * indicator still appears when audio starts and still clears when audio stops.
 */

const MOVE_MODES = [
  { name: "moving it to a new window", moveTab: moveTabToNewWindow },
  { name: "adopting it into another window", moveTab: adoptTabIntoOtherWindow },
];

for (const { name, moveTab } of MOVE_MODES) {
  add_task(async function testSoundIndicatorAppearsAfterMovingTab() {
    info("create a tab loading media document");
    const tab = await createBlankForegroundTab();
    await initMediaPlaybackDocument(tab, "audio.ogg");

    info(`move the silent tab by ${name}`);
    const { win, movedTab } = await moveTab(tab);

    info("sound indicator should appear when audible audio starts playing");
    await playMedia(movedTab);
    await waitForTabSoundIndicatorAppears(movedTab);

    info("stop media and close window");
    await pauseMedia(movedTab);
    await BrowserTestUtils.closeWindow(win);
  });

  add_task(async function testSoundIndicatorDisappearsAfterMovingTab() {
    info("create a tab loading media document");
    const tab = await createBlankForegroundTab();
    await initMediaPlaybackDocument(tab, "audio.ogg");

    info("sound indicator should appear when audible audio starts playing");
    await playMedia(tab);
    await waitForTabSoundIndicatorAppears(tab);

    info(`move the audible tab by ${name}`);
    const { win, movedTab } = await moveTab(tab);
    ok(movedTab.soundPlaying, "Tab sound indicator is kept after moving");

    info("sound indicator should disappear when audio stops playing");
    await pauseMedia(movedTab);
    await waitForTabSoundIndicatorDisappears(movedTab);

    info("close window");
    await BrowserTestUtils.closeWindow(win);
  });
}

// Following are helper functions.

async function moveTabToNewWindow(tab) {
  const win = gBrowser.replaceTabWithWindow(tab);
  await TestUtils.topicObserved(
    "browser-delayed-startup-finished",
    subject => subject == win
  );
  return { win, movedTab: win.gBrowser.selectedTab };
}

async function adoptTabIntoOtherWindow(tab) {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  const movedTab = win.gBrowser.adoptTab(tab, { selectTab: true });
  if (!movedTab) {
    throw new Error("adoptTab refused to swap the tab into the other window");
  }
  return { win, movedTab };
}
