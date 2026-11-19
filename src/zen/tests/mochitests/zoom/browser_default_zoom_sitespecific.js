/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_disabled_ss_multi() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.zoom.siteSpecific", false]],
  });
  const TEST_PAGE_URL = "https://example.org/";

  // Prepare the test tabs
  let tab2 = BrowserTestUtils.addTab(gBrowser, TEST_PAGE_URL);
  let tabBrowser2 = gBrowser.getBrowserForTab(tab2);
  let isLoaded = BrowserTestUtils.browserLoaded(
    tabBrowser2,
    false,
    TEST_PAGE_URL
  );
  await FullZoomHelper.selectTabAndWaitForLocationChange(tab2);
  await isLoaded;

  let zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser2);
  is(zoomLevel, 1, "tab 2 zoom has been set to 100%");

  let tab1 = BrowserTestUtils.addTab(gBrowser, TEST_PAGE_URL);
  let tabBrowser1 = gBrowser.getBrowserForTab(tab1);
  isLoaded = BrowserTestUtils.browserLoaded(tabBrowser1, false, TEST_PAGE_URL);
  await FullZoomHelper.selectTabAndWaitForLocationChange(tab1);
  await isLoaded;

  zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser1);
  is(zoomLevel, 1, "tab 1 zoom has been set to 100%");

  // 70% global zoom
  await FullZoomHelper.changeDefaultZoom(70);
  let defaultZoom = await FullZoomHelper.getGlobalValue();
  is(defaultZoom, 0.7, "Global zoom is at 70%");

  await TestUtils.waitForCondition(
    () => ZoomManager.getZoomForBrowser(tabBrowser1) == 0.7
  );
  zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser1);
  is(zoomLevel, 0.7, "tab 1 zoom has been set to 70%");

  await FullZoom.enlarge();

  zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser1);
  is(zoomLevel, 0.8, "tab 1 zoom has been set to 80%");

  await FullZoomHelper.selectTabAndWaitForLocationChange(tab2);
  zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser2);
  is(zoomLevel, 1, "tab 2 zoom remains 100%");

  let tab3 = BrowserTestUtils.addTab(gBrowser, TEST_PAGE_URL);
  let tabBrowser3 = gBrowser.getBrowserForTab(tab3);
  isLoaded = BrowserTestUtils.browserLoaded(tabBrowser3, false, TEST_PAGE_URL);
  await FullZoomHelper.selectTabAndWaitForLocationChange(tab3);
  await isLoaded;

  zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser3);
  is(zoomLevel, 0.7, "tab 3 zoom has been set to 70%");

  await FullZoomHelper.removeTabAndWaitForLocationChange();
  await FullZoomHelper.removeTabAndWaitForLocationChange();
  await FullZoomHelper.removeTabAndWaitForLocationChange();
});

add_task(async function test_disabled_ss_custom() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.zoom.siteSpecific", false]],
  });
  const TEST_PAGE_URL = "https://example.org/";

  // 150% global zoom
  await FullZoomHelper.changeDefaultZoom(150);
  let defaultZoom = await FullZoomHelper.getGlobalValue();
  is(defaultZoom, 1.5, "Global zoom is at 150%");

  // Prepare test tab
  let tab1 = BrowserTestUtils.addTab(gBrowser, TEST_PAGE_URL);
  let tabBrowser1 = gBrowser.getBrowserForTab(tab1);
  let isLoaded = BrowserTestUtils.browserLoaded(
    tabBrowser1,
    false,
    TEST_PAGE_URL
  );
  await FullZoomHelper.selectTabAndWaitForLocationChange(tab1);
  await isLoaded;

  await TestUtils.waitForCondition(
    () => ZoomManager.getZoomForBrowser(tabBrowser1) == 1.5
  );
  let zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser1);
  is(zoomLevel, 1.5, "tab 1 zoom has been set to 150%");

  await FullZoom.enlarge();

  zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser1);
  is(zoomLevel, 1.6, "tab 1 zoom has been set to 160%");

  await BrowserTestUtils.reloadTab(tab1);

  zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser1);
  is(zoomLevel, 1.6, "tab 1 zoom remains 160%");

  await FullZoomHelper.removeTabAndWaitForLocationChange();
});
