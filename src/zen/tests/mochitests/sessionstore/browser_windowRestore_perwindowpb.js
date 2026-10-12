/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This test checks that closed private windows can't be restored

function test() {
  waitForExplicitFinish();

  // Purging the list of closed windows
  forgetClosedWindows();

  // Load a private window, then close it
  // and verify it doesn't get remembered for restoring
  whenNewWindowLoaded({ private: true }, function (win) {
    info("The private window got loaded");
    win.addEventListener(
      "SSWindowClosing",
      function () {
        executeSoon(function () {
          is(
            ss.getClosedWindowCount(),
            0,
            "The private window should not have been stored"
          );
        });
      },
      { once: true }
    );
    BrowserTestUtils.closeWindow(win).then(finish);
  });
}
