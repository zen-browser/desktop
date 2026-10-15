/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 615394 - Session Restore should notify when it is beginning and ending a restore */
  waitForExplicitFinish();

  let newState = {
    windows: [
      {
        tabs: [
          {
            entries: [{ url: "about:mozilla", triggeringPrincipal_base64 }],
            extData: { foo: "bar" },
          },
          {
            entries: [
              { url: "http://example.org", triggeringPrincipal_base64 },
            ],
            extData: { baz: "qux" },
          },
        ],
      },
    ],
  };

  let busyEventCount = 0,
    readyEventCount = 0,
    tabRestoredCount = 0;

  function onSSWindowStateBusy() {
    busyEventCount++;
  }

  function onSSWindowStateReady() {
    readyEventCount++;
    is(ss.getCustomTabValue(gBrowser.tabs[0], "foo"), "bar");
    is(ss.getCustomTabValue(gBrowser.tabs[1], "baz"), "qux");
  }

  function onSSTabRestored() {
    if (++tabRestoredCount < 2) {
      return;
    }

    is(busyEventCount, 1);
    is(readyEventCount, 1);
    is(gBrowser.tabs[0].linkedBrowser.currentURI.spec, "about:mozilla");
    is(gBrowser.tabs[1].linkedBrowser.currentURI.spec, "http://example.org/");

    window.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    window.removeEventListener("SSWindowStateReady", onSSWindowStateReady);
    gBrowser.tabContainer.removeEventListener("SSTabRestored", onSSTabRestored);

    gBrowser.removeTab(gBrowser.tabs[1]);
    finish();
  }

  window.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
  window.addEventListener("SSWindowStateReady", onSSWindowStateReady);
  gBrowser.tabContainer.addEventListener("SSTabRestored", onSSTabRestored);

  ss.setWindowState(window, JSON.stringify(newState), true);
}
