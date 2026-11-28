"use strict";

const STATE = {
  entries: [
    { url: "about:robots", triggeringPrincipal_base64 },
    { url: "about:mozilla", triggeringPrincipal_base64 },
  ],
  index: 2,
};

add_setup(async function () {
  await pushPrefs(["browser.sessionstore.restore_on_demand", true]);
});

/**
 * Bug 1100223. Calling browser.loadURI() while a tab is loading causes
 * sessionstore to override the desired target URL. This test ensures that
 * calling loadURI() on a pending tab causes the tab to no longer be marked
 * as pending and correctly finish the instructed load while keeping the
 * restored history around.
 */
add_task(async function test_load_pending_tab() {
  await testLoadPendingTab("about:mozilla?foo=bar");
});

add_task(async function test_fragment_pending_tab() {
  await testLoadPendingTab("about:mozilla#frag");
}).skip(); // Bug 2086636 rejects the new entry before OnHistoryNewEntry fires.

add_task(async function test_purge_pending_tab() {
  for (let clearHistory of [false, true]) {
    info(clearHistory ? "Clear browsing history" : "Purge session history");
    let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
    let browser = tab.linkedBrowser;
    try {
      await promiseBrowserLoaded(browser, true, "about:blank");
      let restoring = promiseTabRestoring(tab);
      ss.setTabState(
        tab,
        JSON.stringify({ entries: [...STATE.entries].reverse(), index: 1 })
      );
      await restoring;
      is(
        browser.browsingContext.sessionHistory.count,
        2,
        "two restored entries"
      );
      is(
        browser.browsingContext.sessionHistory.index,
        0,
        "active entry is first"
      );
      ok(tab.hasAttribute("pending"), "tab is pending before purging");

      let restored = promiseTabRestored(tab);
      if (clearHistory) {
        let failedFlags = await new Promise(resolve => {
          Services.clearData.deleteData(
            Ci.nsIClearDataService.CLEAR_HISTORY,
            resolve
          );
        });
        is(failedFlags, 0, "history cleared successfully");
      } else {
        browser.purgeSessionHistory();
      }
      await TestUtils.waitForTick();
      ok(tab.hasAttribute("pending"), "purging history leaves the tab pending");
      is(
        browser.browsingContext.currentWindowGlobal.documentURI.spec,
        "about:blank",
        "purging history does not load the pending document"
      );

      gBrowser.selectedTab = tab;
      await restored;
      ok(!tab.hasAttribute("pending"), "selecting the tab restores it");
      is(browser.currentURI.spec, "about:mozilla", "active entry restored");
      is(
        browser.browsingContext.sessionHistory.count,
        1,
        "only active entry remains"
      );
      await SpecialPowers.spawn(browser, [], () => {
        Assert.ok(
          content.document.getElementById("moztext"),
          "page content restored"
        );
      });
    } finally {
      await BrowserTestUtils.removeTab(tab);
    }
  }
});

async function testLoadPendingTab(url) {
  // Create a background tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  try {
    await promiseBrowserLoaded(browser, true, "about:blank");

    // Prepare the tab state.
    let promise = promiseTabRestoring(tab);
    ss.setTabState(tab, JSON.stringify(STATE));
    ok(tab.hasAttribute("pending"), "tab is pending");
    await promise;
    is(
      browser.browsingContext.sessionHistory.count,
      2,
      "two history entries restored"
    );

    let restored = promiseTabRestored(tab);
    browser.loadURI(Services.io.newURI(url), {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });

    // Tab should now restore
    await restored;
    ok(!tab.hasAttribute("pending"), "tab is no longer pending");
    is(browser.currentURI.spec, url, "correct URL loaded");
    await SpecialPowers.spawn(browser, [], () => {
      Assert.ok(
        content.document.getElementById("moztext"),
        "page content loaded"
      );
    });

    // Check that we didn't lose any history entries.
    is(
      browser.browsingContext.sessionHistory.count,
      3,
      "three history entries"
    );
  } finally {
    await BrowserTestUtils.removeTab(tab);
  }
}
