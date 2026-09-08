/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const testState = {
  windows: [
    {
      tabs: [
        { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        { entries: [{ url: "about:robots", triggeringPrincipal_base64 }] },
      ],
    },
  ],
};

function test() {
  /** Test for Bug 615394 - Session Restore should notify when it is beginning and ending a restore */
  waitForExplicitFinish();

  waitForBrowserState(testState, test_duplicateTab);
}

function test_duplicateTab() {
  let tab = gBrowser.tabs[1];
  let busyEventCount = 0;
  let readyEventCount = 0;
  let newTab;

  // We'll look to make sure this value is on the duplicated tab
  ss.setCustomTabValue(tab, "foo", "bar");

  function onSSWindowStateBusy() {
    busyEventCount++;
  }

  function onSSWindowStateReady() {
    newTab = gBrowser.tabs[2];
    readyEventCount++;
    is(ss.getCustomTabValue(newTab, "foo"), "bar");
    ss.setCustomTabValue(newTab, "baz", "qux");
  }

  function onSSTabRestoring(aEvent) {
    if (aEvent.target == newTab) {
      is(busyEventCount, 1);
      is(readyEventCount, 1);
      is(ss.getCustomTabValue(newTab, "baz"), "qux");
      is(newTab.linkedBrowser.currentURI.spec, "about:robots");

      window.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
      window.removeEventListener("SSWindowStateReady", onSSWindowStateReady);
      gBrowser.tabContainer.removeEventListener(
        "SSTabRestoring",
        onSSTabRestoring
      );

      gBrowser.removeTab(tab);
      gBrowser.removeTab(newTab);
      finish();
    }
  }

  window.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
  window.addEventListener("SSWindowStateReady", onSSWindowStateReady);
  gBrowser.tabContainer.addEventListener("SSTabRestoring", onSSTabRestoring);

  gBrowser._insertBrowser(tab);
  newTab = ss.duplicateTab(window, tab);
}
