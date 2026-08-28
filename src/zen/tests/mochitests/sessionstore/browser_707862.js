/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
/* eslint-disable mozilla/no-arbitrary-setTimeout */

const tabState = {
  entries: [
    {
      url: "about:robots",
      triggeringPrincipal_base64,
      children: [{ url: "about:mozilla", triggeringPrincipal_base64 }],
    },
  ],
};

const blankState = {
  windows: [
    {
      tabs: [
        {
          entries: [{ url: "about:blank", triggeringPrincipal_base64 }],
        },
      ],
    },
  ],
};

add_task(async function test() {
  Services.prefs.setIntPref("browser.sessionstore.interval", 4000);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref("browser.sessionstore.interval");
  });

  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, false, "about:blank");

  await promiseTabState(tab, tabState);
  let sessionHistory = browser.browsingContext.sessionHistory;
  let entry = sessionHistory.getEntryAtIndex(0);

  await whenChildCount(entry, 1);

  // Create a dynamic subframe.
  let doc = browser.contentDocument;
  let iframe = doc.createElement("iframe");
  iframe.setAttribute("src", "about:mozilla");
  doc.body.appendChild(iframe);

  await whenChildCount(entry, 2);

  // Force reload the browser to deprecate the subframes.
  browser.reloadWithFlags(Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);

  await BrowserTestUtils.browserLoaded(browser, false, "about:robots");
  let newSessionHistory = browser.browsingContext.sessionHistory;
  let newEntry = newSessionHistory.getEntryAtIndex(0);

  await whenChildCount(newEntry, 0);
  // Make sure that we reset the state.
  waitForBrowserState(blankState, finish);

  ok(true, "test passed");
});

function whenChildCount(aEntry, aChildCount) {
  return TestUtils.waitForCondition(
    () => aEntry.childCount == aChildCount,
    "wait for child count"
  );
}
