"use strict";

/**
 * This set of tests checks that the remoteness is properly
 * set for each browser in a window when that window has
 * session state loaded into it.
 */

/**
 * Takes a SessionStore window state object for a single
 * window, sets the selected tab for it, and then returns
 * the object to be passed to SessionStore.setWindowState.
 *
 * @param state (object)
 *        The state to prepare to be sent to a window. This is
 *        state should just be for a single window.
 * @param selected (int)
 *        The 1-based index of the selected tab. Note that
 *        If this is 0, then the selected tab will not change
 *        from what's already selected in the window that we're
 *        sending state to.
 * @returns (object)
 *        The JSON encoded string to call
 *        SessionStore.setWindowState with.
 */
function prepareState(state, selected) {
  // We'll create a copy so that we don't accidentally
  // modify the caller's selected property.
  let copy = {};
  Object.assign(copy, state);
  copy.selected = selected;

  return {
    windows: [copy],
  };
}

const SIMPLE_STATE = {
  tabs: [
    {
      entries: [
        {
          url: "http://example.com/",
          triggeringPrincipal_base64,
          title: "title",
        },
      ],
    },
    {
      entries: [
        {
          url: "http://example.com/",
          triggeringPrincipal_base64,
          title: "title",
        },
      ],
    },
    {
      entries: [
        {
          url: "http://example.com/",
          triggeringPrincipal_base64,
          title: "title",
        },
      ],
    },
  ],
  title: "",
  _closedTabs: [],
};

const PINNED_STATE = {
  tabs: [
    {
      entries: [
        {
          url: "http://example.com/",
          triggeringPrincipal_base64,
          title: "title",
        },
      ],
      pinned: true,
    },
    {
      entries: [
        {
          url: "http://example.com/",
          triggeringPrincipal_base64,
          title: "title",
        },
      ],
      pinned: true,
    },
    {
      entries: [
        {
          url: "http://example.com/",
          triggeringPrincipal_base64,
          title: "title",
        },
      ],
    },
  ],
  title: "",
  _closedTabs: [],
};

/**
 * This is where most of the action is happening. This function takes
 * an Array of "test scenario" Objects and runs them. For each scenario, a
 * window is opened, put into some state, and then a new state is
 * loaded into that window. We then check to make sure that the
 * right things have happened in that window wrt remoteness flips.
 *
 * The schema for a testing scenario Object is as follows:
 *
 * initialRemoteness:
 *   an Array that represents the starting window. Each bool
 *   in the Array represents the window tabs in order. A "true"
 *   indicates that that tab should be remote. "false" if the tab
 *   should be non-remote.
 *
 * initialSelectedTab:
 *   The 1-based index of the tab that we want to select for the
 *   restored window. This is 1-based to avoid confusion with the
 *   selectedTab property described down below, though you probably
 *   want to set this to be greater than 0, since the initial window
 *   needs to have a defined initial selected tab. Because of this,
 *   the test will throw if initialSelectedTab is 0.
 *
 * stateToRestore:
 *   A JS Object for the state to send down to the window.
 *
 * selectedTab:
 *   The 1-based index of the tab that we want to select for the
 *   restored window. Leave this at 0 if you don't want to change
 *   the selection from the initial window state.
 *
 * expectedRemoteness:
 *   an Array that represents the window that we end up with after
 *   restoring state. Each bool in the Array represents the window
 *   tabs in order. A "true" indicates that the tab be remote, and
 *   a "false" indicates that the tab should be "non-remote". We
 *   need this Array in order to test pinned tabs which will also
 *   be loaded by default, and therefore should end up remote.
 *
 */
