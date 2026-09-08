"use strict";

const PAGE_1 =
  "data:text/html,<html><body>A%20regular,%20everyday,%20normal%20page.";
const PAGE_2 =
  "data:text/html,<html><body>Another%20regular,%20everyday,%20normal%20page.";

add_task(async function () {
  // Load an empty, non-remote tab at about:blank...
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    forceNotRemote: true,
  });
  gBrowser.selectedTab = tab;
  let browser = gBrowser.selectedBrowser;
  ok(!browser.isRemoteBrowser, "Ensure browser is not remote");
  // Load a remote page, and then another remote page immediately
  // after.
  BrowserTestUtils.startLoadingURIString(browser, PAGE_1);
  browser.stop();
  BrowserTestUtils.startLoadingURIString(browser, PAGE_2);
  await BrowserTestUtils.browserLoaded(browser, false, PAGE_2);

  ok(browser.isRemoteBrowser, "Should have switched remoteness");
  await TabStateFlusher.flush(browser);
  let state = JSON.parse(ss.getTabState(tab));
  let entries = state.entries;
  is(entries.length, 1, "There should only be one entry");
  is(entries[0].url, PAGE_2, "Should have PAGE_2 as the sole history entry");
  is(
    browser.currentURI.spec,
    PAGE_2,
    "Should have PAGE_2 as the browser currentURI"
  );

  await SpecialPowers.spawn(browser, [PAGE_2], async function (expectedURL) {
    docShell.QueryInterface(Ci.nsIWebNavigation);
    Assert.equal(
      docShell.currentURI.spec,
      expectedURL,
      "Content should have PAGE_2 as the browser currentURI"
    );
  });

  BrowserTestUtils.removeTab(tab);
});
