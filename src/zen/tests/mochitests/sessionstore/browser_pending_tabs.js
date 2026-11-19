"use strict";

const TAB_STATE = {
  entries: [
    { url: "about:mozilla", triggeringPrincipal_base64 },
    { url: "about:robots", triggeringPrincipal_base64 },
  ],
  index: 1,
};

add_task(async function () {
  // Create a background tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  // The tab shouldn't be restored right away.
  Services.prefs.setBoolPref("browser.sessionstore.restore_on_demand", true);

  // Prepare the tab state.
  let promise = promiseTabRestoring(tab);
  ss.setTabState(tab, JSON.stringify(TAB_STATE));
  ok(tab.hasAttribute("pending"), "tab is pending");
  await promise;

  // Flush to ensure the parent has all data.
  await TabStateFlusher.flush(browser);

  // Check that the shistory index is the one we restored.
  let tabState = TabState.collect(tab, ss.getInternalObjectState(tab));
  is(tabState.index, TAB_STATE.index, "correct shistory index");

  // Check we don't collect userTypedValue when we shouldn't.
  ok(!tabState.userTypedValue, "tab didn't have a userTypedValue");

  // Cleanup.
  gBrowser.removeTab(tab);
});
