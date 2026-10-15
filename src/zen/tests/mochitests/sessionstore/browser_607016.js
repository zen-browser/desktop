"use strict";

var stateBackup = ss.getBrowserState();

add_task(async function () {
  /** Bug 607016 - If a tab is never restored, attributes (eg. hidden) aren't updated correctly */
  ignoreAllUncaughtExceptions();

  // Set the pref to true so we know exactly how many tabs should be restoring at
  // any given time. This guarantees that a finishing load won't start another.
  Services.prefs.setBoolPref("browser.sessionstore.restore_on_demand", true);
  // Don't restore tabs lazily.
  Services.prefs.setBoolPref("browser.sessionstore.restore_tabs_lazily", false);

  let state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              { url: "http://example.org#1", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          },
          {
            entries: [
              { url: "http://example.org#2", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          }, // overwriting
          {
            entries: [
              { url: "http://example.org#3", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          }, // hiding
          {
            entries: [
              { url: "http://example.org#4", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          }, // adding
          {
            entries: [
              { url: "http://example.org#5", triggeringPrincipal_base64 },
            ],
            extData: { uniq: r() },
          }, // deleting
          {
            entries: [
              { url: "http://example.org#6", triggeringPrincipal_base64 },
            ],
          }, // creating
        ],
        selected: 1,
      },
    ],
  };

  async function progressCallback() {
    let curState = JSON.parse(ss.getBrowserState());
    for (let i = 0; i < curState.windows[0].tabs.length; i++) {
      let tabState = state.windows[0].tabs[i];
      let tabCurState = curState.windows[0].tabs[i];
      if (tabState.extData) {
        is(
          tabCurState.extData.uniq,
          tabState.extData.uniq,
          "sanity check that tab has correct extData"
        );
      } else {
        // We aren't expecting there to be any data on extData, but panorama
        // may be setting something, so we need to make sure that if we do have
        // data, we just don't have anything for "uniq".
        ok(
          !("extData" in tabCurState) || !("uniq" in tabCurState.extData),
          "sanity check that tab doesn't have extData or extData doesn't have 'uniq'"
        );
      }
    }

    // Now we'll set a new unique value on 1 of the tabs
    let newUniq = r();
    ss.setCustomTabValue(gBrowser.tabs[1], "uniq", newUniq);
    let tabState = JSON.parse(ss.getTabState(gBrowser.tabs[1]));
    is(
      tabState.extData.uniq,
      newUniq,
      "(overwriting) new data is stored in extData"
    );

    // hide the next tab before closing it
    gBrowser.hideTab(gBrowser.tabs[2]);
    tabState = JSON.parse(ss.getTabState(gBrowser.tabs[2]));
    ok(tabState.hidden, "(hiding) tab data has hidden == true");

    // set data that's not in a conflicting key
    let stillUniq = r();
    ss.setCustomTabValue(gBrowser.tabs[3], "stillUniq", stillUniq);
    tabState = JSON.parse(ss.getTabState(gBrowser.tabs[3]));
    is(
      tabState.extData.stillUniq,
      stillUniq,
      "(adding) new data is stored in extData"
    );

    // remove the uniq value and make sure it's not there in the closed data
    ss.deleteCustomTabValue(gBrowser.tabs[4], "uniq");
    tabState = JSON.parse(ss.getTabState(gBrowser.tabs[4]));
    // Since Panorama might have put data in, first check if there is extData.
    // If there is explicitly check that "uniq" isn't in it. Otherwise, we're ok
    if ("extData" in tabState) {
      ok(
        !("uniq" in tabState.extData),
        "(deleting) uniq not in existing extData"
      );
    } else {
      ok(true, "(deleting) no data is stored in extData");
    }

    // set unique data on the tab that never had any set, make sure that's saved
    let newUniq2 = r();
    ss.setCustomTabValue(gBrowser.tabs[5], "uniq", newUniq2);
    tabState = JSON.parse(ss.getTabState(gBrowser.tabs[5]));
    is(
      tabState.extData.uniq,
      newUniq2,
      "(creating) new data is stored in extData where there was none"
    );

    while (gBrowser.tabs.length > 1) {
      BrowserTestUtils.removeTab(gBrowser.tabs[1]);
    }
  }

  // Set the test state.
  await setBrowserState(state);

  // Wait until the selected tab is restored and all others are pending.
  await Promise.all(
    Array.from(gBrowser.tabs, tab => {
      return tab == gBrowser.selectedTab
        ? promiseTabRestored(tab)
        : promiseTabRestoring(tab);
    })
  );

  // Kick off the actual tests.
  await progressCallback();

  // Cleanup.
  Services.prefs.clearUserPref("browser.sessionstore.restore_on_demand");
  Services.prefs.clearUserPref("browser.sessionstore.restore_tabs_lazily");
  await promiseBrowserState(stateBackup);
});
