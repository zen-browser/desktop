"use strict";

const STATE = {
  entries: [{ url: "about:robots" }, { url: "about:mozilla" }],
  selected: 2,
};

/**
 * Bug 1100223. Calling browser.loadURI() while a tab is loading causes
 * sessionstore to override the desired target URL. This test ensures that
 * calling loadURI() on a pending tab causes the tab to no longer be marked
 * as pending and correctly finish the instructed load while keeping the
 * restored history around.
 */
add_task(async function () {
  await testSwitchToTab("about:mozilla#fooobar", {
    ignoreFragment: "whenComparingAndReplace",
  });
  await testSwitchToTab("about:mozilla?foo=bar", { replaceQueryString: true });
});

var testSwitchToTab = async function (url, options) {
  // Create a background tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // The tab shouldn't be restored right away.
  Services.prefs.setBoolPref("browser.sessionstore.restore_on_demand", true);

  // Prepare the tab state.
  let promise = promiseTabRestoring(tab);
  ss.setTabState(tab, JSON.stringify(STATE));
  ok(tab.hasAttribute("pending"), "tab is pending");
  await promise;

  options.triggeringPrincipal =
    Services.scriptSecurityManager.getSystemPrincipal();

  // Switch-to-tab with a similar URI.
  switchToTabHavingURI(url, false, options);

  // Tab should now restore
  await promiseTabRestored(tab);
  is(browser.currentURI.spec, url, "correct URL loaded");

  // Check that we didn't lose any history entries.
  await SpecialPowers.spawn(browser, [], async function () {
    let webNavigation = docShell.QueryInterface(Ci.nsIWebNavigation);
    let history = webNavigation.sessionHistory;
    Assert.equal(history && history.count, 3, "three history entries");
  });

  // Cleanup.
  gBrowser.removeTab(tab);
};
