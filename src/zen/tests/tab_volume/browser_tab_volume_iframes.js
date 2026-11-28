/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_volume_reaches_cross_origin_iframes() {
  const iframeHtml = `<iframe src="${OTHER_SITE_MEDIA_PAGE}"></iframe>`;
  const url = `https://example.com/document-builder.sjs?html=${encodeURIComponent(iframeHtml)}`;
  const tab = BrowserTestUtils.addTab(gBrowser, url, { skipAnimation: true });

  try {
    await BrowserTestUtils.browserLoaded(
      tab.linkedBrowser,
      true,
      loadedUrl => loadedUrl === OTHER_SITE_MEDIA_PAGE
    );
    const frame = tab.linkedBrowser.browsingContext.children[0];
    ok(frame, "the page has its cross-origin iframe");
    if (SpecialPowers.useRemoteSubframes) {
      isnot(
        frame.currentWindowGlobal.osPid,
        tab.linkedBrowser.browsingContext.currentWindowGlobal.osPid,
        "the iframe runs in its own process"
      );
    }

    gZenTabVolume.setVolume(tab, 2);
    await SpecialPowers.spawn(frame, [VIDEO_SELECTOR], async selector => {
      const video = content.document.querySelector(selector);
      await video.play();
      await ContentTaskUtils.waitForCondition(
        () => Math.abs(video.computedVolume - 2) < 0.001,
        "the video in the iframe plays at the tab volume"
      );
      Assert.less(
        Math.abs(video.computedVolume - 2),
        0.001,
        "the video in the iframe plays at the tab volume"
      );
    });
  } finally {
    BrowserTestUtils.removeTab(tab);
  }
});
