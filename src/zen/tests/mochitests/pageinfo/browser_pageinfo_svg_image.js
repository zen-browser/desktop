const URI =
  "https://example.com/browser/browser/base/content/test/browser-pageinfo/svg_image.html";

add_task(async function () {
  gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser);

  BrowserTestUtils.startLoadingURIString(gBrowser.selectedBrowser, URI);
  await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser, false, URI);

  const pageInfo = BrowserCommands.pageInfo(
    gBrowser.selectedBrowser.currentURI.spec,
    "mediaTab"
  );
  await BrowserTestUtils.waitForEvent(pageInfo, "page-info-init");

  const imageTree = pageInfo.document.getElementById("imagetree");
  const imageRowsNum = imageTree.view.rowCount;

  ok(imageTree, "Image tree is null (media tab is broken)");

  is(imageRowsNum, 1, "should have one image");

  // Only bother running this if we've got the right number of rows.
  if (imageRowsNum == 1) {
    is(
      imageTree.view.getCellText(0, imageTree.columns[0]),
      "https://example.com/browser/browser/base/content/test/browser-pageinfo/title_test.svg",
      "The URL should be the svg image."
    );
  }

  pageInfo.close();
  gBrowser.removeCurrentTab();
});
