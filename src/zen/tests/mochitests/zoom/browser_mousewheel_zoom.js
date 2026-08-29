/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const TEST_PAGE =
  // eslint-disable-next-line @microsoft/sdl/no-insecure-url
  "http://example.org/browser/browser/base/content/test/zoom/zoom_test.html";

var gTab1, gTab2, gLevel1;

function test() {
  waitForExplicitFinish();

  // Scroll on Ctrl + mousewheel
  SpecialPowers.pushPrefEnv({ set: [["mousewheel.with_control.action", 3]] });

  (async function () {
    gTab1 = BrowserTestUtils.addTab(gBrowser);
    gTab2 = BrowserTestUtils.addTab(gBrowser);

    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab1);
    await FullZoomHelper.load(gTab1, TEST_PAGE);
    await FullZoomHelper.load(gTab2, TEST_PAGE);
  })().then(zoomTab1, FullZoomHelper.failAndContinue(finish));
}

function zoomTab1() {
  (async function () {
    is(gBrowser.selectedTab, gTab1, "Tab 1 is selected");
    FullZoomHelper.zoomTest(gTab1, 1, "Initial zoom of tab 1 should be 1");
    FullZoomHelper.zoomTest(gTab2, 1, "Initial zoom of tab 2 should be 1");

    let browser1 = gBrowser.getBrowserForTab(gTab1);
    await BrowserTestUtils.synthesizeMouse(
      null,
      10,
      10,
      {
        wheel: true,
        ctrlKey: true,
        deltaY: -1,
        deltaMode: WheelEvent.DOM_DELTA_LINE,
      },
      browser1
    );

    info("Waiting for tab 1 to be zoomed");
    await TestUtils.waitForCondition(() => {
      gLevel1 = ZoomManager.getZoomForBrowser(browser1);
      return gLevel1 > 1;
    });

    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab2);
    FullZoomHelper.zoomTest(
      gTab2,
      gLevel1,
      "Tab 2 should have zoomed along with tab 1"
    );
  })().then(finishTest, FullZoomHelper.failAndContinue(finish));
}

function finishTest() {
  (async function () {
    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab1);
    await FullZoom.reset();
    await FullZoomHelper.removeTabAndWaitForLocationChange(gTab1);
    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab2);
    await FullZoom.reset();
    await FullZoomHelper.removeTabAndWaitForLocationChange(gTab2);
  })().then(finish, FullZoomHelper.failAndContinue(finish));
}
