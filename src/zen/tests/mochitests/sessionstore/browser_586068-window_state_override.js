/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF_RESTORE_ON_DEMAND = "browser.sessionstore.restore_on_demand";

add_task(async function test() {
  Services.prefs.setBoolPref(PREF_RESTORE_ON_DEMAND, false);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref(PREF_RESTORE_ON_DEMAND);
  });

  // We'll use 2 states so that we can make sure calling setWindowState doesn't
  // wipe out currently restoring data.
  let state1 = {
    windows: [
      {
        tabs: [
          {
            entries: [
              { url: "http://example.com#1", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.com#2", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.com#3", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.com#4", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.com#5", triggeringPrincipal_base64 },
            ],
          },
        ],
      },
    ],
  };
  let state2 = {
    windows: [
      {
        tabs: [
          {
            entries: [
              { url: "http://example.org#1", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.org#2", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.org#3", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.org#4", triggeringPrincipal_base64 },
            ],
          },
          {
            entries: [
              { url: "http://example.org#5", triggeringPrincipal_base64 },
            ],
          },
        ],
      },
    ],
  };
  let numTabs = 2 + state2.windows[0].tabs.length;

  let loadCount = 0;
  let promiseRestoringTabs = new Promise(resolve => {
    gProgressListener.setCallback(function (aBrowser, aNeedRestore) {
      // When loadCount == 2, we'll also restore state2 into the window
      if (++loadCount == 2) {
        executeSoon(() =>
          ss.setWindowState(window, JSON.stringify(state2), true)
        );
      }

      if (loadCount < numTabs) {
        return;
      }

      // We don't actually care about load order in this test, just that they all
      // do load.
      is(loadCount, numTabs, "all tabs were restored");
      is(aNeedRestore, 0, "there are no tabs left needing restore");

      gProgressListener.unsetCallback();
      resolve();
    });
  });

  let backupState = ss.getBrowserState();
  ss.setWindowState(window, JSON.stringify(state1), true);
  await promiseRestoringTabs;

  // Cleanup.
  await promiseBrowserState(backupState);
});
