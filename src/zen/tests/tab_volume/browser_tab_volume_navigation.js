/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_volume_survives_same_site_navigation() {
  const tab = await addMediaTab();

  try {
    gZenTabVolume.setVolume(tab, 1.5);
    await waitForPlaybackVolume(tab, 1.5);

    await loadUrl(tab, `${MEDIA_PAGE}?next`);
    await waitForTabVolume(tab, 1.5, "same-site navigation keeps the volume");
    await waitForPlaybackVolume(tab, 1.5);
  } finally {
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_volume_follows_site_across_navigation() {
  const tab = await addMediaTab();

  try {
    gZenTabVolume.setVolume(tab, 2.5);
    await gZenTabVolume.saveSiteVolume(tab);

    await loadUrl(tab, OTHER_SITE_MEDIA_PAGE);
    await waitForTabVolume(
      tab,
      1,
      "a site without a saved volume plays at the default volume"
    );
    await waitForPlaybackVolume(tab, 1);

    await loadUrl(tab, MEDIA_PAGE);
    await waitForTabVolume(
      tab,
      2.5,
      "going back to the site restores its saved volume"
    );
    await waitForPlaybackVolume(tab, 2.5);
  } finally {
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});

add_task(async function test_history_navigation() {
  const tab = await addMediaTab();

  try {
    gZenTabVolume.setVolume(tab, 0.3);
    await gZenTabVolume.saveSiteVolume(tab);
    await loadUrl(tab, OTHER_SITE_MEDIA_PAGE);
    await waitForTabVolume(tab, 1, "the other site plays at the default");

    // Usually served from the bfcache, with its old browsing context.
    const shown = BrowserTestUtils.waitForContentEvent(
      tab.linkedBrowser,
      "pageshow"
    );
    tab.linkedBrowser.goBack();
    await shown;
    await waitForTabVolume(tab, 0.3, "going back restores the volume");
    await waitForPlaybackVolume(tab, 0.3);
  } finally {
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});
