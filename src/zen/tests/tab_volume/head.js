/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Looping <video> with sound, shared with the media controller tests.
const MEDIA_PATH =
  "browser/toolkit/components/pictureinpicture/tests/test-page-with-sound.html";
const MEDIA_PAGE = `https://example.com/${MEDIA_PATH}`;
const OTHER_SITE_MEDIA_PAGE = `https://example.org/${MEDIA_PATH}`;
const VIDEO_SELECTOR = "#with-controls";

const SITE_PREF_NAME = "zen.media.tab-volume";

const { SessionStore } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
);
const { TabStateFlusher } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs"
);

function clearSiteVolumes() {
  const contentPrefs = Cc["@mozilla.org/content-pref/service;1"].getService(
    Ci.nsIContentPrefService2
  );
  return new Promise(resolve =>
    contentPrefs.removeByName(SITE_PREF_NAME, null, {
      handleCompletion: resolve,
    })
  );
}

add_setup(async function () {
  await clearSiteVolumes();
  registerCleanupFunction(clearSiteVolumes);
});

async function addMediaTab(url = MEDIA_PAGE) {
  const tab = BrowserTestUtils.addTab(gBrowser, url, { skipAnimation: true });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, url);
  return tab;
}

async function loadUrl(tab, url) {
  const loaded = BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, url);
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);
  await loaded;
}

async function waitForTabVolume(tab, expected, message) {
  await TestUtils.waitForCondition(
    () => gZenTabVolume.getVolume(tab) === expected,
    message
  );
  is(gZenTabVolume.getVolume(tab), expected, message);
}

/**
 * Plays the page's video and waits until the volume Gecko computes for it,
 * which is what reaches the audio output, matches the expected tab volume.
 */
async function waitForPlaybackVolume(tab, expected) {
  await SpecialPowers.spawn(
    tab.linkedBrowser,
    [VIDEO_SELECTOR, expected],
    async (selector, volume) => {
      const video = content.document.querySelector(selector);
      if (video.paused) {
        await video.play();
      }
      await ContentTaskUtils.waitForCondition(
        () => Math.abs(video.computedVolume - volume) < 0.001,
        `the video plays at ${volume}`
      );
      Assert.less(
        Math.abs(video.computedVolume - volume),
        0.001,
        `the video plays at ${volume}`
      );
    }
  );
}

function siteDataPanel() {
  return document.getElementById("zen-unified-site-data-panel");
}

async function openSiteDataPanel() {
  const panel = siteDataPanel();
  const shown = BrowserTestUtils.waitForPopupEvent(panel, "shown");
  gNavToolbox.setAttribute("zen-has-implicit-hover", "true");
  EventUtils.synthesizeMouseAtCenter(
    document.getElementById("zen-site-data-icon-button"),
    {}
  );
  await shown;
  return panel;
}

async function closeSiteDataPanel() {
  const panel = siteDataPanel();
  if (panel.state !== "closed") {
    const hidden = BrowserTestUtils.waitForPopupEvent(panel, "hidden");
    panel.hidePopup(true);
    await hidden;
  }
  gNavToolbox.removeAttribute("zen-has-implicit-hover");
}

function volumeSlider() {
  return document.getElementById("zen-site-data-volume-slider");
}

/**
 * Drags the panel slider to roughly the given percentage with real mouse
 * events. Pixel rounding means the result can be a step or two off.
 */
function dragVolumeSlider(percent) {
  const slider = volumeSlider();
  const rect = slider.getBoundingClientRect();
  const max = Number(slider.getAttribute("aria-valuemax"));
  const x = rect.height / 2 + (percent / max) * (rect.width - rect.height);
  const y = rect.height / 2;
  // Start past the mute button, which sits at the start of the slider.
  EventUtils.synthesizeMouse(slider, rect.height + 2, y, { type: "mousedown" });
  EventUtils.synthesizeMouse(slider, x, y, { type: "mousemove" });
  EventUtils.synthesizeMouse(slider, x, y, { type: "mouseup" });
}

function scrollVolumeSlider(deltaY) {
  volumeSlider().dispatchEvent(
    new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true })
  );
}

function getStoredSiteVolume(tab) {
  const browser = tab.linkedBrowser;
  const { promise, resolve } = Promise.withResolvers();
  let value;
  Cc["@mozilla.org/content-pref/service;1"]
    .getService(Ci.nsIContentPrefService2)
    .getByDomainAndName(
      browser.currentURI.spec,
      SITE_PREF_NAME,
      browser.loadContext,
      {
        handleResult: pref => (value = pref.value),
        handleCompletion: () => resolve(value),
      }
    );
  return promise;
}

function assertVolumeNear(tab, expected, message) {
  Assert.lessOrEqual(
    Math.abs(gZenTabVolume.getVolume(tab) - expected),
    0.03,
    message
  );
}
