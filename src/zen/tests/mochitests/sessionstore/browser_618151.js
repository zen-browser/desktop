/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const stateBackup = ss.getBrowserState();
const testState = {
  windows: [
    {
      tabs: [
        { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        { entries: [{ url: "about:mozilla", triggeringPrincipal_base64 }] },
      ],
    },
  ],
};

function test() {
  /** Test for Bug 618151 - Overwriting state can lead to unrestored tabs */
  waitForExplicitFinish();
  runNextTest();
}

// Just a subset of tests from bug 615394 that causes a timeout.
var tests = [test_setup, test_hang];
function runNextTest() {
  // set an empty state & run the next test, or finish
  if (tests.length) {
    // Enumerate windows and close everything but our primary window. We can't
    // use waitForFocus() because apparently it's buggy. See bug 599253.
    let closeWinPromises = [];
    for (let currentWindow of Services.wm.getEnumerator("navigator:browser")) {
      if (currentWindow != window) {
        closeWinPromises.push(BrowserTestUtils.closeWindow(currentWindow));
      }
    }

    Promise.all(closeWinPromises).then(() => {
      let currentTest = tests.shift();
      info("running " + currentTest.name);
      waitForBrowserState(testState, currentTest);
    });
  } else {
    ss.setBrowserState(stateBackup);
    executeSoon(finish);
  }
}

function test_setup() {
  function onSSTabRestored() {
    gBrowser.tabContainer.removeEventListener("SSTabRestored", onSSTabRestored);
    runNextTest();
  }

  gBrowser.tabContainer.addEventListener("SSTabRestored", onSSTabRestored);
  ss.setTabState(
    gBrowser.tabs[1],
    JSON.stringify({
      entries: [{ url: "http://example.org", triggeringPrincipal_base64 }],
      extData: { foo: "bar" },
    })
  );
}

function test_hang() {
  ok(true, "test didn't time out");
  runNextTest();
}
