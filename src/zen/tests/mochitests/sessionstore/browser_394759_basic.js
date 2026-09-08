/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TEST_URL =
  "data:text/html;charset=utf-8,<input%20id=txt>" +
  "<input%20type=checkbox%20id=chk>";

/**
 * This test ensures that closing a window is a reversible action. We will
 * close the the window, restore it and check that all data has been restored.
 * This includes window-specific data as well as form data for tabs.
 */
function test() {
  waitForExplicitFinish();

  let uniqueKey = "bug 394759";
  let uniqueValue = "unik" + Date.now();
  let uniqueText = "pi != " + Math.random();

  // Clear the list of closed windows.
  forgetClosedWindows();

  provideWindow(function onTestURLLoaded(newWin) {
    BrowserTestUtils.addTab(newWin.gBrowser).linkedBrowser.stop();

    // Mark the window with some unique data to be restored later on.
    ss.setCustomWindowValue(newWin, uniqueKey, uniqueValue);
    let [txt] = newWin.content.document.querySelectorAll("#txt");
    txt.value = uniqueText;

    let browser = newWin.gBrowser.selectedBrowser;

    setPropertyOfFormField(browser, "#chk", "checked", true).then(() => {
      BrowserTestUtils.closeWindow(newWin).then(() => {
        is(
          ss.getClosedWindowCount(),
          1,
          "The closed window was added to Recently Closed Windows"
        );

        let data = SessionStore.getClosedWindowData();

        // Verify that non JSON serialized data is the same as JSON serialized data.
        is(
          JSON.stringify(data),
          ss.getClosedWindowData(),
          "Non-serialized data is the same as serialized data"
        );

        ok(
          data[0].title == TEST_URL &&
            JSON.stringify(data[0]).indexOf(uniqueText) > -1,
          "The closed window data was stored correctly"
        );

        // Reopen the closed window and ensure its integrity.
        let newWin2 = ss.undoCloseWindow(0);

        ok(
          newWin2.isChromeWindow,
          "undoCloseWindow actually returned a window"
        );
        is(
          ss.getClosedWindowCount(),
          0,
          "The reopened window was removed from Recently Closed Windows"
        );

        // SSTabRestored will fire more than once, so we need to make sure we count them.
        let restoredTabs = 0;
        let expectedTabs = data[0].tabs.length;
        newWin2.addEventListener(
          "SSTabRestored",
          function sstabrestoredListener() {
            ++restoredTabs;
            info("Restored tab " + restoredTabs + "/" + expectedTabs);
            if (restoredTabs < expectedTabs) {
              return;
            }

            is(restoredTabs, expectedTabs, "Correct number of tabs restored");
            newWin2.removeEventListener(
              "SSTabRestored",
              sstabrestoredListener,
              true
            );

            is(
              newWin2.gBrowser.tabs.length,
              2,
              "The window correctly restored 2 tabs"
            );
            is(
              newWin2.gBrowser.currentURI.spec,
              TEST_URL,
              "The window correctly restored the URL"
            );

            let chk;
            [txt, chk] =
              newWin2.content.document.querySelectorAll("#txt, #chk");
            ok(
              txt.value == uniqueText && chk.checked,
              "The window correctly restored the form"
            );
            is(
              ss.getCustomWindowValue(newWin2, uniqueKey),
              uniqueValue,
              "The window correctly restored the data associated with it"
            );

            // Clean up.
            BrowserTestUtils.closeWindow(newWin2).then(finish);
          },
          true
        );
      });
    });
  }, TEST_URL);
}
