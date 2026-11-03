const Cm = Components.manager;

async function testPreviewBrowser(pageInfo) {
  await BrowserTestUtils.waitForEvent(pageInfo, "page-info-init");
  info("pageInfo initialized");
  let tree = pageInfo.document.getElementById("imagetree");
  Assert.ok(!!tree, "should have imagetree element");

  // i=0: <img>
  // i=1: <video>
  // i=2: <audio>
  for (let i = 0; i < 3; i++) {
    info("imagetree select " + i);
    tree.view.selection.select(i);
    tree.ensureRowIsVisible(i);
    tree.focus();

    info("Waiting for the page-info-mediapreview-load event");
    await BrowserTestUtils.waitForEvent(
      pageInfo,
      "page-info-mediapreview-load"
    );

    info("preview load " + i);

    let mediaBrowser = pageInfo.document.getElementById("mediaBrowser");

    Assert.equal(
      mediaBrowser.browsingContext.currentRemoteType,
      "webIsolated=https://example.com",
      "Preview mediaBrowser is running in a webIsolated process"
    );

    Assert.equal(
      gBrowser.selectedBrowser.browsingContext.group,
      mediaBrowser.browsingContext.group,
      "Preview browser is in the same group as the original page"
    );
  }
}

async function test() {
  waitForExplicitFinish();

  let url =
    "https://example.com/browser/browser/base/content/test/browser-pageinfo/image.html";
  gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser);
  let loadPromise = BrowserTestUtils.browserLoaded(
    gBrowser.selectedBrowser,
    false,
    url
  );
  BrowserTestUtils.startLoadingURIString(gBrowser.selectedBrowser, url);
  await loadPromise;

  // Pass a dummy imageElement, if there isn't an imageElement, pageInfo.js
  // will do a preview, however this sometimes will cause intermittent failures,
  // see bug 1403365.
  let pageInfo = BrowserCommands.pageInfo(url, "mediaTab", {});
  info("waitForEvent pageInfo");
  await BrowserTestUtils.waitForEvent(pageInfo, "load");

  info("calling testPreviewBrowser");
  await testPreviewBrowser(pageInfo);

  pageInfo.close();
  gBrowser.removeCurrentTab();
  finish();
}
