/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This tests that pinning/unpinning a tab, on its own, eventually triggers a
// session store.

function test() {
  waitForExplicitFinish();
  // We speed up the interval between session saves to ensure that the test
  // runs quickly.
  Services.prefs.setIntPref("browser.sessionstore.interval", 2000);

  // Loading a tab causes a save state and this is meant to catch that event.
  waitForSaveState(testBug601955_1);

  // Assumption: Only one window is open and it has one tab open.
  BrowserTestUtils.addTab(gBrowser, "about:mozilla");
}

function testBug601955_1() {
  // Because pinned tabs are at the front of |gBrowser.tabs|, pinning tabs
  // re-arranges the |tabs| array.
  ok(!gBrowser.tabs[0].pinned, "first tab should not be pinned yet");
  ok(!gBrowser.tabs[1].pinned, "second tab should not be pinned yet");

  waitForSaveState(testBug601955_2);
  gBrowser.pinTab(gBrowser.tabs[0]);
}

function testBug601955_2() {
  let state = JSON.parse(ss.getBrowserState());
  ok(state.windows[0].tabs[0].pinned, "first tab should be pinned by now");
  ok(!state.windows[0].tabs[1].pinned, "second tab should still not be pinned");

  waitForSaveState(testBug601955_3);
  gBrowser.unpinTab(window.gBrowser.tabs[0]);
}

function testBug601955_3() {
  let state = JSON.parse(ss.getBrowserState());
  ok(!state.windows[0].tabs[0].pinned, "first tab should not be pinned");
  ok(!state.windows[0].tabs[1].pinned, "second tab should not be pinned");

  done();
}

function done() {
  gBrowser.removeTab(window.gBrowser.tabs[1]);

  Services.prefs.clearUserPref("browser.sessionstore.interval");

  executeSoon(finish);
}
