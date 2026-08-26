function test() {
  waitForExplicitFinish();

  (async function () {
    let testPage =
      // eslint-disable-next-line @microsoft/sdl/no-insecure-url
      "http://example.org/browser/browser/base/content/test/zoom/zoom_test.html";
    let tab1 = BrowserTestUtils.addTab(gBrowser);
    await FullZoomHelper.selectTabAndWaitForLocationChange(tab1);
    await FullZoomHelper.load(tab1, testPage);

    let tab2 = BrowserTestUtils.addTab(gBrowser);
    await FullZoomHelper.load(tab2, testPage);

    await FullZoom.enlarge();
    let tab1Zoom = ZoomManager.getZoomForBrowser(tab1.linkedBrowser);

    await FullZoomHelper.selectTabAndWaitForLocationChange(tab2);
    let tab2Zoom = ZoomManager.getZoomForBrowser(tab2.linkedBrowser);
    is(tab2Zoom, tab1Zoom, "Zoom should affect background tabs");

    Services.prefs.setBoolPref("browser.zoom.updateBackgroundTabs", false);
    await FullZoom.reset();
    gBrowser.selectedTab = tab1;
    tab1Zoom = ZoomManager.getZoomForBrowser(tab1.linkedBrowser);
    tab2Zoom = ZoomManager.getZoomForBrowser(tab2.linkedBrowser);
    isnot(tab1Zoom, tab2Zoom, "Zoom should not affect background tabs");

    if (Services.prefs.prefHasUserValue("browser.zoom.updateBackgroundTabs")) {
      Services.prefs.clearUserPref("browser.zoom.updateBackgroundTabs");
    }
    await FullZoomHelper.removeTabAndWaitForLocationChange(tab1);
    await FullZoomHelper.removeTabAndWaitForLocationChange(tab2);
  })().then(finish, FullZoomHelper.failAndContinue(finish));
}
