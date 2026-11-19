/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 524745 */

  let uniqKey = "bug524745";
  let uniqVal = Date.now().toString();

  waitForExplicitFinish();

  whenNewWindowLoaded({ private: false }, function (window_B) {
    waitForFocus(function () {
      // Add identifying information to window_B
      ss.setCustomWindowValue(window_B, uniqKey, uniqVal);
      let state = JSON.parse(ss.getBrowserState());
      let selectedWindow = state.windows[state.selectedWindow - 1];
      is(
        selectedWindow.extData && selectedWindow.extData[uniqKey],
        uniqVal,
        "selectedWindow is window_B"
      );

      // Now minimize window_B. The selected window shouldn't have the secret data
      window_B.minimize();
      waitForFocus(async function () {
        state = JSON.parse(ss.getBrowserState());
        selectedWindow = state.windows[state.selectedWindow - 1];
        ok(
          !selectedWindow.extData || !selectedWindow.extData[uniqKey],
          "selectedWindow is not window_B after minimizing it"
        );

        // Now minimize the last open window (assumes no other tests left windows open)
        let promiseSizeModeChange = BrowserTestUtils.waitForEvent(
          window,
          "sizemodechange"
        );
        window.minimize();
        await promiseSizeModeChange;
        state = JSON.parse(ss.getBrowserState());
        is(
          state.selectedWindow,
          0,
          "selectedWindow should be 0 when all windows are minimized"
        );

        // Cleanup
        window.restore();
        BrowserTestUtils.closeWindow(window_B).then(finish);
      });
    }, window_B);
  });
}
