/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

add_task(async function () {
  const testUserContextId = 2;
  const testCases = [
    {
      url: `${TEST_PATH}empty.html`,
      crossOriginIsolated: false,
    },
    {
      url: `${TEST_PATH}coop_coep.html`,
      crossOriginIsolated: true,
    },
  ];

  for (const testCase of testCases) {
    let tab = BrowserTestUtils.addTab(gBrowser, testCase.url, {
      userContextId: testUserContextId,
    });
    await promiseBrowserLoaded(tab.linkedBrowser);

    is(
      tab.userContextId,
      testUserContextId,
      `The tab was opened with the expected userContextId`
    );

    await SpecialPowers.spawn(
      tab.linkedBrowser,
      [testCase.crossOriginIsolated],
      async expectedCrossOriginIsolated => {
        is(
          content.window.crossOriginIsolated,
          expectedCrossOriginIsolated,
          `The tab was opened in the expected crossOriginIsolated environment`
        );
      }
    );

    let sessionPromise = BrowserTestUtils.waitForSessionStoreUpdate(tab);
    BrowserTestUtils.removeTab(tab);
    await sessionPromise;

    let restoredTab = SessionStore.undoCloseTab(window, 0);

    // TODO: also check that `promiseTabRestored` is fulfilled. This currently
    // doesn't happen correctly in some cases, as the content restore is aborted
    // when the process switch occurs to load a cross-origin-isolated document
    // into a different process.
    await promiseBrowserLoaded(restoredTab.linkedBrowser);

    is(
      restoredTab.userContextId,
      testUserContextId,
      `The tab was restored with the expected userContextId`
    );

    await SpecialPowers.spawn(
      restoredTab.linkedBrowser,
      [testCase.crossOriginIsolated],
      async expectedCrossOriginIsolated => {
        is(
          content.window.crossOriginIsolated,
          expectedCrossOriginIsolated,
          `The tab was restored in the expected crossOriginIsolated environment`
        );
      }
    );

    BrowserTestUtils.removeTab(restoredTab);
  }
});
