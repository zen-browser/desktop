var gTestPage =
  // eslint-disable-next-line @microsoft/sdl/no-insecure-url
  "http://example.org/browser/browser/base/content/test/zoom/zoom_test.html";
var gTestImage =
  // eslint-disable-next-line @microsoft/sdl/no-insecure-url
  "http://example.org/browser/browser/base/content/test/general/moz.png";
var gTab1, gTab2, gTab3;
var gLevel;

function test() {
  waitForExplicitFinish();
  registerCleanupFunction(async () => {
    await new Promise(resolve => {
      ContentPrefService2.removeByName(FullZoom.name, Cu.createLoadContext(), {
        handleCompletion: resolve,
      });
    });
  });

  (async function () {
    gTab1 = BrowserTestUtils.addTab(gBrowser, gTestPage);
    gTab2 = BrowserTestUtils.addTab(gBrowser);
    gTab3 = BrowserTestUtils.addTab(gBrowser);

    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab1);
    await FullZoomHelper.load(gTab1, gTestPage);
    await FullZoomHelper.load(gTab2, gTestPage);
  })().then(secondPageLoaded, FullZoomHelper.failAndContinue(finish));
}

function secondPageLoaded() {
  (async function () {
    FullZoomHelper.zoomTest(gTab1, 1, "Initial zoom of tab 1 should be 1");
    FullZoomHelper.zoomTest(gTab2, 1, "Initial zoom of tab 2 should be 1");
    FullZoomHelper.zoomTest(gTab3, 1, "Initial zoom of tab 3 should be 1");

    // Now have three tabs, two with the test page, one blank. Tab 1 is selected
    // Zoom tab 1
    FullZoom.enlarge();
    gLevel = ZoomManager.getZoomForBrowser(gBrowser.getBrowserForTab(gTab1));

    Assert.greater(gLevel, 1, "New zoom for tab 1 should be greater than 1");
    FullZoomHelper.zoomTest(gTab2, 1, "Zooming tab 1 should not affect tab 2");
    FullZoomHelper.zoomTest(gTab3, 1, "Zooming tab 1 should not affect tab 3");

    await FullZoomHelper.load(gTab3, gTestPage);
  })().then(thirdPageLoaded, FullZoomHelper.failAndContinue(finish));
}

function thirdPageLoaded() {
  (async function () {
    FullZoomHelper.zoomTest(gTab1, gLevel, "Tab 1 should still be zoomed");
    FullZoomHelper.zoomTest(gTab2, 1, "Tab 2 should still not be affected");
    FullZoomHelper.zoomTest(
      gTab3,
      gLevel,
      "Tab 3 should have zoomed as it was loading in the background"
    );

    // Switching to tab 2 should update its zoom setting.
    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab2);
    FullZoomHelper.zoomTest(gTab1, gLevel, "Tab 1 should still be zoomed");
    FullZoomHelper.zoomTest(gTab2, gLevel, "Tab 2 should be zoomed now");
    FullZoomHelper.zoomTest(gTab3, gLevel, "Tab 3 should still be zoomed");

    await FullZoomHelper.load(gTab1, gTestImage);
  })().then(imageLoaded, FullZoomHelper.failAndContinue(finish));
}

function imageLoaded() {
  (async function () {
    FullZoomHelper.zoomTest(
      gTab1,
      1,
      "Zoom should be 1 when image was loaded in the background"
    );
    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab1);
    FullZoomHelper.zoomTest(
      gTab1,
      1,
      "Zoom should still be 1 when tab with image is selected"
    );
  })().then(imageZoomSwitch, FullZoomHelper.failAndContinue(finish));
}

function imageZoomSwitch() {
  (async function () {
    await FullZoomHelper.navigate(FullZoomHelper.BACK);
    await FullZoomHelper.navigate(FullZoomHelper.FORWARD);
    FullZoomHelper.zoomTest(
      gTab1,
      1,
      "Tab 1 should not be zoomed when an image loads"
    );

    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab2);
    FullZoomHelper.zoomTest(
      gTab1,
      1,
      "Tab 1 should still not be zoomed when deselected"
    );
  })().then(finishTest, FullZoomHelper.failAndContinue(finish));
}

var finishTestStarted = false;
function finishTest() {
  (async function () {
    ok(!finishTestStarted, "finishTest called more than once");
    finishTestStarted = true;
    await FullZoomHelper.selectTabAndWaitForLocationChange(gTab1);
    await FullZoomHelper.removeTabAndWaitForLocationChange(gTab1);
    await FullZoomHelper.removeTabAndWaitForLocationChange(gTab2);
    await FullZoomHelper.removeTabAndWaitForLocationChange(gTab3);
  })().then(finish, FullZoomHelper.failAndContinue(finish));
}
