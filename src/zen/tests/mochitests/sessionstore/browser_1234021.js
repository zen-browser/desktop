"use strict";

const PREF = "network.cookie.cookieBehavior";
const PAGE_URL =
  "http://mochi.test:8888/browser/" +
  "browser/components/sessionstore/test/browser_1234021_page.html";
const BEHAVIOR_REJECT = 2;

add_task(async function test() {
  await pushPrefs([PREF, BEHAVIOR_REJECT]);

  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: PAGE_URL,
    },
    async function handler(aBrowser) {
      await TabStateFlusher.flush(aBrowser);
      ok(true, "Flush didn't time out");
    }
  );
});
