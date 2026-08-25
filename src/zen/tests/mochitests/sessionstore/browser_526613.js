/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 526613 */

  // test setup
  waitForExplicitFinish();

  function browserWindowsCount(expected) {
    let count = 0;
    for (let win of Services.wm.getEnumerator("navigator:browser")) {
      if (!win.closed) {
        ++count;
      }
    }
    is(
      count,
      expected,
      "number of open browser windows according to nsIWindowMediator"
    );
    let state = ss.getBrowserState();
    info(state);
    is(
      JSON.parse(state).windows.length,
      expected,
      "number of open browser windows according to getBrowserState"
    );
  }

  browserWindowsCount(1);

  // backup old state
  let oldState = ss.getBrowserState();
  // create a new state for testing
  let testState = {
    windows: [
      { tabs: [{ entries: [{ url: "http://example.com/" }] }], selected: 1 },
      { tabs: [{ entries: [{ url: "about:mozilla" }] }], selected: 1 },
    ],
    // make sure the first window is focused, otherwise when restoring the
    // old state, the first window is closed and the test harness gets unloaded
    selectedWindow: 1,
  };

  let pass = 1;
  function observer(aSubject, aTopic) {
    is(
      aTopic,
      "sessionstore-browser-state-restored",
      "The sessionstore-browser-state-restored notification was observed"
    );

    if (pass++ == 1) {
      browserWindowsCount(2);

      // let the first window be focused (see above)
      function pollMostRecentWindow() {
        if (Services.wm.getMostRecentWindow("navigator:browser") == window) {
          ss.setBrowserState(oldState);
        } else {
          info("waiting for the current window to become active");
          setTimeout(pollMostRecentWindow, 0);
          window.focus(); // XXX Why is this needed?
        }
      }
      pollMostRecentWindow();
    } else {
      browserWindowsCount(1);
      ok(
        !window.closed,
        "Restoring the old state should have left this window open"
      );
      Services.obs.removeObserver(
        observer,
        "sessionstore-browser-state-restored"
      );
      finish();
    }
  }
  Services.obs.addObserver(observer, "sessionstore-browser-state-restored");

  // set browser to test state
  ss.setBrowserState(JSON.stringify(testState));
}
