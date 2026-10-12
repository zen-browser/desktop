"use strict";

/**
 * This test checks that pending tabs are treated like fully loaded tabs when
 * purging session history. Just like for fully loaded tabs we want to remove
 * every but the current shistory entry.
 */

const TAB_STATE = {
  entries: [
    { url: "about:mozilla", triggeringPrincipal_base64 },
    { url: "about:robots", triggeringPrincipal_base64 },
  ],
  index: 1,
};

function checkTabContents(browser) {
  return SpecialPowers.spawn(browser, [], async function () {
    let webNavigation = docShell.QueryInterface(Ci.nsIWebNavigation);
    let history = webNavigation.sessionHistory;
    Assert.ok(
      history &&
        history.count == 1 &&
        content.document.documentURI == "about:mozilla",
      "expected tab contents found"
    );
  });
}

add_task(async function () {
  // Create a new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });
  await promiseTabState(tab, TAB_STATE);

  // Create another new tab.
  let tab2 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser2 = tab2.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser2, { wantLoad: "about:blank" });

  // The tab shouldn't be restored right away.
  Services.prefs.setBoolPref("browser.sessionstore.restore_on_demand", true);

  // Prepare the tab state.
  let promise = promiseTabRestoring(tab2);
  ss.setTabState(tab2, JSON.stringify(TAB_STATE));
  ok(tab2.hasAttribute("pending"), "tab is pending");
  await promise;

  // Purge session history.
  Services.obs.notifyObservers(null, "browser:purge-session-history");
  await checkTabContents(browser);
  ok(tab2.hasAttribute("pending"), "tab is still pending");

  // Kick off tab restoration.
  gBrowser.selectedTab = tab2;
  await promiseTabRestored(tab2);
  await checkTabContents(browser2);
  ok(!tab2.hasAttribute("pending"), "tab is not pending anymore");

  // Cleanup.
  gBrowser.removeTab(tab2);
  gBrowser.removeTab(tab);
});