async function runScenarios(scenarios) {
  for (let [scenarioIndex, scenario] of scenarios.entries()) {
    info("Running scenario " + scenarioIndex);
    Assert.greater(
      scenario.initialSelectedTab,
      0,
      "You must define an initially selected tab"
    );

    // First, we need to create the initial conditions, so we
    // open a new window to put into our starting state...
    let win = await BrowserTestUtils.openNewBrowserWindow();
    let tabbrowser = win.gBrowser;
    Assert.ok(
      tabbrowser.selectedBrowser.isRemoteBrowser,
      "The initial browser should be remote."
    );
    // Now put the window into the expected initial state.
    for (let i = 0; i < scenario.initialRemoteness.length; ++i) {
      let tab;
      if (i > 0) {
        // The window starts with one tab, so we need to create
        // any of the additional ones required by this test.
        info("Opening a new tab");
        tab = await BrowserTestUtils.openNewForegroundTab(tabbrowser);
      } else {
        info("Using the selected tab");
        tab = tabbrowser.selectedTab;
      }
      let browser = tab.linkedBrowser;
      let remotenessState = scenario.initialRemoteness[i]
        ? E10SUtils.DEFAULT_REMOTE_TYPE
        : E10SUtils.NOT_REMOTE;
      tabbrowser.updateBrowserRemoteness(browser, {
        remoteType: remotenessState,
      });
    }

    // And select the requested tab.
    let tabToSelect = tabbrowser.tabs[scenario.initialSelectedTab - 1];
    if (tabbrowser.selectedTab != tabToSelect) {
      await BrowserTestUtils.switchTab(tabbrowser, tabToSelect);
    }

    // Okay, time to test!
    let state = prepareState(scenario.stateToRestore, scenario.selectedTab);

    await setWindowState(win, state, true);

    for (let i = 0; i < scenario.expectedRemoteness.length; ++i) {
      let expectedRemoteness = scenario.expectedRemoteness[i];
      let tab = tabbrowser.tabs[i];

      Assert.equal(
        tab.linkedBrowser.isRemoteBrowser,
        expectedRemoteness,
        "Should have gotten the expected remoteness " +
          `for the tab at index ${i}`
      );
    }

    await BrowserTestUtils.closeWindow(win);
  }
}

/**
 * Tests that if we restore state to browser windows with
 * a variety of initial remoteness states. For this particular
 * set of tests, we assume that tabs are restoring on demand.
 */
add_task(async function () {
  // This test opens and closes windows, which might bog down
  // a debug build long enough to time out the test, so we
  // extend the tolerance on timeouts.
  requestLongerTimeout(5);

  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.restore_on_demand", true]],
  });

  const TEST_SCENARIOS = [
    // Only one tab in the new window, and it's remote. This
    // is the common case, since this is how restoration occurs
    // when the restored window is being opened.
    {
      initialRemoteness: [true],
      initialSelectedTab: 1,
      stateToRestore: SIMPLE_STATE,
      selectedTab: 3,
      // All tabs should now be remote.
      expectedRemoteness: [true, true, true],
    },

    // A single remote tab, and this is the one that's going
    // to be selected once state is restored.
    {
      initialRemoteness: [true],
      initialSelectedTab: 1,
      stateToRestore: SIMPLE_STATE,
      selectedTab: 1,
      // All tabs should now be remote.
      expectedRemoteness: [true, true, true],
    },

    // A single remote tab which starts selected. We set the
    // selectedTab to 0 which is equivalent to "don't change
    // the tab selection in the window".
    {
      initialRemoteness: [true],
      initialSelectedTab: 1,
      stateToRestore: SIMPLE_STATE,
      selectedTab: 0,
      // All tabs should now be remote.
      expectedRemoteness: [true, true, true],
    },

    // An initially remote tab, but we're going to load
    // some pinned tabs now, and the pinned tabs should load
    // right away.
    {
      initialRemoteness: [true],
      initialSelectedTab: 1,
      stateToRestore: PINNED_STATE,
      selectedTab: 3,
      // Both pinned tabs and the selected tabs should all
      // end up being remote.
      expectedRemoteness: [true, true, true],
    },

    // A single non-remote tab.
    {
      initialRemoteness: [false],
      initialSelectedTab: 1,
      stateToRestore: SIMPLE_STATE,
      selectedTab: 2,
      // All tabs should now be remote.
      expectedRemoteness: [true, true, true],
    },

    // A mixture of remote and non-remote tabs.
    {
      initialRemoteness: [true, false, true],
      initialSelectedTab: 1,
      stateToRestore: SIMPLE_STATE,
      selectedTab: 3,
      // All tabs should now be remote.
      expectedRemoteness: [true, true, true],
    },

    // An initially non-remote tab, but we're going to load
    // some pinned tabs now, and the pinned tabs should load
    // right away.
    {
      initialRemoteness: [false],
      initialSelectedTab: 1,
      stateToRestore: PINNED_STATE,
      selectedTab: 3,
      // All tabs should now be remote.
      expectedRemoteness: [true, true, true],
    },
  ];

  await runScenarios(TEST_SCENARIOS);
});
