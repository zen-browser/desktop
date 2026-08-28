var tab;

function test() {
  // ----------
  // Test setup

  waitForExplicitFinish();

  Services.prefs.setBoolPref("browser.zoom.updateBackgroundTabs", true);
  Services.prefs.setBoolPref("browser.zoom.siteSpecific", true);

  let uri =
    // eslint-disable-next-line @microsoft/sdl/no-insecure-url
    "http://example.org/browser/browser/base/content/test/zoom/zoom_test.html";

  (async function () {
    tab = BrowserTestUtils.addTab(gBrowser);
    await FullZoomHelper.load(tab, uri);

    // -------------------------------------------------------------------
    // Test - Trigger a tab switch that should update the zoom level
    await FullZoomHelper.selectTabAndWaitForLocationChange(tab);
    ok(true, "applyPrefToSetting was called");
  })().then(endTest, FullZoomHelper.failAndContinue(endTest));
}

// -------------
// Test clean-up
function endTest() {
  (async function () {
    await FullZoomHelper.removeTabAndWaitForLocationChange(tab);

    tab = null;

    if (Services.prefs.prefHasUserValue("browser.zoom.updateBackgroundTabs")) {
      Services.prefs.clearUserPref("browser.zoom.updateBackgroundTabs");
    }

    if (Services.prefs.prefHasUserValue("browser.zoom.siteSpecific")) {
      Services.prefs.clearUserPref("browser.zoom.siteSpecific");
    }

    finish();
  })();
}
