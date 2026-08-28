/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const TEST_PAGE =
  // eslint-disable-next-line @microsoft/sdl/no-insecure-url
  "http://example.org/browser/browser/base/content/test/zoom/zoom_test.html";
const TEST_VIDEO =
  // eslint-disable-next-line @microsoft/sdl/no-insecure-url
  "http://example.org/browser/browser/base/content/test/general/video.webm";

var gTab1, gTab2, gLevel1;

function test() {
  waitForExplicitFinish();

  (async function () {
    gTab1 = BrowserTestUtils.addTab(gBrowser);
    gTab2 = BrowserTestUtils.addTab(gBrowser);

    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab1);
    await FullZoomHelper.load(gTab1, TEST_PAGE);
    await FullZoomHelper.load(gTab2, TEST_VIDEO);
  })().then(zoomTab1, FullZoomHelper.failAndContinue(finish));
}

function zoomTab1() {
  (async function () {
    is(gBrowser.selectedTab, gTab1, "Tab 1 is selected");

    // Reset zoom level if we run this test > 1 time in same browser session.
    var level1 = ZoomManager.getZoomForBrowser(
      gBrowser.getBrowserForTab(gTab1)
    );
    if (level1 > 1) {
      FullZoom.reduce();
    }

    FullZoomHelper.zoomTest(gTab1, 1, "Initial zoom of tab 1 should be 1");
    FullZoomHelper.zoomTest(gTab2, 1, "Initial zoom of tab 2 should be 1");

    FullZoom.enlarge();
    gLevel1 = ZoomManager.getZoomForBrowser(gBrowser.getBrowserForTab(gTab1));

    Assert.greater(gLevel1, 1, "New zoom for tab 1 should be greater than 1");
    FullZoomHelper.zoomTest(gTab2, 1, "Zooming tab 1 should not affect tab 2");

    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab2);
    FullZoomHelper.zoomTest(
      gTab2,
      1,
      "Tab 2 is still unzoomed after it is selected"
    );
    FullZoomHelper.zoomTest(gTab1, gLevel1, "Tab 1 is still zoomed");
  })().then(zoomTab2, FullZoomHelper.failAndContinue(finish));
}

function zoomTab2() {
  (async function () {
    is(gBrowser.selectedTab, gTab2, "Tab 2 is selected");

    FullZoom.reduce();
    let level2 = ZoomManager.getZoomForBrowser(
      gBrowser.getBrowserForTab(gTab2)
    );

    Assert.less(level2, 1, "New zoom for tab 2 should be less than 1");
    FullZoomHelper.zoomTest(
      gTab1,
      gLevel1,
      "Zooming tab 2 should not affect tab 1"
    );

    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab1);
    FullZoomHelper.zoomTest(
      gTab1,
      gLevel1,
      "Tab 1 should have the same zoom after it's selected"
    );
  })().then(testNavigation, FullZoomHelper.failAndContinue(finish));
}

function testNavigation() {
  (async function () {
    await FullZoomHelper.load(gTab1, TEST_VIDEO);
    FullZoomHelper.zoomTest(
      gTab1,
      1,
      "Zoom should be 1 when a video was loaded"
    );
    await waitForNextTurn(); // trying to fix orange bug 806046
    await FullZoomHelper.navigate(FullZoomHelper.BACK);
    FullZoomHelper.zoomTest(
      gTab1,
      gLevel1,
      "Zoom should be restored when a page is loaded"
    );
    await waitForNextTurn(); // trying to fix orange bug 806046
    await FullZoomHelper.navigate(FullZoomHelper.FORWARD);
    FullZoomHelper.zoomTest(
      gTab1,
      1,
      "Zoom should be 1 again when navigating back to a video"
    );
  })().then(finishTest, FullZoomHelper.failAndContinue(finish));
}

function waitForNextTurn() {
  return new Promise(resolve => {
    setTimeout(() => resolve(), 0);
  });
}

var finishTestStarted = false;
function finishTest() {
  (async function () {
    ok(!finishTestStarted, "finishTest called more than once");
    finishTestStarted = true;

    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab1);
    await FullZoom.reset();
    await FullZoomHelper.removeTabAndWaitForLocationChange(gTab1);
    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab2);
    await FullZoom.reset();
    await FullZoomHelper.removeTabAndWaitForLocationChange(gTab2);
  })().then(finish, FullZoomHelper.failAndContinue(finish));
}
