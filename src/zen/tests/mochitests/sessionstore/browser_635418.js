/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This tests that hiding/showing a tab, on its own, eventually triggers a
// session store.

function test() {
  waitForExplicitFinish();

  // We speed up the interval between session saves to ensure that the test
  // runs quickly.
  Services.prefs.setIntPref("browser.sessionstore.interval", 2000);

  // Loading a tab causes a save state and this is meant to catch that event.
  waitForSaveState(testBug635418_1);

  // Assumption: Only one window is open and it has one tab open.
  BrowserTestUtils.addTab(gBrowser, "about:mozilla");
}

function testBug635418_1() {
  ok(!gBrowser.tabs[0].hidden, "first tab should not be hidden");
  ok(!gBrowser.tabs[1].hidden, "second tab should not be hidden");

  waitForSaveState(testBug635418_2);

  // We can't hide the selected tab, so hide the new one
  gBrowser.hideTab(gBrowser.tabs[1]);
}

function testBug635418_2() {
  let state = JSON.parse(ss.getBrowserState());
  ok(!state.windows[0].tabs[0].hidden, "first tab should still not be hidden");
  ok(state.windows[0].tabs[1].hidden, "second tab should be hidden by now");

  waitForSaveState(testBug635418_3);
  gBrowser.showTab(gBrowser.tabs[1]);
}

function testBug635418_3() {
  let state = JSON.parse(ss.getBrowserState());
  ok(
    !state.windows[0].tabs[0].hidden,
    "first tab should still still not be hidden"
  );
  ok(!state.windows[0].tabs[1].hidden, "second tab should not be hidden again");

  done();
}

function done() {
  gBrowser.removeTab(window.gBrowser.tabs[1]);

  Services.prefs.clearUserPref("browser.sessionstore.interval");

  executeSoon(finish);
}
