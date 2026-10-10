/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mirrors WINDOW_ATTRIBUTES IN SessionStore.sys.mjs
const WINDOW_ATTRIBUTES = ["width", "height", "screenX", "screenY", "sizemode"];

var stateBackup = ss.getBrowserState();

var originalWarnOnClose = Services.prefs.getBoolPref(
  "browser.tabs.warnOnClose"
);
var originalStartupPage = Services.prefs.getIntPref("browser.startup.page");
var originalWindowType = document.documentElement.getAttribute("windowtype");

var gotLastWindowClosedTopic = false;
var shouldPinTab = false;
var shouldOpenTabs = false;
var shouldCloseTab = false;
var testNum = 0;
var afterTestCallback;

// Set state so we know the closed windows content
var testState = {
  windows: [{ tabs: [{ entries: [{ url: "http://example.org" }] }] }],
  _closedWindows: [],
};

// We'll push a set of conditions and callbacks into this array
// Ideally we would also test win/linux under a complete set of conditions, but
// the tests for osx mirror the other set of conditions possible on win/linux.
var tests = [];

// the third & fourth test share a condition check, keep it DRY
function checkOSX34Generator(num) {
  return function (aPreviousState, aCurState) {
    // In here, we should have restored the pinned tab, so only the unpinned tab
    // should be in aCurState. So let's shape our expectations.
    let expectedState = JSON.parse(aPreviousState);
    expectedState[0].tabs.shift();
    // size attributes are stripped out in _prepDataForDeferredRestore in SessionStore.sys.mjs.
    // This isn't the best approach, but neither is comparing JSON strings
    WINDOW_ATTRIBUTES.forEach(attr => delete expectedState[0][attr]);

    is(
      aCurState,
      JSON.stringify(expectedState),
      "test #" + num + ": closedWindowState is as expected"
    );
  };
}
function checkNoWindowsGenerator(num) {
  return function (aPreviousState, aCurState) {
    is(
      aCurState,
      "[]",
      "test #" + num + ": there should be no closedWindowsLeft"
    );
  };
}

// The first test has 0 pinned tabs and 1 unpinned tab
tests.push({
  pinned: false,
  extra: false,
  close: false,
  checkWinLin: checkNoWindowsGenerator(1),
  checkOSX(aPreviousState, aCurState) {
    is(aCurState, aPreviousState, "test #1: closed window state is unchanged");
  },
});

// The second test has 1 pinned tab and 0 unpinned tabs.
tests.push({
  pinned: true,
  extra: false,
  close: false,
  checkWinLin: checkNoWindowsGenerator(2),
  checkOSX: checkNoWindowsGenerator(2),
});

// The third test has 1 pinned tab and 2 unpinned tabs.
tests.push({
  pinned: true,
  extra: true,
  close: false,
  checkWinLin: checkNoWindowsGenerator(3),
  checkOSX: checkOSX34Generator(3),
});

// The fourth test has 1 pinned tab, 2 unpinned tabs, and closes one unpinned tab.
tests.push({
  pinned: true,
  extra: true,
  close: "one",
  checkWinLin: checkNoWindowsGenerator(4),
  checkOSX: checkOSX34Generator(4),
});

// The fifth test has 1 pinned tab, 2 unpinned tabs, and closes both unpinned tabs.
tests.push({
  pinned: true,
  extra: true,
  close: "both",
  checkWinLin: checkNoWindowsGenerator(5),
  checkOSX: checkNoWindowsGenerator(5),
});

function test() {
  /**
   * Test for Bug 589246 - Closed window state getting corrupted when closing
   * and reopening last browser window without exiting browser
   */
  waitForExplicitFinish();
  // windows opening & closing, so extending the timeout
  requestLongerTimeout(2);

  // We don't want the quit dialog pref
  Services.prefs.setBoolPref("browser.tabs.warnOnClose", false);
  // Ensure that we would restore the session (important for Windows)
  Services.prefs.setIntPref("browser.startup.page", 3);

  runNextTestOrFinish();
}

function runNextTestOrFinish() {
  if (tests.length) {
    setupForTest(tests.shift());
  } else {
    // some state is cleaned up at the end of each test, but not all
    ["browser.tabs.warnOnClose", "browser.startup.page"].forEach(function (p) {
      if (Services.prefs.prefHasUserValue(p)) {
        Services.prefs.clearUserPref(p);
      }
    });

    ss.setBrowserState(stateBackup);
    executeSoon(finish);
  }
}

