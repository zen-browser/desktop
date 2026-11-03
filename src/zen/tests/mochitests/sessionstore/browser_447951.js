/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 447951 */

  waitForExplicitFinish();
  const baseURL =
    "http://mochi.test:8888/browser/" +
    "browser/components/sessionstore/test/browser_447951_sample.html#";

  // Make sure the functionality added in bug 943339 doesn't affect the results
  Services.prefs.setIntPref("browser.sessionstore.max_serialize_back", -1);
  Services.prefs.setIntPref("browser.sessionstore.max_serialize_forward", -1);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref("browser.sessionstore.max_serialize_back");
    Services.prefs.clearUserPref("browser.sessionstore.max_serialize_forward");
  });

  let tab = BrowserTestUtils.addTab(gBrowser);
  BrowserTestUtils.browserLoaded(tab.linkedBrowser, {
    wantLoad: "about:blank",
  }).then(() => {
    let tabState = { entries: [] };
    let max_entries = Services.prefs.getIntPref(
      "browser.sessionhistory.max_entries"
    );
    for (let i = 0; i < max_entries; i++) {
      tabState.entries.push({ url: baseURL + i, triggeringPrincipal_base64 });
    }

    promiseTabState(tab, tabState)
      .then(() => {
        return TabStateFlusher.flush(tab.linkedBrowser);
      })
      .then(() => {
        tabState = JSON.parse(ss.getTabState(tab));
        is(
          tabState.entries.length,
          max_entries,
          "session history filled to the limit"
        );
        is(tabState.entries[0].url, baseURL + 0, "... but not more");

        // visit yet another anchor (appending it to session history)
        SpecialPowers.spawn(tab.linkedBrowser, [], function () {
          content.window.document.querySelector("a").click();
        }).then(flushAndCheck);

        function flushAndCheck() {
          TabStateFlusher.flush(tab.linkedBrowser).then(check);
        }

        function check() {
          tabState = JSON.parse(ss.getTabState(tab));
          if (tab.linkedBrowser.currentURI.spec != baseURL + "end") {
            // It may take a few passes through the event loop before we
            // get the right URL.
            executeSoon(flushAndCheck);
            return;
          }

          is(
            tab.linkedBrowser.currentURI.spec,
            baseURL + "end",
            "the new anchor was loaded"
          );
          is(
            tabState.entries[tabState.entries.length - 1].url,
            baseURL + "end",
            "... and ignored"
          );
          is(
            tabState.entries[0].url,
            baseURL + 1,
            "... and the first item was removed"
          );

          // clean up
          gBrowser.removeTab(tab);
          finish();
        }
      });
  });
}
