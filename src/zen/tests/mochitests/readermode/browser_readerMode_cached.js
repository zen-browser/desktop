/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

// This test verifies that the article is properly using the cached data
// when switching into reader mode. The article produces a random number
// contained within it, so if the article gets reloaded instead of using
// the cached version, it would have a different value in it.
const URL =
  "http://mochi.test:8888/browser/toolkit/components/reader/tests/browser/readerModeRandom.sjs";

add_task(async function () {
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, URL);

  let randomNumber = await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    return content.document.getElementById("rnd").textContent;
  });

  let promiseTabLoad = BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  let readerButton = document.getElementById("reader-mode-button");
  readerButton.click();
  await promiseTabLoad;
  await TestUtils.waitForCondition(() => !readerButton.hidden);

  let newRandomNumber = await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    return content.document.getElementById("rnd").textContent;
  });

  is(randomNumber, newRandomNumber, "used the same value");

  BrowserTestUtils.removeTab(tab);
});
