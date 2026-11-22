/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_volume_goes_away_with_its_tab() {
  const tab = await addMediaTab();
  const other = await addMediaTab();

  try {
    gZenTabVolume.setVolume(tab, 2);
    await waitForPlaybackVolume(tab, 2);

    // The volume lives on the tab's browsing context, so there is nothing
    // left behind once the context is discarded.
    const browsingContext = tab.linkedBrowser.browsingContext;
    BrowserTestUtils.removeTab(tab);
    await TestUtils.waitForCondition(
      () => browsingContext.isDiscarded,
      "the closed tab's browsing context is discarded"
    );

    is(gZenTabVolume.getVolume(other), 1, "the other tab is unaffected");
    await waitForPlaybackVolume(other, 1);
  } finally {
    BrowserTestUtils.removeTab(other);
  }
});

add_task(async function test_undo_close_restores_tab_volume() {
  const tab = await addMediaTab();
  gZenTabVolume.setVolume(tab, 1.7);

  await TabStateFlusher.flush(tab.linkedBrowser);
  BrowserTestUtils.removeTab(tab);

  const restored = SessionStore.undoCloseTab(window, 0);
  try {
    await BrowserTestUtils.browserLoaded(restored.linkedBrowser);
    await waitForTabVolume(
      restored,
      1.7,
      "the reopened tab gets its volume back"
    );
    await waitForPlaybackVolume(restored, 1.7);
  } finally {
    BrowserTestUtils.removeTab(restored);
  }
});

add_task(async function test_duplicate_keeps_tab_volume() {
  const tab = await addMediaTab();
  gZenTabVolume.setVolume(tab, 0.6);

  const duplicate = gBrowser.duplicateTab(tab);
  try {
    await BrowserTestUtils.browserLoaded(duplicate.linkedBrowser);
    await waitForTabVolume(duplicate, 0.6, "the duplicate has the same volume");
  } finally {
    BrowserTestUtils.removeTab(duplicate);
    BrowserTestUtils.removeTab(tab);
  }
});
