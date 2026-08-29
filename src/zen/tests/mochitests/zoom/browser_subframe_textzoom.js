/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test the fix for bug 441778 to ensure site-specific page zoom doesn't get
 * modified by sub-document loads of content from a different domain.
 */

function test() {
  waitForExplicitFinish();

  const TEST_PAGE_URL = 'data:text/html,<body><iframe src=""></iframe></body>';
  // eslint-disable-next-line @microsoft/sdl/no-insecure-url
  const TEST_IFRAME_URL = "http://test2.example.org/";

  (async function () {
    // Prepare the test tab
    let tab = BrowserTestUtils.addTab(gBrowser);
    await FullZoomHelper.selectTabAndWaitForLocationChange(tab);

    let testBrowser = tab.linkedBrowser;

    await FullZoomHelper.load(tab, TEST_PAGE_URL);

    // Change the zoom level and then save it so we can compare it to the level
    // after loading the sub-document.
    FullZoom.enlarge();
    var zoomLevel = ZoomManager.zoom;

    // Start the sub-document load.
    await new Promise(resolve => {
      executeSoon(function () {
        BrowserTestUtils.browserLoaded(testBrowser, true).then(url => {
          is(url, TEST_IFRAME_URL, "got the load event for the iframe");
          is(
            ZoomManager.zoom,
            zoomLevel,
            "zoom is retained after sub-document load"
          );

          FullZoomHelper.removeTabAndWaitForLocationChange().then(() =>
            resolve()
          );
        });
        SpecialPowers.spawn(testBrowser, [TEST_IFRAME_URL], url => {
          content.document.querySelector("iframe").src = url;
        });
      });
    });
  })().then(finish, FullZoomHelper.failAndContinue(finish));
}
