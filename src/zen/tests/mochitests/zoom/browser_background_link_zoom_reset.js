/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const TEST_PAGE = "/browser/browser/base/content/test/zoom/zoom_test.html";
var gTestTab, gBgTab, gTestZoom;

function testBackgroundLoad() {
  (async function () {
    is(
      ZoomManager.zoom,
      gTestZoom,
      "opening a background tab should not change foreground zoom"
    );

    await FullZoomHelper.removeTabAndWaitForLocationChange(gBgTab);

    await FullZoom.reset();
    await FullZoomHelper.removeTabAndWaitForLocationChange(gTestTab);
    finish();
  })();
}

function testInitialZoom() {
  (async function () {
    is(ZoomManager.zoom, 1, "initial zoom level should be 1");
    FullZoom.enlarge();

    gTestZoom = ZoomManager.zoom;
    isnot(gTestZoom, 1, "zoom level should have changed");

    gBgTab = BrowserTestUtils.addTab(gBrowser);
    await FullZoomHelper.load(gBgTab, "http://mochi.test:8888" + TEST_PAGE);
  })().then(testBackgroundLoad, FullZoomHelper.failAndContinue(finish));
}

function test() {
  waitForExplicitFinish();

  (async function () {
    gTestTab = BrowserTestUtils.addTab(gBrowser);
    await FullZoomHelper.selectTabAndWaitForLocationChange(gTestTab);
    // eslint-disable-next-line @microsoft/sdl/no-insecure-url
    await FullZoomHelper.load(gTestTab, "http://example.org" + TEST_PAGE);
  })().then(testInitialZoom, FullZoomHelper.failAndContinue(finish));
}
