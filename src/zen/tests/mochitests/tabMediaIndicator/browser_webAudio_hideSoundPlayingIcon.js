/**
 * This test is used to ensure the 'sound-playing' icon would not disappear after
 * sites call AudioContext.resume().
 */
"use strict";

function setup_test_preference() {
  return SpecialPowers.pushPrefEnv({
    set: [
      ["media.useAudioChannelService.testing", true],
      ["browser.tabs.delayHidingAudioPlayingIconMS", 0],
    ],
  });
}

async function resumeAudioContext() {
  const ac = content.ac;
  await ac.resume();
  ok(true, "AudioContext is resumed.");
}

async function testResumeRunningAudioContext() {
  info(`- create new tab -`);
  const tab = await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    "about:blank"
  );
  const browser = tab.linkedBrowser;

  info(`- create audio context -`);
  // We want the same audio context to be used across different content tasks.
  await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    content.ac = new content.AudioContext();
    const ac = content.ac;
    const dest = ac.destination;
    const osc = ac.createOscillator();
    osc.connect(dest);
    osc.start();
  });

  info(`- wait for 'sound-playing' icon showing -`);
  await waitForTabSoundIndicatorAppears(tab);

  info(`- resume AudioContext -`);
  await SpecialPowers.spawn(browser, [], resumeAudioContext);

  info(`- 'sound-playing' icon should still exist -`);
  await waitForTabSoundIndicatorAppears(tab);

  info(`- remove tab -`);
  await BrowserTestUtils.removeTab(tab);
}

add_task(async function start_test() {
  info("- setup test preference -");
  await setup_test_preference();

  info("- start testing -");
  await testResumeRunningAudioContext();
});
