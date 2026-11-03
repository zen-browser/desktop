/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 461743 */

  waitForExplicitFinish();

  let testURL =
    "http://mochi.test:8888/browser/" +
    "browser/components/sessionstore/test/browser_461743_sample.html";

  let frameCount = 0;
  let tab = BrowserTestUtils.addTab(gBrowser, testURL);
  tab.linkedBrowser.addEventListener(
    "load",
    function loadListener(aEvent) {
      // Wait for all frames to load completely.
      if (frameCount++ < 2) {
        return;
      }
      tab.linkedBrowser.removeEventListener("load", loadListener, true);
      let tab2 = gBrowser.duplicateTab(tab);
      tab2.linkedBrowser.addEventListener(
        "461743",
        function listener() {
          tab2.linkedBrowser.removeEventListener("461743", listener, true);
          is(aEvent.data, "done", "XSS injection was attempted");

          executeSoon(function () {
            let iframes = tab2.linkedBrowser.contentWindow.frames;
            let innerHTML = iframes[1].document.body.innerHTML;
            isnot(
              innerHTML,
              Cu.reportError.toString(),
              "chrome access denied!"
            );

            // Clean up.
            gBrowser.removeTab(tab2);
            gBrowser.removeTab(tab);

            finish();
          });
        },
        true,
        true
      );
    },
    true
  );
}
