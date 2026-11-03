/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL = HTTPROOT + "browser_frametree_sample.html";
const URL_FRAMESET = HTTPROOT + "browser_frametree_sample_frameset.html";
const URL_IFRAMES = HTTPROOT + "browser_frametree_sample_iframes.html";

/**
 * Check that we correctly enumerate non-dynamic child frames.
 */
add_task(async function test_frametree() {
  // Add an empty tab for a start.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // The page is a single frame with no children.
  is(await countNonDynamicFrames(browser), 0, "no child frames");

  // Navigate to a frameset.
  BrowserTestUtils.startLoadingURIString(browser, URL_FRAMESET);
  await promiseBrowserLoaded(browser);

  // The frameset has two frames.
  is(await countNonDynamicFrames(browser), 2, "two non-dynamic child frames");

  // Go back in history.
  let pageShowPromise = BrowserTestUtils.waitForContentEvent(
    browser,
    "pageshow",
    true
  );
  browser.goBack();
  await pageShowPromise;

  // We're at page one again.
  is(await countNonDynamicFrames(browser), 0, "no child frames");

  // Append a dynamic frame.
  await SpecialPowers.spawn(browser, [URL], async ([url]) => {
    let frame = content.document.createElement("iframe");
    frame.setAttribute("src", url);
    content.document.body.appendChild(frame);
    await ContentTaskUtils.waitForEvent(frame, "load");
  });

  // The dynamic frame should be ignored.
  is(
    await countNonDynamicFrames(browser),
    0,
    "we still have a single root frame"
  );

  // Cleanup.
  BrowserTestUtils.removeTab(tab);
});

/**
 * Check that we correctly enumerate non-dynamic child frames.
 */
add_task(async function test_frametree_dynamic() {
  // Add an empty tab for a start.
  let tab = BrowserTestUtils.addTab(gBrowser, URL_IFRAMES);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // The page has two iframes.
  is(await countNonDynamicFrames(browser), 2, "two non-dynamic child frames");
  is(await enumerateIndexes(browser), "0,1", "correct indexes 0 and 1");

  // Insert a dynamic frame.
  await SpecialPowers.spawn(browser, [URL], async ([url]) => {
    let frame = content.document.createElement("iframe");
    frame.setAttribute("src", url);
    content.document.body.insertBefore(
      frame,
      content.document.getElementsByTagName("iframe")[1]
    );
    await ContentTaskUtils.waitForEvent(frame, "load");
  });

  // The page still has two iframes.
  is(await countNonDynamicFrames(browser), 2, "two non-dynamic child frames");
  is(await enumerateIndexes(browser), "0,1", "correct indexes 0 and 1");

  // Append a dynamic frame.
  await SpecialPowers.spawn(browser, [URL], async ([url]) => {
    let frame = content.document.createElement("iframe");
    frame.setAttribute("src", url);
    content.document.body.appendChild(frame);
    await ContentTaskUtils.waitForEvent(frame, "load");
  });

  // The page still has two iframes.
  is(await countNonDynamicFrames(browser), 2, "two non-dynamic child frames");
  is(await enumerateIndexes(browser), "0,1", "correct indexes 0 and 1");

  // Remopve a non-dynamic iframe.
  await SpecialPowers.spawn(browser, [URL], async () => {
    // Remove the first iframe, which should be a non-dynamic iframe.
    content.document.body.removeChild(
      content.document.getElementsByTagName("iframe")[0]
    );
  });

  is(await countNonDynamicFrames(browser), 1, "one non-dynamic child frame");
  is(await enumerateIndexes(browser), "1", "correct index 1");

  // Cleanup.
  BrowserTestUtils.removeTab(tab);
});

async function countNonDynamicFrames(browser) {
  return SpecialPowers.spawn(browser, [], async () => {
    let count = 0;
    content.SessionStoreUtils.forEachNonDynamicChildFrame(
      content,
      () => count++
    );
    return count;
  });
}

async function enumerateIndexes(browser) {
  return SpecialPowers.spawn(browser, [], async () => {
    let indexes = [];
    content.SessionStoreUtils.forEachNonDynamicChildFrame(content, (frame, i) =>
      indexes.push(i)
    );
    return indexes.join(",");
  });
}
