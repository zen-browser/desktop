/**
 * This test is used to make sure we won't show the sound indicator for silent
 * web audio.
 */
/* eslint-disable mozilla/no-arbitrary-setTimeout */
"use strict";

async function waitUntilAudioContextStarts() {
  const ac = content.ac;
  if (ac.state == "running") {
    return;
  }

  await new Promise(resolve => {
    ac.onstatechange = () => {
      if (ac.state == "running") {
        ac.onstatechange = null;
        resolve();
      }
    };
  });
}

add_task(async function testSilentAudioContext() {
  info(`- create new tab -`);
  const tab = await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    "about:blank"
  );
  const browser = tab.linkedBrowser;

  info(`- create audio context -`);
  // We want the same audio context to be used across different content tasks
  await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    content.ac = new content.AudioContext();
    const ac = content.ac;
    const dest = ac.destination;
    const source = new content.OscillatorNode(content.ac);
    const gain = new content.GainNode(content.ac);
    gain.gain.value = 0.0;
    source.connect(gain).connect(dest);
    source.start();
  });
  info(`- check AudioContext's state -`);
  await SpecialPowers.spawn(browser, [], waitUntilAudioContextStarts);
  ok(true, `AudioContext is running.`);

  info(`- should not show sound indicator -`);
  // If we do the next step too early, then we can't make sure whether that the
  // reason of no showing sound indicator is because of silent web audio, or
  // because the indicator is just not showing yet.
  await new Promise(r => setTimeout(r, 1000));
  await waitForTabSoundIndicatorDisappears(tab);

  info(`- remove tab -`);
  await BrowserTestUtils.removeTab(tab);
});
