/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

requestLongerTimeout(2);

var stateBackup = JSON.parse(ss.getBrowserState());

function test() {
  /** Test for Bug 600545 */
  waitForExplicitFinish();
  testBug600545();
}

function testBug600545() {
  // Set the pref to false to cause non-app tabs to be stripped out on a save
  Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", false);
  Services.prefs.setIntPref("browser.sessionstore.interval", 2000);

  registerCleanupFunction(function () {
    Services.prefs.clearUserPref("browser.sessionstore.resume_from_crash");
    Services.prefs.clearUserPref("browser.sessionstore.interval");
  });

  // This tests the following use case: When multiple windows are open
  // and browser.sessionstore.resume_from_crash preference is false,
  // tab session data for non-active window is stripped for non-pinned
  // tabs.  This occurs after "sessionstore-state-write-complete"
  // fires which will only fire in this case if there is at least one
  // pinned tab.
  let state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              { url: "http://example.org#0", triggeringPrincipal_base64 },
            ],
            pinned: true,
          },
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
        ],
        selected: 2,
      },
      {
        tabs: [
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
          {
            entries: [
              { url: "http://example.com#6", triggeringPrincipal_base64 },
            ],
          },
        ],
        selected: 3,
      },
    ],
  };

  waitForBrowserState(state, function () {
    // Need to wait for SessionStore's saveState function to be called
    // so that non-pinned tabs will be stripped from non-active window
    waitForSaveState(function () {
      let expectedNumberOfTabs = getStateTabCount(state);
      let retrievedState = JSON.parse(ss.getBrowserState());
      let actualNumberOfTabs = getStateTabCount(retrievedState);

      is(
        actualNumberOfTabs,
        expectedNumberOfTabs,
        "Number of tabs in retreived session data, matches number of tabs set."
      );

      done();
    });
  });
}

function done() {
  // Enumerate windows and close everything but our primary window. We can't
  // use waitForFocus() because apparently it's buggy. See bug 599253.
  let closeWinPromises = [];
  for (let currentWindow of Services.wm.getEnumerator("navigator:browser")) {
    if (currentWindow != window) {
      closeWinPromises.push(BrowserTestUtils.closeWindow(currentWindow));
    }
  }

  Promise.all(closeWinPromises).then(() => {
    waitForBrowserState(stateBackup, finish);
  });
}

// Count up the number of tabs in the state data
function getStateTabCount(aState) {
  let tabCount = 0;
  for (let i in aState.windows) {
    tabCount += aState.windows[i].tabs.length;
  }
  return tabCount;
}
