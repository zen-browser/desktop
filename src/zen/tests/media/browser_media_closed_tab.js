/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_closed_tab_ignores_late_webrtc() {
  // TabClose can fire while the browser is still available to a late WebRTC
  // update. Model that ordering with an active browser and deliver the update
  // after the controller has processed its close event.
  const browser = {
    browserId: "closed-tab-media-test",
    audioMuted: false,
    currentURI: { spec: "about:blank" },
    browsingContext: {
      currentWindowGlobal: {
        hasActivePeerConnections() {
          return true;
        },
      },
    },
  };

  gZenMediaController.onTabDiscardedOrClosed({
    target: { linkedBrowser: browser },
  });

  try {
    gZenMediaController.activateMediaDeviceControls(browser);

    Assert.notEqual(
      gZenMediaController.frontCard?.browser,
      browser,
      "a late WebRTC update must not recreate a media card for a closed tab"
    );
  } finally {
    const testCard = gZenMediaController.frontCard;
    if (testCard?.browser === browser) {
      testCard.destroy();
    }
  }
});
