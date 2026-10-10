/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* eslint-disable mozilla/no-arbitrary-setTimeout */

function test() {
  /** Test for Bug 459906 */

  waitForExplicitFinish();

  let testURL =
    "http://mochi.test:8888/browser/" +
    "browser/components/sessionstore/test/browser_459906_sample.html";
  let uniqueValue = "<b>Unique:</b> " + Date.now();

  var frameCount = 0;
  let tab = BrowserTestUtils.addTab(gBrowser, testURL);
  tab.linkedBrowser.addEventListener(
    "load",
    function listener() {
      // wait for all frames to load completely
      if (frameCount++ < 2) {
        return;
      }
      tab.linkedBrowser.removeEventListener("load", listener, true);

      let iframes = tab.linkedBrowser.contentWindow.frames;
      iframes[1].document.body.innerHTML = uniqueValue;

      frameCount = 0;
      let tab2 = gBrowser.duplicateTab(tab);
      tab2.linkedBrowser.addEventListener(
        "load",
        function loadListener() {
          // wait for all frames to load (and reload!) completely
          if (frameCount++ < 2) {
            return;
          }
          tab2.linkedBrowser.removeEventListener("load", loadListener, true);

          executeSoon(function innerHTMLPoller() {
            let iframesTab2 = tab2.linkedBrowser.contentWindow.frames;
            if (iframesTab2[1].document.body.innerHTML !== uniqueValue) {
              // Poll again the value, since we can't ensure to run
              // after SessionStore has injected innerHTML value.
              // See bug 521802.
              info("Polling for innerHTML value");
              setTimeout(innerHTMLPoller, 100);
              return;
            }

            is(
              iframesTab2[1].document.body.innerHTML,
              uniqueValue,
              "rich textarea's content correctly duplicated"
            );

            let innerDomain = null;
            try {
              innerDomain = iframesTab2[0].document.domain;
            } catch (ex) {
              /* throws for chrome: documents */
            }
            is(innerDomain, "mochi.test", "XSS exploit prevented!");

            // clean up
            gBrowser.removeTab(tab2);
            gBrowser.removeTab(tab);

            finish();
          });
        },
        true
      );
    },
    true
  );
}
