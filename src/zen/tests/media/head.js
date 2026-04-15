/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Shared mozilla-central fixture that hosts an <audio> element — same one
// used by browser/components/tabbrowser media tests and zen tabs/head.js.
const MEDIA_PAGE =
  "https://example.com/browser/browser/components/tabbrowser/test/browser/tabs/file_mediaPlayback.html";

async function addMediaTab() {
  const tab = BrowserTestUtils.addTab(gBrowser, MEDIA_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(gBrowser.getBrowserForTab(tab));
  return tab;
}

async function playAudioIn(tab) {
  await SpecialPowers.spawn(tab.linkedBrowser, [], async () => {
    const audio = content.document.querySelector("audio");
    await audio.play();
  });
  // Wait for the browser to actually consider the tab "playing" — this is
  // what drives DOMAudioPlaybackStarted into the media controller.
  await BrowserTestUtils.waitForCondition(
    () => tab.soundPlaying,
    "tab reports soundplaying"
  );
}

async function pauseAudioIn(tab) {
  await SpecialPowers.spawn(tab.linkedBrowser, [], async () => {
    const audio = content.document.querySelector("audio");
    audio.pause();
  });
}

function mediaBar() {
  return document.getElementById("zen-media-controls-toolbar");
}

function isMediaBarVisible() {
  return !mediaBar().hasAttribute("hidden");
}
