"use strict";

/**
 * Tests that cookies are stored and restored correctly
 * by sessionstore (bug 423132).
 */
add_task(async function () {
  const testURL =
    "http://mochi.test:8888/browser/" +
    "browser/components/sessionstore/test/browser_423132_sample.html";

  Services.cookies.removeAll();
  // make sure that sessionstore.js can be forced to be created by setting
  // the interval pref to 0
  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.interval", 0]],
  });

  let tab = BrowserTestUtils.addTab(gBrowser, testURL);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await TabStateFlusher.flush(tab.linkedBrowser);

  // get the sessionstore state for the window
  let state = ss.getBrowserState();

  // verify our cookie got set during pageload
  let i = 0;
  for (var cookie of Services.cookies.cookies) {
    i++;
  }
  Assert.equal(i, 1, "expected one cookie");

  // remove the cookie
  Services.cookies.removeAll();

  // restore the window state
  await setBrowserState(state);

  // at this point, the cookie should be restored...
  for (var cookie2 of Services.cookies.cookies) {
    if (cookie.name == cookie2.name) {
      break;
    }
  }
  is(cookie.name, cookie2.name, "cookie name successfully restored");
  is(cookie.value, cookie2.value, "cookie value successfully restored");
  is(cookie.path, cookie2.path, "cookie path successfully restored");

  // clean up
  Services.cookies.removeAll();
  BrowserTestUtils.removeTab(gBrowser.tabs[1]);
});
