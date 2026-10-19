/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_PAGE_URL =
  "data:text/html;charset=utf-8,<body>test_keyboard_mousewheel_consistency</body>";

const WHEEL_ZOOM_IN = -1;
const WHEEL_ZOOM_OUT = 1;

/**
 * Tests that keyboard zoom (Ctrl+/- keys) and mouse wheel zoom (Ctrl+wheel)
 * step through the same predefined zoom levels consistently, ensuring both
 * methods can reach all standard zoom levels including 100%.
 */

async function synthesizeMouseWheelZoom(browser, direction, expectedZoom) {
  await BrowserTestUtils.synthesizeMouse(
    null,
    10,
    10,
    {
      wheel: true,
      ctrlKey: true,
      deltaY: direction,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
    },
    browser
  );

  await TestUtils.waitForCondition(
    () => {
      return ZoomManager.getZoomForBrowser(browser) == expectedZoom;
    },
    `Waiting for mousewheel zoom to ${expectedZoom * 100}%`
  );
}

add_task(async function test_keyboard_mousewheel_zoom_consistency() {
  // One some platforms, Ctrl-Wheel doesn't zoom by default, so we'll enable
  // that for this test.
  await SpecialPowers.pushPrefEnv({
    set: [["mousewheel.with_control.action", 3]],
  });

  await BrowserTestUtils.withNewTab(TEST_PAGE_URL, async browser => {
    let currentZoom = ZoomManager.getZoomForBrowser(browser);
    Assert.equal(currentZoom, 1, "Initial zoom should be 100%");

    await FullZoom.enlarge();
    Assert.equal(
      ZoomManager.getZoomForBrowser(browser),
      1.1,
      "First enlarge should go to 110%"
    );

    await FullZoom.enlarge();
    Assert.equal(
      ZoomManager.getZoomForBrowser(browser),
      1.2,
      "Second enlarge should go to 120%"
    );

    await FullZoom.enlarge();
    Assert.equal(
      ZoomManager.getZoomForBrowser(browser),
      1.3,
      "Third enlarge should go to 130%"
    );

    await synthesizeMouseWheelZoom(browser, WHEEL_ZOOM_OUT, 1.2);
    await synthesizeMouseWheelZoom(browser, WHEEL_ZOOM_OUT, 1.1);
    await synthesizeMouseWheelZoom(browser, WHEEL_ZOOM_OUT, 1);

    Assert.equal(
      ZoomManager.getZoomForBrowser(browser),
      1,
      "Should return to 100% after zooming out from 133%"
    );

    await synthesizeMouseWheelZoom(browser, WHEEL_ZOOM_OUT, 0.9);

    Assert.equal(
      ZoomManager.getZoomForBrowser(browser),
      0.9,
      "Should be at 90% after one more zoom out"
    );

    await synthesizeMouseWheelZoom(browser, WHEEL_ZOOM_IN, 1);
    await synthesizeMouseWheelZoom(browser, WHEEL_ZOOM_IN, 1.1);
    await synthesizeMouseWheelZoom(browser, WHEEL_ZOOM_IN, 1.2);

    Assert.equal(
      ZoomManager.getZoomForBrowser(browser),
      1.2,
      "Should be at 120% after zooming back in with wheel"
    );

    await FullZoom.reduce();
    Assert.equal(
      ZoomManager.getZoomForBrowser(browser),
      1.1,
      "First keyboard reduce should go to 110%"
    );

    await FullZoom.reduce();
    Assert.equal(
      ZoomManager.getZoomForBrowser(browser),
      1,
      "Second keyboard reduce should go to 100%"
    );

    await FullZoom.reduce();
    Assert.equal(
      ZoomManager.getZoomForBrowser(browser),
      0.9,
      "Third keyboard reduce should go to 90%"
    );

    await FullZoom.reset();
  });
});
