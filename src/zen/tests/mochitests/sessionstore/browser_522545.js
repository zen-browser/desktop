/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 522545 */

  waitForExplicitFinish();
  requestLongerTimeout(4);

  // This tests the following use case:
  // User opens a new tab which gets focus. The user types something into the
  // address bar, then crashes or quits.
  function test_newTabFocused() {
    let state = {
      windows: [
        {
          tabs: [
            { entries: [{ url: "about:mozilla", triggeringPrincipal_base64 }] },
            { entries: [], userTypedValue: "example.com", userTypedClear: 0 },
          ],
          selected: 2,
        },
      ],
    };

    waitForBrowserState(state, function () {
      let browser = gBrowser.selectedBrowser;
      is(
        browser.currentURI.spec,
        "about:blank",
        "No history entries still sets currentURI to about:blank"
      );
      is(
        browser.userTypedValue,
        "example.com",
        "userTypedValue was correctly restored"
      );
      ok(
        !browser.didStartLoadSinceLastUserTyping(),
        "We still know that no load is ongoing"
      );
      is(
        gURLBar.value,
        "example.com",
        "Address bar's value correctly restored"
      );

      // Change tabs to make sure address bar value gets updated.  If tab is
      // lazy, wait for SSTabRestored to ensure address bar has time to update.
      let tabToSelect = gBrowser.tabContainer.getItemAtIndex(0);
      if (tabToSelect.linkedBrowser.isConnected) {
        gBrowser.selectedTab = tabToSelect;
        is(
          gURLBar.value,
          "about:mozilla",
          "Address bar's value correctly updated"
        );
        runNextTest();
      } else {
        gBrowser.tabContainer.addEventListener(
          "SSTabRestored",
          function SSTabRestored(event) {
            if (event.target == tabToSelect) {
              gBrowser.tabContainer.removeEventListener(
                "SSTabRestored",
                SSTabRestored,
                true
              );
              is(
                gURLBar.value,
                "about:mozilla",
                "Address bar's value correctly updated"
              );
              runNextTest();
            }
          },
          true
        );
        gBrowser.selectedTab = tabToSelect;
      }
    });
  }

  // This tests the following use case:
  // User opens a new tab which gets focus. The user types something into the
  // address bar, switches back to the first tab, then crashes or quits.
  function test_newTabNotFocused() {
    let state = {
      windows: [
        {
          tabs: [
            { entries: [{ url: "about:mozilla", triggeringPrincipal_base64 }] },
            { entries: [], userTypedValue: "example.org", userTypedClear: 0 },
          ],
          selected: 1,
        },
      ],
    };

    waitForBrowserState(state, function () {
      let browser = gBrowser.getBrowserAtIndex(1);
      is(
        browser.currentURI.spec,
        "about:blank",
        "No history entries still sets currentURI to about:blank"
      );
      is(
        browser.userTypedValue,
        "example.org",
        "userTypedValue was correctly restored"
      );
      // didStartLoadSinceLastUserTyping does not exist on lazy tabs.
      if (browser.didStartLoadSinceLastUserTyping) {
        ok(
          !browser.didStartLoadSinceLastUserTyping(),
          "We still know that no load is ongoing"
        );
      }
      is(
        gURLBar.value,
        "about:mozilla",
        "Address bar's value correctly restored"
      );

      // Change tabs to make sure address bar value gets updated.  If tab is
      // lazy, wait for SSTabRestored to ensure address bar has time to update.
      let tabToSelect = gBrowser.tabContainer.getItemAtIndex(1);
      if (tabToSelect.linkedBrowser.isConnected) {
        gBrowser.selectedTab = tabToSelect;
        is(
          gURLBar.value,
          "example.org",
          "Address bar's value correctly updated"
        );
        runNextTest();
      } else {
        gBrowser.tabContainer.addEventListener(
          "SSTabRestored",
          function SSTabRestored(event) {
            if (event.target == tabToSelect) {
              gBrowser.tabContainer.removeEventListener(
                "SSTabRestored",
                SSTabRestored,
                true
              );
              is(
                gURLBar.value,
                "example.org",
                "Address bar's value correctly updated"
              );
              runNextTest();
            }
          },
          true
        );
        gBrowser.selectedTab = tabToSelect;
      }
    });
  }

  // This tests the following use case:
  // User is in a tab with session history, then types something in the
  // address bar, then crashes or quits.
  function test_existingSHEnd_noClear() {
    let state = {
      windows: [
        {
          tabs: [
            {
              entries: [
                { url: "about:mozilla", triggeringPrincipal_base64 },
                { url: "about:config", triggeringPrincipal_base64 },
              ],
              index: 2,
              userTypedValue: "example.com",
              userTypedClear: 0,
            },
          ],
        },
      ],
    };

    waitForBrowserState(state, function () {
      let browser = gBrowser.selectedBrowser;
      is(
        browser.currentURI.spec,
        "about:config",
        "browser.currentURI set to current entry in SH"
      );
      is(
        browser.userTypedValue,
        "example.com",
        "userTypedValue was correctly restored"
      );
      ok(
        !browser.didStartLoadSinceLastUserTyping(),
        "We still know that no load is ongoing"
      );
      is(
        gURLBar.value,
        "example.com",
        "Address bar's value correctly restored to userTypedValue"
      );
      runNextTest();
    });
  }

  // This tests the following use case:
  // User is in a tab with session history, presses back at some point, then
  // types something in the address bar, then crashes or quits.
  function test_existingSHMiddle_noClear() {
    let state = {
      windows: [
        {
          tabs: [
            {
              entries: [
                { url: "about:mozilla", triggeringPrincipal_base64 },
                { url: "about:config", triggeringPrincipal_base64 },
              ],
              index: 1,
              userTypedValue: "example.org",
              userTypedClear: 0,
            },
          ],
        },
      ],
    };

    waitForBrowserState(state, function () {
      let browser = gBrowser.selectedBrowser;
      is(
        browser.currentURI.spec,
        "about:mozilla",
        "browser.currentURI set to current entry in SH"
      );
      is(
        browser.userTypedValue,
        "example.org",
        "userTypedValue was correctly restored"
      );
      ok(
        !browser.didStartLoadSinceLastUserTyping(),
        "We still know that no load is ongoing"
      );
      is(
        gURLBar.value,
        "example.org",
        "Address bar's value correctly restored to userTypedValue"
      );
      runNextTest();
    });
  }

  // This test simulates lots of tabs opening at once and then quitting/crashing.
  function test_getBrowserState_lotsOfTabsOpening() {
    gBrowser.stop();

    let uris = [];
    for (let i = 0; i < 25; i++) {
      uris.push("http://example.com/" + i);
    }

    // We're waiting for the first location change, which should indicate
    // one of the tabs has loaded and the others haven't. So one should
    // be in a non-userTypedValue case, while others should still have
    // userTypedValue and userTypedClear set.
    gBrowser.addTabsProgressListener({
      onLocationChange(aBrowser) {
        if (uris.indexOf(aBrowser.currentURI.spec) > -1) {
          gBrowser.removeTabsProgressListener(this);
          firstLocationChange();
        }
      },
    });

    function firstLocationChange() {
      let state = JSON.parse(ss.getBrowserState());
      let hasUTV = state.windows[0].tabs.some(function (aTab) {
        return (
          aTab.userTypedValue && aTab.userTypedClear && !aTab.entries.length
        );
      });

      ok(
        hasUTV,
        "At least one tab has a userTypedValue with userTypedClear with no loaded URL"
      );

      BrowserTestUtils.waitForMessage(
        gBrowser.selectedBrowser.messageManager,
        "SessionStore:update"
      ).then(firstLoad);
    }

    function firstLoad() {
      let state = JSON.parse(ss.getTabState(gBrowser.selectedTab));
      let hasSH = !("userTypedValue" in state) && state.entries[0].url;
      ok(hasSH, "The selected tab has its entry in SH");

      runNextTest();
    }

    gBrowser.loadTabs(uris, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  }

  // This simulates setting a userTypedValue and ensures that just typing in the
  // URL bar doesn't set userTypedClear as well.
  function test_getBrowserState_userTypedValue() {
    let state = {
      windows: [
        {
          tabs: [{ entries: [] }],
        },
      ],
    };

    waitForBrowserState(state, function () {
      let browser = gBrowser.selectedBrowser;
      // Make sure this tab isn't loading and state is clear before we test.
      is(browser.userTypedValue, null, "userTypedValue is empty to start");
      ok(
        !browser.didStartLoadSinceLastUserTyping(),
        "Initially, no load should be ongoing"
      );

      let inputText = "example.org";
      gURLBar.focus();
      gURLBar.value = inputText.slice(0, -1);
      EventUtils.sendString(inputText.slice(-1));

      executeSoon(function () {
        is(
          browser.userTypedValue,
          "example.org",
          "userTypedValue was set when changing URLBar value"
        );
        ok(
          !browser.didStartLoadSinceLastUserTyping(),
          "No load started since changing URLBar value"
        );

        // Now make sure ss gets these values too
        let newState = JSON.parse(ss.getBrowserState());
        is(
          newState.windows[0].tabs[0].userTypedValue,
          "example.org",
          "sessionstore got correct userTypedValue"
        );
        is(
          newState.windows[0].tabs[0].userTypedClear,
          0,
          "sessionstore got correct userTypedClear"
        );
        runNextTest();
      });
    });
  }

  // test_getBrowserState_lotsOfTabsOpening tested userTypedClear in a few cases,
  // but not necessarily any that had legitimate URIs in the state of loading
  // (eg, "http://example.com"), so this test will cover that case.
  function test_userTypedClearLoadURI() {
    let state = {
      windows: [
        {
          tabs: [
            {
              entries: [],
              userTypedValue: "http://example.com",
              userTypedClear: 2,
            },
          ],
        },
      ],
    };

    waitForBrowserState(state, function () {
      let browser = gBrowser.selectedBrowser;
      is(
        browser.currentURI.spec,
        "http://example.com/",
        "userTypedClear=2 caused userTypedValue to be loaded"
      );
      is(
        browser.userTypedValue,
        null,
        "userTypedValue was null after loading a URI"
      );
      ok(
        !browser.didStartLoadSinceLastUserTyping(),
        "We should have reset the load state when the tab loaded"
      );
      is(
        gURLBar.value,
        BrowserUIUtils.trimURL("http://example.com/"),
        "Address bar's value set after loading URI"
      );
      runNextTest();
    });
  }

  let tests = [
    test_newTabFocused,
    test_newTabNotFocused,
    test_existingSHEnd_noClear,
    test_existingSHMiddle_noClear,
    test_getBrowserState_lotsOfTabsOpening,
    test_getBrowserState_userTypedValue,
    test_userTypedClearLoadURI,
  ];
  let originalState = JSON.parse(ss.getBrowserState());
  let state = {
    windows: [
      {
        tabs: [
          { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        ],
      },
    ],
  };
  function runNextTest() {
    if (tests.length) {
      waitForBrowserState(state, function () {
        gBrowser.selectedBrowser.userTypedValue = null;
        gURLBar.setURI();
        tests.shift()();
      });
    } else {
      waitForBrowserState(originalState, function () {
        gBrowser.selectedBrowser.userTypedValue = null;
        gURLBar.setURI();
        finish();
      });
    }
  }

  // Run the tests!
  runNextTest();
}
