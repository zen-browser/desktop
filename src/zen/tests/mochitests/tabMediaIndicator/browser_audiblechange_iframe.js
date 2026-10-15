// When a tab has audio sources in both the top-level document and an iframe,
// pausing only one of them must not make the tab sound indicator disappear —
// it should stay until all sources are silent.

const PAGE_URL = GetTestWebBasedURL("file_audiblechange_iframe.html");

/**
 * Start both top-level and iframe audio, wait for indicator, then pause each
 * one in turn verifying the indicator only disappears when both are silent.
 *
 * @param {tab} tab
 * @param {BrowsingContext} innerBC  - iframe's browsing context
 * @param {string} pauseFirst       - "toplevel" or "iframe"
 */
async function testBothSourcesThenPauseOne(tab, innerBC, pauseFirst) {
  const browser = tab.linkedBrowser;

  info(`play both sources (pause-first: ${pauseFirst})`);
  await SpecialPowers.spawn(browser, [], async () => {
    await content.document.getElementById("toplevel").play();
  });
  await SpecialPowers.spawn(innerBC, [], async () => {
    await content.document.getElementById("audio").play();
  });
  await waitForTabSoundIndicatorAppears(tab);

  const observer = createSoundIndicatorObserver(tab);

  if (pauseFirst === "toplevel") {
    info("pause top-level only — iframe still playing");
    await SpecialPowers.spawn(browser, [], () => {
      content.document.getElementById("toplevel").pause();
    });
    // Wait for the iframe audio to advance, proving it is still audible.
    await SpecialPowers.spawn(innerBC, [], async () => {
      await new Promise(r => {
        content.document.getElementById("audio").ontimeupdate = r;
      });
    });
    ok(
      !observer.hasEverUpdated(),
      "indicator stays after top-level pause (iframe still playing)"
    );

    info("pause iframe — all silent");
    await SpecialPowers.spawn(innerBC, [], () => {
      content.document.getElementById("audio").pause();
    });
  } else {
    info("pause iframe only — top-level still playing");
    await SpecialPowers.spawn(innerBC, [], () => {
      content.document.getElementById("audio").pause();
    });
    // Wait for the top-level audio to advance, proving it is still audible.
    await SpecialPowers.spawn(browser, [], async () => {
      await new Promise(r => {
        content.document.getElementById("toplevel").ontimeupdate = r;
      });
    });
    ok(
      !observer.hasEverUpdated(),
      "indicator stays after iframe pause (top-level still playing)"
    );

    info("pause top-level — all silent");
    await SpecialPowers.spawn(browser, [], () => {
      content.document.getElementById("toplevel").pause();
    });
  }

  await waitForTabSoundIndicatorDisappears(tab);
}

add_task(async function testSoundIndicatorPauseTopLevelFirst() {
  info("open tab with top-level audio and same-origin iframe audio");
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);
  const innerBC = tab.linkedBrowser.browsingContext.children[0];

  await testBothSourcesThenPauseOne(tab, innerBC, "toplevel");

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testSoundIndicatorPauseIframeFirst() {
  info("open tab with top-level audio and same-origin iframe audio");
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);
  const innerBC = tab.linkedBrowser.browsingContext.children[0];

  await testBothSourcesThenPauseOne(tab, innerBC, "iframe");

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testSoundIndicatorOnlyTopLevelPlaying() {
  info("open tab and play only the top-level audio (iframe silent)");
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);
  const browser = tab.linkedBrowser;

  await SpecialPowers.spawn(browser, [], async () => {
    await content.document.getElementById("toplevel").play();
  });
  await waitForTabSoundIndicatorAppears(tab);

  info("pause top-level — tab should go silent");
  await SpecialPowers.spawn(browser, [], () => {
    content.document.getElementById("toplevel").pause();
  });
  await waitForTabSoundIndicatorDisappears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function testSoundIndicatorOnlyIframePlaying() {
  info("open tab and play only the iframe audio (top-level silent)");
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);
  const innerBC = tab.linkedBrowser.browsingContext.children[0];

  await SpecialPowers.spawn(innerBC, [], async () => {
    await content.document.getElementById("audio").play();
  });
  await waitForTabSoundIndicatorAppears(tab);

  info("pause iframe — tab should go silent");
  await SpecialPowers.spawn(innerBC, [], () => {
    content.document.getElementById("audio").pause();
  });
  await waitForTabSoundIndicatorDisappears(tab);

  info("remove tab");
  BrowserTestUtils.removeTab(tab);
});
