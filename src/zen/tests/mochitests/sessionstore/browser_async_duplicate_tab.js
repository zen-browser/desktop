"use strict";

const PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content/",
  "http://example.com/"
);
const URL = PATH + "file_async_duplicate_tab.html";

add_task(async function test_duplicate() {
  // Create new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Flush to empty any queued update messages.
  await TabStateFlusher.flush(browser);

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

  // Duplicate the tab.
  let tab2 = ss.duplicateTab(window, tab);

  // Wait until the tab has fully restored.
  await promiseTabRestored(tab2);
  await TabStateFlusher.flush(tab2.linkedBrowser);

  // There should be two history entries now.
  let { entries } = JSON.parse(ss.getTabState(tab2));
  is(entries.length, 2, "there are two shistory entries");

  // Cleanup.
  BrowserTestUtils.removeTab(tab2);
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_duplicate_remove() {
  // Create new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Flush to empty any queued update messages.
  await TabStateFlusher.flush(browser);

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

  // Duplicate the tab.
  let tab2 = ss.duplicateTab(window, tab);

  // Before the duplication finished, remove the tab.
  await Promise.all([
    promiseRemoveTabAndSessionState(tab),
    promiseTabRestored(tab2),
  ]);
  await TabStateFlusher.flush(tab2.linkedBrowser);

  // There should be two history entries now.
  let { entries } = JSON.parse(ss.getTabState(tab2));
  is(entries.length, 2, "there are two shistory entries");

  // Cleanup.
  BrowserTestUtils.removeTab(tab2);
});
