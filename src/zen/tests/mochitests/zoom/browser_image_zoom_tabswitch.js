/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

function test() {
  let tab1, tab2;
  const TEST_IMAGE =
    // eslint-disable-next-line @microsoft/sdl/no-insecure-url
    "http://example.org/browser/browser/base/content/test/general/moz.png";

  waitForExplicitFinish();

  (async function () {
    tab1 = BrowserTestUtils.addTab(gBrowser);
    tab2 = BrowserTestUtils.addTab(gBrowser);
    await FullZoomHelper.selectTabAndWaitForLocationChange(tab1);
    await FullZoomHelper.load(tab1, TEST_IMAGE);

    is(ZoomManager.zoom, 1, "initial zoom level for first should be 1");

    await FullZoom.enlarge(tab1.linkedBrowser);
    let zoom = ZoomManager.zoom;
    isnot(zoom, 1, "zoom level should have changed");

    await FullZoomHelper.selectTabAndWaitForLocationChange(tab2);
    is(ZoomManager.zoom, 1, "initial zoom level for second tab should be 1");

    await FullZoomHelper.selectTabAndWaitForLocationChange(tab1);
    is(
      ZoomManager.zoom,
      zoom,
      "zoom level for first tab should not have changed"
    );

    await FullZoom.reset(tab1.linkedBrowser);

    await FullZoomHelper.removeTabAndWaitForLocationChange(tab1);
    await FullZoomHelper.removeTabAndWaitForLocationChange(tab2);
  })().then(finish, FullZoomHelper.failAndContinue(finish));
}
