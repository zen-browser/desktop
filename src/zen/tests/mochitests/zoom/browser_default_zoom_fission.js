/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_sitespecific_iframe_global_zoom() {
  const TEST_PAGE_URL =
    'data:text/html;charset=utf-8,<body>test_sitespecific_iframe_global_zoom<iframe src=""></iframe></body>';
  const TEST_IFRAME_URL = "https://example.com/";

  // Prepare the test tab
  console.log("Creating tab");
  let tab = BrowserTestUtils.addTab(gBrowser, TEST_PAGE_URL);
  let tabBrowser = gBrowser.getBrowserForTab(tab);
  console.log("Loading tab");
  await FullZoomHelper.selectTabAndWaitForLocationChange(tab);

  // 67% global zoom
  console.log("Changing default zoom");
  await FullZoomHelper.changeDefaultZoom(67);
  let defaultZoom = await FullZoomHelper.getGlobalValue();
  is(defaultZoom, 0.67, "Global zoom is at 67%");
  await TestUtils.waitForCondition(() => {
    console.log("Current zoom is: ", ZoomManager.getZoomForBrowser(tabBrowser));
    return ZoomManager.getZoomForBrowser(tabBrowser) == 0.67;
  });

  let zoomLevel = ZoomManager.getZoomForBrowser(tabBrowser).toFixed(2);
  is(zoomLevel, "0.67", "tab zoom has been set to 67%");

  let frameLoadedPromise = BrowserTestUtils.browserLoaded(
    tabBrowser,
    true,
    TEST_IFRAME_URL
  );
  console.log("Spawinging iframe");
  SpecialPowers.spawn(tabBrowser, [TEST_IFRAME_URL], url => {
    content.document.querySelector("iframe").src = url;
  });
  console.log("Awaiting frame promise");
  let loadedURL = await frameLoadedPromise;
  is(loadedURL, TEST_IFRAME_URL, "got the load event for the iframe");

  let frameZoom = await SpecialPowers.spawn(
    gBrowser.selectedBrowser.browsingContext.children[0],
    [],
    async () => {
      await ContentTaskUtils.waitForCondition(() => {
        return content.docShell.browsingContext.fullZoom.toFixed(2) == 0.67;
      });
      return content.docShell.browsingContext.fullZoom.toFixed(2);
    }
  );

  is(frameZoom, zoomLevel, "global zoom is reflected in iframe");
  console.log("Removing tab");
  await FullZoomHelper.removeTabAndWaitForLocationChange();
});

add_task(async function test_sitespecific_global_zoom_enlarge() {
  const TEST_PAGE_URL =
    'data:text/html;charset=utf-8,<body>test_sitespecific_global_zoom_enlarge<iframe src=""></iframe></body>';
  const TEST_IFRAME_URL = "https://example.org/";

  // Prepare the test tab
  console.log("Adding tab");
  let tab = BrowserTestUtils.addTab(gBrowser, TEST_PAGE_URL);
  let tabBrowser = gBrowser.getBrowserForTab(tab);
  console.log("Awaiting tab load");
  await FullZoomHelper.selectTabAndWaitForLocationChange(tab);

  // 67% global zoom persists from previous test

  let frameLoadedPromise = BrowserTestUtils.browserLoaded(
    tabBrowser,
    true,
    TEST_IFRAME_URL
  );
  console.log("Spawning iframe");
  SpecialPowers.spawn(tabBrowser, [TEST_IFRAME_URL], url => {
    content.document.querySelector("iframe").src = url;
  });
  console.log("Awaiting iframe load");
  let loadedURL = await frameLoadedPromise;
  is(loadedURL, TEST_IFRAME_URL, "got the load event for the iframe");
  console.log("Enlarging tab");
  await FullZoom.enlarge();
  // 80% local zoom
  await TestUtils.waitForCondition(() => {
    console.log("Current zoom is: ", ZoomManager.getZoomForBrowser(tabBrowser));
    return ZoomManager.getZoomForBrowser(tabBrowser) == 0.8;
  });

  is(
    ZoomManager.getZoomForBrowser(tabBrowser).toFixed(2),
    "0.80",
    "Local zoom is increased"
  );

  let frameZoom = await SpecialPowers.spawn(
    gBrowser.selectedBrowser.browsingContext.children[0],
    [],
    async () => {
      await ContentTaskUtils.waitForCondition(() => {
        return content.docShell.browsingContext.fullZoom.toFixed(2) == 0.8;
      });
      return content.docShell.browsingContext.fullZoom.toFixed(2);
    }
  );

  is(frameZoom, "0.80", "(without fission) iframe zoom matches page zoom");
  console.log("Removing tab");
  await FullZoomHelper.removeTabAndWaitForLocationChange();
});
