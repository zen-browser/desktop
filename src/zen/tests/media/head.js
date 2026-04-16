/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Shared mozilla-central fixture from the Picture-in-Picture tests: an HTML
// page with two looping <video src="gizmo.mp4"> elements (with and without
// controls). Looping keeps playback stable across slow CI, and using a real
// <video> element is closer to what Zen users actually play (YouTube, etc.)
// than a bare <audio>.
const MEDIA_PAGE =
  "https://example.com/browser/toolkit/components/pictureinpicture/tests/test-page-with-sound.html";
const VIDEO_SELECTOR = "#with-controls";

async function addMediaTab() {
  const tab = BrowserTestUtils.addTab(gBrowser, MEDIA_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(gBrowser.getBrowserForTab(tab));
  return tab;
}

async function playVideoIn(tab) {
  await SpecialPowers.spawn(
    tab.linkedBrowser,
    [VIDEO_SELECTOR],
    async selector => {
      const video = content.document.querySelector(selector);
      await video.play();
    }
  );
  // Wait for the browser to actually consider the tab "playing" — this is
  // what drives DOMAudioPlaybackStarted into the media controller.
  await BrowserTestUtils.waitForCondition(
    () => tab.soundPlaying,
    "tab reports soundplaying"
  );
}

async function pauseVideoIn(tab) {
  await SpecialPowers.spawn(
    tab.linkedBrowser,
    [VIDEO_SELECTOR],
    async selector => {
      const video = content.document.querySelector(selector);
      video.pause();
    }
  );
}

function mediaBar() {
  return document.getElementById("zen-media-controls-toolbar");
}

function isMediaBarVisible() {
  return !mediaBar().hasAttribute("hidden");
}

async function waitForMediaBarVisible() {
  await BrowserTestUtils.waitForCondition(
    isMediaBarVisible,
    "media bar becomes visible"
  );
}

// Click a toolbarbutton on the media bar. We dispatch a "command" event
// directly because that's what the controller listens for and it sidesteps
// the flakiness of synthesizing a mouse click on a small toolbar button.
function clickMediaButton(id) {
  const button = document.getElementById(id);
  ok(button, `media bar button ${id} exists`);
  button.dispatchEvent(new Event("command", { bubbles: true }));
}

async function setMediaSessionMetadata(tab, metadata) {
  await SpecialPowers.spawn(tab.linkedBrowser, [metadata], async meta => {
    content.navigator.mediaSession.metadata = new content.MediaMetadata(meta);
  });
}

async function setMediaSessionActionHandler(tab, action) {
  // Installs a MediaSession action handler and returns a promise that
  // resolves when the handler fires. The promise is surfaced via a
  // content-side global the caller can await.
  await SpecialPowers.spawn(tab.linkedBrowser, [action], async a => {
    content.wrappedJSObject.__zenActionFired = new content.Promise(resolve => {
      content.navigator.mediaSession.setActionHandler(a, () => resolve(true));
    });
  });
}

async function waitForMediaSessionAction(tab) {
  return SpecialPowers.spawn(tab.linkedBrowser, [], async () => {
    return content.wrappedJSObject.__zenActionFired;
  });
}
