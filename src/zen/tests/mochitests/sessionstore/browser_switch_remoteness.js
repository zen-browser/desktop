"use strict";

const URL = "http://example.com/browser_switch_remoteness_";

function countHistoryEntries(browser, expected) {
  return SpecialPowers.spawn(browser, [{ expected }], async function (args) {
    let webNavigation = docShell.QueryInterface(Ci.nsIWebNavigation);
    let history = webNavigation.sessionHistory;
    Assert.equal(
      history && history.count,
      args.expected,
      "correct number of shistory entries"
    );
  });
}

add_task(async function () {
  // Open a new window.
  let win = await promiseNewWindowLoaded();

  // Add a new tab.
  let tab = BrowserTestUtils.addTab(win.gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });
  ok(browser.isRemoteBrowser, "browser is remote");

  // Get the maximum number of preceding entries to save.
  const MAX_BACK = Services.prefs.getIntPref(
    "browser.sessionstore.max_serialize_back"
  );
  Assert.greater(
    MAX_BACK,
    -1,
    "check that the default has a value that caps data"
  );

  // Load more pages than we would save to disk on a clean shutdown.
  for (let i = 0; i < MAX_BACK + 2; i++) {
    BrowserTestUtils.startLoadingURIString(browser, URL + i);
    await promiseBrowserLoaded(browser);
    ok(browser.isRemoteBrowser, "browser is still remote");
  }

  // Check we have the right number of shistory entries.
  await countHistoryEntries(browser, MAX_BACK + 2);

  // Load a non-remote page.
  BrowserTestUtils.startLoadingURIString(browser, "about:robots");
  await promiseBrowserLoaded(browser);
  ok(!browser.isRemoteBrowser, "browser is not remote anymore");

  // Check that we didn't lose any shistory entries.
  await countHistoryEntries(browser, MAX_BACK + 3);

  // Cleanup.
  await BrowserTestUtils.closeWindow(win);
});
