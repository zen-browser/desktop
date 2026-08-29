var tabElm, zoomLevel;
function start_test_prefNotSet() {
  (async function () {
    is(ZoomManager.zoom, 1, "initial zoom level should be 1");
    FullZoom.enlarge();

    // capture the zoom level to test later
    zoomLevel = ZoomManager.zoom;
    isnot(zoomLevel, 1, "zoom level should have changed");

    await FullZoomHelper.load(
      gBrowser.selectedTab,
      "http://mochi.test:8888/browser/browser/base/content/test/general/moz.png"
    );
  })().then(continue_test_prefNotSet, FullZoomHelper.failAndContinue(finish));
}

function continue_test_prefNotSet() {
  (async function () {
    is(ZoomManager.zoom, 1, "zoom level pref should not apply to an image");
    await FullZoom.reset();

    await FullZoomHelper.load(
      gBrowser.selectedTab,
      "http://mochi.test:8888/browser/browser/base/content/test/zoom/zoom_test.html"
    );
  })().then(end_test_prefNotSet, FullZoomHelper.failAndContinue(finish));
}

function end_test_prefNotSet() {
  (async function () {
    is(ZoomManager.zoom, zoomLevel, "the zoom level should have persisted");

    // Reset the zoom so that other tests have a fresh zoom level
    await FullZoom.reset();
    await FullZoomHelper.removeTabAndWaitForLocationChange();
    finish();
  })();
}

function test() {
  waitForExplicitFinish();

  (async function () {
    tabElm = BrowserTestUtils.addTab(gBrowser);
    await FullZoomHelper.selectTabAndWaitForLocationChange(tabElm);
    await FullZoomHelper.load(
      tabElm,
      "http://mochi.test:8888/browser/browser/base/content/test/zoom/zoom_test.html"
    );
  })().then(start_test_prefNotSet, FullZoomHelper.failAndContinue(finish));
}
