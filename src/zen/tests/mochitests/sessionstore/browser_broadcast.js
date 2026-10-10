/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const INITIAL_VALUE = "browser_broadcast.js-initial-value-" + Date.now();

/**
 * This test ensures we won't lose tab data queued in the content script when
 * closing a tab.
 */
add_task(async function flush_on_tabclose() {
  let tab = await createTabWithStorageData(["http://example.com/"]);
  let browser = tab.linkedBrowser;

  await modifySessionStorage(browser, { test: "on-tab-close" });
  await TabStateFlusher.flush(browser);
  await promiseRemoveTabAndSessionState(tab);

  let [
    {
      state: { storage },
    },
  ] = ss.getClosedTabDataForWindow(window);
  is(
    storage["http://example.com"].test,
    "on-tab-close",
    "sessionStorage data has been flushed on TabClose"
  );
});

/**
 * This test ensures we won't lose tab data queued in the content script when
 * duplicating a tab.
 */
add_task(async function flush_on_duplicate() {
  let tab = await createTabWithStorageData(["http://example.com/"]);
  let browser = tab.linkedBrowser;

  await modifySessionStorage(browser, { test: "on-duplicate" });
  let tab2 = ss.duplicateTab(window, tab);
  await promiseTabRestored(tab2);

  await promiseRemoveTabAndSessionState(tab2);
  let [
    {
      state: { storage },
    },
  ] = ss.getClosedTabDataForWindow(window);
  is(
    storage["http://example.com"].test,
    "on-duplicate",
    "sessionStorage data has been flushed when duplicating tabs"
  );

  gBrowser.removeTab(tab);
});

/**
 * This test ensures we won't lose tab data queued in the content script when
 * a window is closed.
 */
add_task(async function flush_on_windowclose() {
  let win = await promiseNewWindow();
  let tab = await createTabWithStorageData(["http://example.com/"], win);
  let browser = tab.linkedBrowser;

  await modifySessionStorage(browser, { test: "on-window-close" });
  await BrowserTestUtils.closeWindow(win);

  let [
    {
      tabs: [, { storage }],
    },
  ] = ss.getClosedWindowData();
  is(
    storage["http://example.com"].test,
    "on-window-close",
    "sessionStorage data has been flushed when closing a window"
  );
});

/**
 * This test ensures that stale tab data is ignored when reusing a tab
 * (via e.g. setTabState) and does not overwrite the new data.
 */
add_task(async function flush_on_settabstate() {
  let tab = await createTabWithStorageData(["http://example.com/"]);
  let browser = tab.linkedBrowser;

  // Flush to make sure our tab state is up-to-date.
  await TabStateFlusher.flush(browser);

  let state = ss.getTabState(tab);
  await modifySessionStorage(browser, { test: "on-set-tab-state" });

  // Flush all data contained in the content script but send it using
  // asynchronous messages.
  TabStateFlusher.flush(browser);

  await promiseTabState(tab, state);

  let { storage } = JSON.parse(ss.getTabState(tab));
  is(
    storage["http://example.com"].test,
    INITIAL_VALUE,
    "sessionStorage data has not been overwritten"
  );

  gBrowser.removeTab(tab);
});

/**
 * This test ensures that we won't lose tab data that has been sent
 * asynchronously just before closing a tab. Flushing must re-send all data
 * that hasn't been received by chrome, yet.
 */
add_task(async function flush_on_tabclose_racy() {
  let tab = await createTabWithStorageData(["http://example.com/"]);
  let browser = tab.linkedBrowser;

  // Flush to make sure we start with an empty queue.
  await TabStateFlusher.flush(browser);

  await modifySessionStorage(browser, { test: "on-tab-close-racy" });

  // Flush all data contained in the content script but send it using
  // asynchronous messages.
  TabStateFlusher.flush(browser);
  await promiseRemoveTabAndSessionState(tab);

  let [
    {
      state: { storage },
    },
  ] = ss.getClosedTabDataForWindow(window);
  is(
    storage["http://example.com"].test,
    "on-tab-close-racy",
    "sessionStorage data has been merged correctly to prevent data loss"
  );
});

function promiseNewWindow() {
  return new Promise(resolve => {
    whenNewWindowLoaded({ private: false }, resolve);
  });
}

async function createTabWithStorageData(urls, win = window) {
  let tab = BrowserTestUtils.addTab(win.gBrowser);
  let browser = tab.linkedBrowser;

  for (let url of urls) {
    BrowserTestUtils.startLoadingURIString(browser, url);
    await promiseBrowserLoaded(browser, true, url);
    dump("Loaded url: " + url + "\n");
    await modifySessionStorage(browser, { test: INITIAL_VALUE });
  }

  return tab;
}
