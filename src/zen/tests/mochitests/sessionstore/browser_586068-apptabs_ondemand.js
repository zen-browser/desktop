/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF_RESTORE_ON_DEMAND = "browser.sessionstore.restore_on_demand";
const PREF_RESTORE_PINNED_TABS_ON_DEMAND =
  "browser.sessionstore.restore_pinned_tabs_on_demand";

add_task(async function test() {
  Services.prefs.setBoolPref(PREF_RESTORE_ON_DEMAND, true);
  Services.prefs.setBoolPref(PREF_RESTORE_PINNED_TABS_ON_DEMAND, true);

  registerCleanupFunction(function () {
    Services.prefs.clearUserPref(PREF_RESTORE_ON_DEMAND);
    Services.prefs.clearUserPref(PREF_RESTORE_PINNED_TABS_ON_DEMAND);
  });

  let state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              { url: "http://example.org/#1", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
            pinned: true,
          },
          {
            entries: [
              { url: "http://example.org/#2", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
            pinned: true,
          },
          {
            entries: [
              { url: "http://example.org/#3", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
            pinned: true,
          },
          {
            entries: [
              { url: "http://example.org/#4", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.org/#5", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.org/#6", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.org/#7", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
        ],
        selected: 5,
      },
    ],
  };

  let promiseRestoringTabs = new Promise(resolve => {
    gProgressListener.setCallback(
      function (aBrowser, aNeedRestore, aRestoring, aRestored) {
        // get the tab
        let tab;
        for (let i = 0; i < window.gBrowser.tabs.length; i++) {
          if (!tab && window.gBrowser.tabs[i].linkedBrowser == aBrowser) {
            tab = window.gBrowser.tabs[i];
          }
        }

        // Check that the load only comes from the selected tab.
        ok(tab.selected, "load came from selected tab");
        is(aNeedRestore, 6, "six tabs left to restore");
        is(aRestoring, 1, "one tab is restoring");
        is(aRestored, 0, "no tabs have been restored, yet");

        gProgressListener.unsetCallback();
        resolve();
      }
    );
  });

  let backupState = ss.getBrowserState();
  ss.setBrowserState(JSON.stringify(state));
  await promiseRestoringTabs;

  // Cleanup.
  await promiseBrowserState(backupState);
});
