/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const CLOSED_URI = "https://www.example.com/";

const FirefoxViewTestUtils = ChromeUtils.importESModule(
  "resource://testing-common/FirefoxViewTestUtils.sys.mjs"
);
FirefoxViewTestUtils.init(this);
FirefoxViewTestUtils.enableFirefoxViewButton(window);

add_task(async function test_TODO() {
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, CLOSED_URI);

  Assert.equal(gBrowser.tabs[0].linkedBrowser.currentURI.filePath, "blank");

  Assert.equal(gBrowser.tabs[1].linkedBrowser.currentURI.spec, CLOSED_URI);

  Assert.equal(gBrowser.selectedTab, tab);

  let state = ss.getCurrentState(true);

  // SessionStore uses one-based indexes
  Assert.equal(state.windows[0].selected, 2);

  EventUtils.synthesizeMouseAtCenter(
    window.document.getElementById("firefox-view-button"),
    { type: "mousedown" },
    window
  );
  Assert.ok(window.FirefoxViewHandler.tab.selected);

  Assert.equal(gBrowser.tabs[2], window.FirefoxViewHandler.tab);

  state = ss.getCurrentState(true);

  // The FxView tab doesn't get recorded in the session state, but if it's the last selected tab when a window is closed
  // we want to point to the first tab in the tab strip upon restore
  Assert.equal(state.windows[0].selected, 1);

  gBrowser.removeTab(window.FirefoxViewHandler.tab);
  gBrowser.removeTab(tab);
});
