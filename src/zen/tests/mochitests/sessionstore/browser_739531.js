/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// This test ensures that attempts made to save/restore ("duplicate") pages
// using designmode AND make changes to document structure (remove body)
// don't result in uncaught errors and a broken browser state.

function test() {
  waitForExplicitFinish();

  let testURL =
    "http://mochi.test:8888/browser/" +
    "browser/components/sessionstore/test/browser_739531_sample.html";

  let loadCount = 0;
  let tab = BrowserTestUtils.addTab(gBrowser, testURL);

  let removeFunc;
  removeFunc = BrowserTestUtils.addContentEventListener(
    tab.linkedBrowser,
    "load",
    function onLoad() {
      // make sure both the page and the frame are loaded
      if (++loadCount < 2) {
        return;
      }
      removeFunc();

      // executeSoon to allow the JS to execute on the page
      executeSoon(function () {
        let tab2;
        let caughtError = false;
        try {
          tab2 = ss.duplicateTab(window, tab);
        } catch (e) {
          caughtError = true;
          info(e);
        }

        is(gBrowser.tabs.length, 3, "there should be 3 tabs");

        ok(!caughtError, "duplicateTab didn't throw");

        // if the test fails, we don't want to try to close a tab that doesn't exist
        if (tab2) {
          gBrowser.removeTab(tab2);
        }
        gBrowser.removeTab(tab);

        finish();
      });
    },
    true
  );
}
