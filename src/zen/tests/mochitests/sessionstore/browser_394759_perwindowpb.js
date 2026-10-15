/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TESTS = [
  { url: "about:config", key: "bug 394759 Non-PB", value: "uniq" + r() },
  { url: "about:mozilla", key: "bug 394759 PB", value: "uniq" + r() },
];

function promiseTestOpenCloseWindow(aIsPrivate, aTest) {
  return (async function () {
    let win = await BrowserTestUtils.openNewBrowserWindow({
      private: aIsPrivate,
    });
    BrowserTestUtils.startLoadingURIString(
      win.gBrowser.selectedBrowser,
      aTest.url
    );
    await promiseBrowserLoaded(win.gBrowser.selectedBrowser, true, aTest.url);
    // Mark the window with some unique data to be restored later on.
    ss.setCustomWindowValue(win, aTest.key, aTest.value);
    await TabStateFlusher.flushWindow(win);
    // Close.
    await BrowserTestUtils.closeWindow(win);
  })();
}

function promiseTestOnWindow(aIsPrivate, aValue) {
  return (async function () {
    let win = await BrowserTestUtils.openNewBrowserWindow({
      private: aIsPrivate,
    });
    await TabStateFlusher.flushWindow(win);
    let data = ss.getClosedWindowData()[0];
    is(
      ss.getClosedWindowCount(),
      1,
      "Check that the closed window count hasn't changed"
    );
    Assert.greater(
      JSON.stringify(data).indexOf(aValue),
      -1,
      "Check the closed window data was stored correctly"
    );
    registerCleanupFunction(() => BrowserTestUtils.closeWindow(win));
  })();
}

add_setup(async function () {
  forgetClosedWindows();
  forgetClosedTabs(window);
});

add_task(async function main() {
  await promiseTestOpenCloseWindow(false, TESTS[0]);
  await promiseTestOpenCloseWindow(true, TESTS[1]);
  await promiseTestOnWindow(false, TESTS[0].value);
  await promiseTestOnWindow(true, TESTS[0].value);
});
