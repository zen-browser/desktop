/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const NUM_TABS = 12;

var stateBackup = ss.getBrowserState();

function test() {
  /** Test for Bug 590268 - Provide access to sessionstore tab data sooner */
  waitForExplicitFinish();
  requestLongerTimeout(2);

  // wasLoaded will be used to keep track of tabs that have already had SSTabRestoring
  // fired for them.
  let wasLoaded = {};
  let restoringTabsCount = 0;
  let restoredTabsCount = 0;
  let uniq2 = {};
  let uniq2Count = 0;
  let state = { windows: [{ tabs: [] }] };
  // We're going to put a bunch of tabs into this state
  for (let i = 0; i < NUM_TABS; i++) {
    let uniq = r();
    let tabData = {
      entries: [
        { url: "http://example.com/#" + i, triggeringPrincipal_base64 },
      ],
      extData: { uniq, baz: "qux" },
    };
    state.windows[0].tabs.push(tabData);
    wasLoaded[uniq] = false;
  }

  function onSSTabRestoring(aEvent) {
    restoringTabsCount++;
    let uniq = ss.getCustomTabValue(aEvent.originalTarget, "uniq");
    wasLoaded[uniq] = true;

    is(
      ss.getCustomTabValue(aEvent.originalTarget, "foo"),
      "",
      "There is no value for 'foo'"
    );

    // On the first SSTabRestoring we're going to run the the real test.
    // We'll keep this listener around so we can keep marking tabs as restored.
    if (restoringTabsCount == 1) {
      onFirstSSTabRestoring();
    } else if (restoringTabsCount == NUM_TABS) {
      onLastSSTabRestoring();
    }
  }

  function onSSTabRestored() {
    if (++restoredTabsCount < NUM_TABS) {
      return;
    }
    cleanup();
  }

  function onTabOpen(aEvent) {
    // To test bug 614708, we'll just set a value on the tab here. This value
    // would previously cause us to not recognize the values in extData until
    // much later. So testing "uniq" failed.
    ss.setCustomTabValue(aEvent.originalTarget, "foo", "bar");
  }

  // This does the actual testing. SSTabRestoring should be firing on tabs from
  // left to right, so we're going to start with the rightmost tab.
  function onFirstSSTabRestoring() {
    info("onFirstSSTabRestoring...");
    for (let i = gBrowser.tabs.length - 1; i >= 0; i--) {
      let tab = gBrowser.tabs[i];
      let actualUniq = ss.getCustomTabValue(tab, "uniq");
      let expectedUniq = state.windows[0].tabs[i].extData.uniq;

      if (wasLoaded[actualUniq]) {
        info("tab " + i + ": already restored");
        continue;
      }
      is(actualUniq, expectedUniq, "tab " + i + ": extData was correct");

      // Now we're going to set a piece of data back on the tab so it can be read
      // to test setting a value "early".
      uniq2[actualUniq] = r();
      ss.setCustomTabValue(tab, "uniq2", uniq2[actualUniq]);

      // Delete the value we have for "baz". This tests that deleteCustomTabValue
      // will delete "early access" values (c.f. bug 617175). If this doesn't throw
      // then the test is successful.
      try {
        ss.deleteCustomTabValue(tab, "baz");
      } catch (e) {
        ok(false, "no error calling deleteCustomTabValue - " + e);
      }

      // This will be used in the final comparison to make sure we checked the
      // same number as we set.
      uniq2Count++;
    }
  }

  function onLastSSTabRestoring() {
    let checked = 0;
    for (let i = 0; i < gBrowser.tabs.length; i++) {
      let tab = gBrowser.tabs[i];
      let uniq = ss.getCustomTabValue(tab, "uniq");

      // Look to see if we set a uniq2 value for this uniq value
      if (uniq in uniq2) {
        is(
          ss.getCustomTabValue(tab, "uniq2"),
          uniq2[uniq],
          "tab " + i + " has correct uniq2 value"
        );
        checked++;
      }
    }
    Assert.greater(
      uniq2Count,
      0,
      "at least 1 tab properly checked 'early access'"
    );
    is(checked, uniq2Count, "checked the same number of uniq2 as we set");
  }

  function cleanup() {
    // remove the event listener and clean up before finishing
    gBrowser.tabContainer.removeEventListener(
      "SSTabRestoring",
      onSSTabRestoring
    );
    gBrowser.tabContainer.removeEventListener(
      "SSTabRestored",
      onSSTabRestored,
      true
    );
    gBrowser.tabContainer.removeEventListener("TabOpen", onTabOpen);
    // Put this in an executeSoon because we still haven't called restoreNextTab
    // in sessionstore for the last tab (we'll call it after this). We end up
    // trying to restore the tab (since we then add a closed tab to the array).
    executeSoon(function () {
      ss.setBrowserState(stateBackup);
      executeSoon(finish);
    });
  }

  // Add the event listeners
  gBrowser.tabContainer.addEventListener("SSTabRestoring", onSSTabRestoring);
  gBrowser.tabContainer.addEventListener(
    "SSTabRestored",
    onSSTabRestored,
    true
  );
  gBrowser.tabContainer.addEventListener("TabOpen", onTabOpen);
  // Restore state
  ss.setBrowserState(JSON.stringify(state));
}
