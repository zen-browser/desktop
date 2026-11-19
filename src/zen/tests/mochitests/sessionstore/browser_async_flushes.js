"use strict";

const PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content/",
  "http://example.com/"
);
const URL = PATH + "file_async_flushes.html";

add_task(async function test_flush() {
  // Create new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Flush to empty any queued update messages.
  await TabStateFlusher.flush(browser);

  // There should be one history entry.
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 1, "there is a single history entry");

  // Click the link to navigate, this will add second shistory entry.
  await SpecialPowers.spawn(browser, [], async function () {
    return new Promise(resolve => {
      docShell.chromeEventHandler.addEventListener(
        "hashchange",
        () => resolve(),
        { once: true, capture: true }
      );

      // Click the link.
      content.document.querySelector("a").click();
    });
  });

  // Flush to empty any queued update messages.
  await TabStateFlusher.flush(browser);

  // There should be two history entries now.
  ({ entries } = JSON.parse(ss.getTabState(tab)));
  is(entries.length, 2, "there are two shistory entries");

  // Cleanup.
  gBrowser.removeTab(tab);
});

add_task(async function test_remove() {
  // Create new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Flush to empty any queued update messages.
  await TabStateFlusher.flush(browser);

  // There should be one history entry.
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 1, "there is a single history entry");

  // Click the link to navigate.
  await SpecialPowers.spawn(browser, [], async function () {
    return new Promise(resolve => {
      docShell.chromeEventHandler.addEventListener(
        "hashchange",
        () => resolve(),
        { once: true, capture: true }
      );

      // Click the link.
      content.document.querySelector("a").click();
    });
  });

  // Request a flush and remove the tab. The flush should still complete.
  await Promise.all([
    TabStateFlusher.flush(browser),
    promiseRemoveTabAndSessionState(tab),
  ]);
});
