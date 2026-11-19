/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 464620 (injection on DOM node insertion) */

  waitForExplicitFinish();

  let testURL =
    "http://mochi.test:8888/browser/" +
    "browser/components/sessionstore/test/browser_464620_b.html";

  var frameCount = 0;
  let tab = BrowserTestUtils.addTab(gBrowser, testURL);
  tab.linkedBrowser.addEventListener(
    "load",
    function loadListener(aEvent) {
      // wait for all frames to load completely
      if (frameCount++ < 6) {
        return;
      }
      this.removeEventListener("load", loadListener, true);

      executeSoon(function () {
        frameCount = 0;
        let tab2 = gBrowser.duplicateTab(tab);
        tab2.linkedBrowser.addEventListener(
          "464620_b",
          function listener() {
            tab2.linkedBrowser.removeEventListener("464620_b", listener, true);
            is(aEvent.data, "done", "XSS injection was attempted");

            // let form restoration complete and take into account the
            // setTimeout(..., 0) in sss_restoreDocument_proxy
            executeSoon(function () {
              setTimeout(function () {
                let win = tab2.linkedBrowser.contentWindow;
                isnot(
                  win.frames[1].document.location,
                  testURL,
                  "cross domain document was loaded"
                );
                ok(
                  !/XXX/.test(win.frames[1].document.body.innerHTML),
                  "no content was injected"
                );

                // clean up
                gBrowser.removeTab(tab2);
                gBrowser.removeTab(tab);

                finish();
              }, 0);
            });
          },
          true,
          true
        );
      });
    },
    true
  );
}
