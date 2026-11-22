/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_volume_only_applies_to_its_tab() {
  const first = await addMediaTab();
  const second = await addMediaTab();

  try {
    gZenTabVolume.setVolume(first, 0.4);
    is(gZenTabVolume.getVolume(second), 1, "the other tab keeps its volume");

    await waitForPlaybackVolume(first, 0.4);
    await waitForPlaybackVolume(second, 1);
  } finally {
    BrowserTestUtils.removeTab(first);
    BrowserTestUtils.removeTab(second);
  }
});

add_task(async function test_saved_volume_does_not_change_open_tabs() {
  const first = await addMediaTab();
  const second = await addMediaTab();

  try {
    gZenTabVolume.setVolume(first, 1.8);
    await gZenTabVolume.saveSiteVolume(first);
    is(
      gZenTabVolume.getVolume(second),
      1,
      "a tab already showing the site isn't affected by the saved volume"
    );

    const third = await addMediaTab();
    await waitForTabVolume(
      third,
      1.8,
      "a new tab on the site starts with the saved volume"
    );
    await waitForPlaybackVolume(third, 1.8);
    BrowserTestUtils.removeTab(third);
  } finally {
    BrowserTestUtils.removeTab(first);
    BrowserTestUtils.removeTab(second);
    await clearSiteVolumes();
  }
});

add_task(async function test_resetting_forgets_site_volume() {
  const tab = await addMediaTab();

  try {
    gZenTabVolume.setVolume(tab, 1.6);
    await gZenTabVolume.saveSiteVolume(tab);
    gZenTabVolume.setVolume(tab, 1);
    await gZenTabVolume.saveSiteVolume(tab);
    is(
      SessionStore.getCustomTabValue(tab, "zen-tab-volume"),
      "",
      "the default volume isn't stored for the tab"
    );

    const other = await addMediaTab();
    is(gZenTabVolume.getVolume(other), 1, "the site volume was forgotten");
    BrowserTestUtils.removeTab(other);
  } finally {
    BrowserTestUtils.removeTab(tab);
  }
});
