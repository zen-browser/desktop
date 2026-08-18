// Verify that closing a tab preserves the mute state it gets restored with: a
// tab closed while it was audible and unmuted comes back unmuted and audible,
// and a tab the user muted comes back muted and silent.

"use strict";

const PAGE = GetTestWebBasedURL("file_mediaPlayback2.html");

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["media.useAudioChannelService.testing", true]],
  });
});

add_task(async function test_closing_audible_tab_restores_unmuted() {
  const tab = await openAudibleTab();
  ok(!tab.muted, "Tab is not muted before it gets closed");
  ok(tab.soundPlaying, "Tab is still audible when it gets closed");

  const restored = await closeAndRestoreTab(tab);
  ok(!restored.muted, "Restored tab should not be muted");
  ok(
    !restored.linkedBrowser.audioMuted,
    "Restored tab's audio should not be muted"
  );
  await waitForTabSoundIndicatorAppears(restored);

  BrowserTestUtils.removeTab(restored);
});

add_task(async function test_closing_muted_tab_restores_muted() {
  const tab = await openAudibleTab();
  tab.toggleMuteAudio();
  ok(tab.muted, "Tab is muted before it gets closed");
  await waitForTabSoundIndicatorDisappears(tab);

  const restored = await closeAndRestoreTab(tab);
  ok(restored.muted, "Restored tab should still be muted");
  ok(restored.linkedBrowser.audioMuted, "Restored tab's audio should be muted");

  await BrowserTestUtils.browserLoaded(restored.linkedBrowser, false, PAGE);
  is(
    await getComputedMutedOncePlaying(restored.linkedBrowser),
    true,
    "Restored tab stays silent once its media resumes"
  );

  BrowserTestUtils.removeTab(restored);
});

// Following are helper functions.
async function openAudibleTab() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE);
  await waitForTabSoundIndicatorAppears(tab);
  return tab;
}

async function closeAndRestoreTab(tab) {
  const closedTabCount = SessionStore.getClosedTabCountForWindow(window);
  const mutedWhenClosed = tab.muted;

  const flushed = BrowserTestUtils.waitForSessionStoreUpdate(tab);
  await BrowserTestUtils.removeTab(tab);
  await flushed;

  is(
    SessionStore.getClosedTabCountForWindow(window),
    closedTabCount + 1,
    "SessionStore recorded the closed tab"
  );
  is(
    !!SessionStore.getClosedTabData(window)[0].state.muted,
    mutedWhenClosed,
    "Closed tab data records the mute state the tab was closed with"
  );

  return SessionStore.undoCloseTab(window, 0);
}

async function getComputedMutedOncePlaying(browser) {
  return SpecialPowers.spawn(browser, [], async () => {
    const audio = await ContentTaskUtils.waitForCondition(
      () => content.document.getElementById("v"),
      "wait for the restored page to create its audio element"
    );
    if (audio.paused) {
      await new Promise(resolve =>
        audio.addEventListener("playing", resolve, { once: true })
      );
    }
    return audio.computedMuted;
  });
}
