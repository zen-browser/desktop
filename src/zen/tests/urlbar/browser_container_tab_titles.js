/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PlacesTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PlacesTestUtils.sys.mjs"
);
const { UrlbarProviderOpenTabs } = ChromeUtils.importESModule(
  "moz-src:///browser/components/urlbar/UrlbarProviderOpenTabs.sys.mjs"
);

const TEST_URL = "https://example.com/?zen-urlbar-container-title-test=617db8";

add_setup(async function () {
  await PlacesUtils.promiseLargeCacheDBConnection();
  await UrlbarProviderOpenTabs.promiseDBPopulated;
});

add_task(async function test_container_tabs_use_their_live_labels() {
  const tabs = [];

  try {
    for (const userContextId of [1, 2]) {
      const tab = BrowserTestUtils.addTab(gBrowser, TEST_URL, {
        skipAnimation: true,
        userContextId,
      });
      tabs.push(tab);
      await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
    }

    const labels = ["Personal Gmail", "Work Gmail"];
    tabs.forEach((tab, index) => {
      tab.zenStaticLabel = labels[index];
      gBrowser._setTabLabel(tab, labels[index], {
        _zenChangeLabelFlag: true,
      });
    });
    Assert.deepEqual(
      tabs.map(tab => tab.label),
      labels,
      "The container tabs should have distinct live labels"
    );

    await PlacesTestUtils.promiseAsyncUpdates();

    const searchTab = await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      "about:newtab"
    );
    tabs.push(searchTab);

    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value: "% zen-urlbar-container-title-test",
    });

    const queryContext = await gURLBar.lastQueryContextPromise;
    const results = queryContext.results
      .filter(result => result.payload.url == TEST_URL)
      .map(result => ({
        title: result.payload.title,
        userContextId: result.payload.userContextId,
      }))
      .sort((a, b) => a.userContextId - b.userContextId);

    Assert.deepEqual(
      results,
      [
        { title: labels[0], userContextId: 1 },
        { title: labels[1], userContextId: 2 },
      ],
      "Switch-to-tab results should use each container tab's live label"
    );
  } finally {
    for (const tab of tabs.reverse()) {
      if (gBrowser.tabs.includes(tab)) {
        BrowserTestUtils.removeTab(tab);
      }
    }
  }
});
