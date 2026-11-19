/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF_RESTORE_ON_DEMAND = "browser.sessionstore.restore_on_demand";

add_task(async function test() {
  Services.prefs.setBoolPref(PREF_RESTORE_ON_DEMAND, true);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref(PREF_RESTORE_ON_DEMAND);
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
          },
          {
            entries: [
              { url: "http://example.org/#2", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.org/#3", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
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
          {
            entries: [
              { url: "http://example.org/#8", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.org/#9", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
        ],
        selected: 1,
      },
    ],
  };

  let loadCount = 0;
  let promiseRestoringTabs = new Promise(resolve => {
    gBrowser.tabContainer.addEventListener(
      "SSTabRestored",
      function onRestored(event) {
        let tab = event.target;
        let browser = tab.linkedBrowser;
        let tabData = state.windows[0].tabs[loadCount++];

        // double check that this tab was the right one
        is(
          browser.currentURI.spec,
          tabData.entries[0].url,
          "load " + loadCount + " - browser loaded correct url"
        );
        is(
          ss.getCustomTabValue(tab, "uniq"),
          tabData.extData.uniq,
          "load " + loadCount + " - correct tab was restored"
        );

        if (loadCount == state.windows[0].tabs.length) {
          gBrowser.tabContainer.removeEventListener(
            "SSTabRestored",
            onRestored
          );
          resolve();
        } else {
          // reload the next tab
          gBrowser.browsers[loadCount].reload();
        }
      }
    );
  });

  let backupState = ss.getBrowserState();
  ss.setBrowserState(JSON.stringify(state));
  await promiseRestoringTabs;

  // Cleanup.
  await promiseBrowserState(backupState);
});