function setupForTest(aConditions) {
  // reset some checks
  gotLastWindowClosedTopic = false;
  shouldPinTab = aConditions.pinned;
  shouldOpenTabs = aConditions.extra;
  shouldCloseTab = aConditions.close;
  testNum++;

  // set our test callback
  afterTestCallback = /Mac/.test(navigator.platform)
    ? aConditions.checkOSX
    : aConditions.checkWinLin;

  // Add observers
  Services.obs.addObserver(
    onLastWindowClosed,
    "browser-lastwindow-close-granted"
  );

  // Set the state
  Services.obs.addObserver(
    onStateRestored,
    "sessionstore-browser-state-restored"
  );
  ss.setBrowserState(JSON.stringify(testState));
}

function onStateRestored() {
  info("test #" + testNum + ": onStateRestored");
  Services.obs.removeObserver(
    onStateRestored,
    "sessionstore-browser-state-restored"
  );

  // change this window's windowtype so that closing a new window will trigger
  // browser-lastwindow-close-granted.
  document.documentElement.setAttribute("windowtype", "navigator:testrunner");

  let newWin = openDialog(
    location,
    "_blank",
    "chrome,all,dialog=no",
    "http://example.com"
  );
  newWin.addEventListener(
    "load",
    function () {
      promiseBrowserLoaded(newWin.gBrowser.selectedBrowser).then(() => {
        // pin this tab
        if (shouldPinTab) {
          newWin.gBrowser.pinTab(newWin.gBrowser.selectedTab);
        }

        newWin.addEventListener(
          "unload",
          function () {
            onWindowUnloaded();
          },
          { once: true }
        );
        // Open a new tab as well. On Windows/Linux this will be restored when the
        // new window is opened below (in onWindowUnloaded). On OS X we'll just
        // restore the pinned tabs, leaving the unpinned tab in the closedWindowsData.
        if (shouldOpenTabs) {
          let newTab = BrowserTestUtils.addTab(newWin.gBrowser, "about:config");
          let newTab2 = BrowserTestUtils.addTab(
            newWin.gBrowser,
            "about:buildconfig"
          );

          newTab.linkedBrowser.addEventListener(
            "load",
            function () {
              if (shouldCloseTab == "one") {
                newWin.gBrowser.removeTab(newTab2);
              } else if (shouldCloseTab == "both") {
                newWin.gBrowser.removeTab(newTab);
                newWin.gBrowser.removeTab(newTab2);
              }
              newWin.BrowserCommands.tryToCloseWindow();
            },
            { capture: true, once: true }
          );
        } else {
          newWin.BrowserCommands.tryToCloseWindow();
        }
      });
    },
    { once: true }
  );
}

// This will be called before the window is actually closed
function onLastWindowClosed() {
  info("test #" + testNum + ": onLastWindowClosed");
  Services.obs.removeObserver(
    onLastWindowClosed,
    "browser-lastwindow-close-granted"
  );
  gotLastWindowClosedTopic = true;
}

// This is the unload event listener on the new window (from onStateRestored).
// Unload is fired after the window is closed, so sessionstore has already
// updated _closedWindows (which is important). We'll open a new window here
// which should actually trigger the bug.
function onWindowUnloaded() {
  info("test #" + testNum + ": onWindowClosed");
  ok(
    gotLastWindowClosedTopic,
    "test #" + testNum + ": browser-lastwindow-close-granted was notified prior"
  );

  let previousClosedWindowData = ss.getClosedWindowData();

  // Now we want to open a new window
  let newWin = openDialog(
    location,
    "_blank",
    "chrome,all,dialog=no",
    "about:mozilla"
  );
  newWin.addEventListener(
    "load",
    function () {
      newWin.gBrowser.selectedBrowser.addEventListener(
        "load",
        function () {
          // Good enough for checking the state
          afterTestCallback(previousClosedWindowData, ss.getClosedWindowData());
          afterTestCleanup(newWin);
        },
        { capture: true, once: true }
      );
    },
    { once: true }
  );
}

function afterTestCleanup(aNewWin) {
  executeSoon(function () {
    BrowserTestUtils.closeWindow(aNewWin).then(() => {
      document.documentElement.setAttribute("windowtype", originalWindowType);
      runNextTestOrFinish();
    });
  });
}
