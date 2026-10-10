/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that tabs which aren't displayed yet (i.e. need to be reloaded) are
 * still displayed in the address bar results.
 */

const RESTRICT_TOKEN_OPENPAGE = "%";

const { PlacesTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PlacesTestUtils.sys.mjs"
);

const { UrlbarProviderOpenTabs } = ChromeUtils.importESModule(
  "moz-src:///browser/components/urlbar/UrlbarProviderOpenTabs.sys.mjs"
);

const { UrlbarTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/UrlbarTestUtils.sys.mjs"
);

var stateBackup = ss.getBrowserState();

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Set the pref to true so we know exactly how many tabs should be restoring at
      // any given time. This guarantees that a finishing load won't start another.
      ["browser.sessionstore.restore_on_demand", true],
      // Don't restore tabs lazily.
      ["browser.sessionstore.restore_tabs_lazily", false],
    ],
  });

  registerCleanupFunction(() => {
    ss.setBrowserState(stateBackup);
  });

  info("Waiting for the Places DB to be initialized");
  await PlacesUtils.promiseLargeCacheDBConnection();
  await UrlbarProviderOpenTabs.promiseDBPopulated;
});

add_task(async function test_unrestored_tabs_listed() {
  const state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              { url: "http://example.org/#1", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.org/#2", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.org/#3", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.org/#4", triggeringPrincipal_base64 },
            ],
          },
        ],
        selected: 1,
      },
    ],
  };

  const tabsForEnsure = new Set();
  state.windows[0].tabs.forEach(function (tab) {
    tabsForEnsure.add(tab.entries[0].url);
  });

  let tabsRestoring = 0;
  let tabsRestored = 0;

  await new Promise(resolve => {
    function handleEvent(aEvent) {
      if (aEvent.type == "SSTabRestoring") {
        tabsRestoring++;
      } else {
        tabsRestored++;
      }

      if (tabsRestoring < state.windows[0].tabs.length || tabsRestored < 1) {
        return;
      }

      gBrowser.tabContainer.removeEventListener(
        "SSTabRestoring",
        handleEvent,
        true
      );
      gBrowser.tabContainer.removeEventListener(
        "SSTabRestored",
        handleEvent,
        true
      );
      executeSoon(resolve);
    }

    // currentURI is set before SSTabRestoring is fired, so we can sucessfully check
    // after that has fired for all tabs. Since 1 tab will be restored though, we
    // also need to wait for 1 SSTabRestored since currentURI will be set, unset, then set.
    gBrowser.tabContainer.addEventListener("SSTabRestoring", handleEvent, true);
    gBrowser.tabContainer.addEventListener("SSTabRestored", handleEvent, true);
    ss.setBrowserState(JSON.stringify(state));
  });

  // Ensure any database statements started by UrlbarProviderOpenTabs are
  // complete before continuing.
  await PlacesTestUtils.promiseAsyncUpdates();

  // Remove the current tab from tabsForEnsure, because switch to tab doesn't
  // suggest it.
  tabsForEnsure.delete(gBrowser.currentURI.spec);
  info("Searching open pages.");
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus,
    value: RESTRICT_TOKEN_OPENPAGE,
  });
  const total = UrlbarTestUtils.getResultCount(window);
  info(`Found ${total} matches`);

  // Check to see the expected uris and titles match up (in any order)
  for (let i = 0; i < total; i++) {
    const result = await UrlbarTestUtils.getDetailsOfResultAt(window, i);
    if (result.heuristic) {
      info("Skip heuristic match");
      continue;
    }
    const url = result.url;
    Assert.ok(
      tabsForEnsure.has(url),
      `Should have the found result '${url}' in the expected list of entries`
    );
    // Remove the found entry from expected results.
    tabsForEnsure.delete(url);
  }
  // Make sure there is no reported open page that is not open.
  Assert.equal(tabsForEnsure.size, 0, "Should have found all the tabs");
});
