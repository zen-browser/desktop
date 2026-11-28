/**
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

add_task(async function () {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com"
  );
  let browser = tab.linkedBrowser;
  let pageInfo = BrowserCommands.pageInfo(browser.currentURI.spec);
  await BrowserTestUtils.waitForEvent(pageInfo, "page-info-init");
  Assert.strictEqual(
    pageInfo.docShell.QueryInterface(Ci.nsILoadContext).usePrivateBrowsing,
    false,
    "non-private window opened private page info window"
  );

  let privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  let privateTab = await BrowserTestUtils.openNewForegroundTab(
    privateWindow.gBrowser,
    "https://example.com"
  );
  let privateBrowser = privateTab.linkedBrowser;
  let privatePageInfo = privateWindow.BrowserCommands.pageInfo(
    privateBrowser.currentURI.spec
  );
  await BrowserTestUtils.waitForEvent(privatePageInfo, "page-info-init");
  Assert.strictEqual(
    privatePageInfo.docShell.QueryInterface(Ci.nsILoadContext)
      .usePrivateBrowsing,
    true,
    "private window opened non-private page info window"
  );

  Assert.notEqual(
    pageInfo,
    privatePageInfo,
    "private and non-private windows shouldn't have shared the same page info window"
  );
  pageInfo.close();
  privatePageInfo.close();
  BrowserTestUtils.removeTab(tab);
  BrowserTestUtils.removeTab(privateTab);
  await BrowserTestUtils.closeWindow(privateWindow);
});
