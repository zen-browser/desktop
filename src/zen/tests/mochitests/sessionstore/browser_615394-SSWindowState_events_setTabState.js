/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const testState = {
  windows: [
    {
      tabs: [
        { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        { entries: [{ url: "about:policies", triggeringPrincipal_base64 }] },
      ],
    },
  ],
};

function test() {
  /** Test for Bug 615394 - Session Restore should notify when it is beginning and ending a restore */
  waitForExplicitFinish();

  waitForBrowserState(testState, test_setTabState);
}

function test_setTabState() {
  let tab = gBrowser.tabs[1];
  let newTabState = JSON.stringify({
    entries: [{ url: "http://example.org", triggeringPrincipal_base64 }],
    extData: { foo: "bar" },
  });
  let busyEventCount = 0;
  let readyEventCount = 0;

  function onSSWindowStateBusy() {
    busyEventCount++;
  }

  function onSSWindowStateReady() {
    readyEventCount++;
    is(ss.getCustomTabValue(tab, "foo"), "bar");
    ss.setCustomTabValue(tab, "baz", "qux");
  }

  function onSSTabRestoring() {
    is(busyEventCount, 1);
    is(readyEventCount, 1);
    is(ss.getCustomTabValue(tab, "baz"), "qux");
    is(tab.linkedBrowser.currentURI.spec, "http://example.org/");

    window.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    window.removeEventListener("SSWindowStateReady", onSSWindowStateReady);

    gBrowser.removeTab(tab);
    finish();
  }

  window.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
  window.addEventListener("SSWindowStateReady", onSSWindowStateReady);
  tab.addEventListener("SSTabRestoring", onSSTabRestoring, { once: true });
  // Browser must be inserted in order to restore.
  gBrowser._insertBrowser(tab);
  ss.setTabState(tab, newTabState);
}
