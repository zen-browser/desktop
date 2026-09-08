/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF_RESTORE_ON_DEMAND = "browser.sessionstore.restore_on_demand";

add_task(async function test() {
  Services.prefs.setBoolPref(PREF_RESTORE_ON_DEMAND, false);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref(PREF_RESTORE_ON_DEMAND);
  });

  // The first window will be put into the already open window and the second
  // window will be opened with _openWindowWithState, which is the source of the problem.
  let state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              { url: "http://example.org#0", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
        ],
        selected: 1,
      },
      {
        tabs: [
          {
            entries: [
              { url: "http://example.com#1", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.com#2", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.com#3", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.com#4", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.com#5", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.com#6", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
        ],
        selected: 4,
      },
    ],
  };
  let numTabs = state.windows[0].tabs.length + state.windows[1].tabs.length;

  let loadCount = 0;
  let promiseRestoringTabs = new Promise(resolve => {
    gProgressListener.setCallback(function (aBrowser, aNeedRestore) {
      if (++loadCount == numTabs) {
        // We don't actually care about load order in this test, just that they all
        // do load.
        is(loadCount, numTabs, "all tabs were restored");
        is(aNeedRestore, 0, "there are no tabs left needing restore");

        gProgressListener.unsetCallback();
        resolve();
      }
    });
  });

  // We also want to catch the 2nd window, so we need to observe domwindowopened
  Services.ww.registerNotification(function observer(aSubject, aTopic) {
    if (aTopic == "domwindowopened") {
      let win = aSubject;
      win.addEventListener(
        "load",
        function () {
          Services.ww.unregisterNotification(observer);
          win.gBrowser.addTabsProgressListener(gProgressListener);
        },
        { once: true }
      );
    }
  });

  let backupState = ss.getBrowserState();
  ss.setBrowserState(JSON.stringify(state));
  await promiseRestoringTabs;

  // Cleanup.
  await promiseAllButPrimaryWindowClosed();
  await promiseBrowserState(backupState);
});
