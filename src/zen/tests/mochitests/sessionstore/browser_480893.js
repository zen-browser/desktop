"use strict";

/**
 * Tests that we get sent to the right page when the user clicks
 * the "Close" button in about:sessionrestore
 */
add_task(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.startup.page", 0]],
  });

  let tab = BrowserTestUtils.addTab(gBrowser, "about:sessionrestore");
  gBrowser.selectedTab = tab;
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, false, "about:sessionrestore");

  let doc = browser.contentDocument;

  // Click on the "Close" button after about:sessionrestore is loaded.
  doc.getElementById("errorCancel").click();

  await BrowserTestUtils.browserLoaded(browser, false, "about:blank");

  // Test that starting a new session loads the homepage (set to http://mochi.test:8888)
  // if Firefox is configured to display a homepage at startup (browser.startup.page = 1)
  let homepage = "http://mochi.test:8888/";
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.startup.homepage", homepage],
      ["browser.startup.page", 1],
    ],
  });

  BrowserTestUtils.startLoadingURIString(browser, "about:sessionrestore");
  await BrowserTestUtils.browserLoaded(browser, false, "about:sessionrestore");
  doc = browser.contentDocument;

  // Click on the "Close" button after about:sessionrestore is loaded.
  doc.getElementById("errorCancel").click();
  await BrowserTestUtils.browserLoaded(browser);

  is(browser.currentURI.spec, homepage, "loaded page is the homepage");

  BrowserTestUtils.removeTab(tab);
});
