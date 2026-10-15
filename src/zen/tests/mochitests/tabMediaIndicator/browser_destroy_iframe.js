const EMPTY_PAGE_URL = GetTestWebBasedURL("file_empty.html");
const AUTPLAY_PAGE_URL = GetTestWebBasedURL("file_autoplay_media.html");
const CORS_AUTPLAY_PAGE_URL = GetTestWebBasedURL(
  "file_autoplay_media.html",
  true
);
const CORS_WEB_AUDIO_PAGE_URL = GetTestWebBasedURL("file_webAudio.html", true);

/**
 * When an iframe that has audible media gets destroyed, if there is no other
 * audible playing media existing in the page, then the sound indicator should
 * disappear.
 */
add_task(async function testDestroyAudibleIframe() {
  const iframesURL = [AUTPLAY_PAGE_URL, CORS_AUTPLAY_PAGE_URL];
  for (let iframeURL of iframesURL) {
    info(`open a tab, create an iframe and load an autoplay media page inside`);
    const tab = await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      EMPTY_PAGE_URL
    );
    await createIframeAndLoadURL(tab, iframeURL);

    info(`sound indicator should appear because of audible playing media`);
    await waitForTabSoundIndicatorAppears(tab);

    info(`sound indicator should disappear after destroying iframe`);
    await removeIframe(tab);
    await waitForTabSoundIndicatorDisappears(tab);

    info("remove tab");
    BrowserTestUtils.removeTab(tab);
  }
});

/**
 * When an iframe with a Web Audio context (uncontrolled source) is destroyed,
 * the sound indicator should disappear if no other audible source remains.
 * This exercises the mAudibleUncontrolledSources.Remove() path in
 * MediaStatusManager::NotifyBrowsingContextDiscarded().
 */
add_task(async function testDestroyAudibleWebAudioIframe() {
  info(`open a tab, create a cross-origin iframe with Web Audio`);
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    EMPTY_PAGE_URL
  );
  await createIframeAndLoadURL(tab, CORS_WEB_AUDIO_PAGE_URL);

  info(`sound indicator should appear because of audible Web Audio`);
  await waitForTabSoundIndicatorAppears(tab);

  info(
    `sound indicator should disappear after destroying the Web Audio iframe`
  );
  await removeIframe(tab);
  await waitForTabSoundIndicatorDisappears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

function createIframeAndLoadURL(tab, url) {
  // eslint-disable-next-line no-shadow
  return SpecialPowers.spawn(tab.linkedBrowser, [url], async url => {
    const iframe = content.document.createElement("iframe");
    content.document.body.appendChild(iframe);
    iframe.src = url;
    info(`load ${url} for iframe`);
    await new Promise(r => (iframe.onload = r));
  });
}

function removeIframe(tab) {
  return SpecialPowers.spawn(tab.linkedBrowser, [], _ => {
    content.document.getElementsByTagName("iframe")[0].remove();
  });
}
