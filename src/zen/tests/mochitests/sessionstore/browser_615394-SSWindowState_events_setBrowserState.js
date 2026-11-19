/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lameMultiWindowState = {
  windows: [
    {
      tabs: [
        {
          entries: [
            { url: "http://example.org#1", triggeringPrincipal_base64 },
          ],
          extData: { uniq: r() },
        },
        {
          entries: [
            { url: "http://example.org#2", triggeringPrincipal_base64 },
          ],
          extData: { uniq: r() },
        },
        {
          entries: [
            { url: "http://example.org#3", triggeringPrincipal_base64 },
          ],
          extData: { uniq: r() },
        },
        {
          entries: [
            { url: "http://example.org#4", triggeringPrincipal_base64 },
          ],
          extData: { uniq: r() },
        },
      ],
      selected: 1,
    },
    {
      tabs: [
        {
          entries: [
            { url: "http://example.com#1", triggeringPrincipal_base64 },
          ],
          extData: { uniq: r() },
        },
        {
          entries: [
            { url: "http://example.com#2", triggeringPrincipal_base64 },
          ],
          extData: { uniq: r() },
        },
        {
          entries: [
            { url: "http://example.com#3", triggeringPrincipal_base64 },
          ],
          extData: { uniq: r() },
        },
        {
          entries: [
            { url: "http://example.com#4", triggeringPrincipal_base64 },
          ],
          extData: { uniq: r() },
        },
      ],
      selected: 3,
    },
  ],
};

function getOuterWindowID(aWindow) {
  return aWindow.docShell.outerWindowID;
}

function test() {
  /** Test for Bug 615394 - Session Restore should notify when it is beginning and ending a restore */
  waitForExplicitFinish();

  // We'll track events per window so we are sure that they are each happening once
  // pre window.
  let windowEvents = {};
  windowEvents[getOuterWindowID(window)] = {
    busyEventCount: 0,
    readyEventCount: 0,
  };

  // waitForBrowserState does it's own observing for windows, but doesn't attach
  // the listeners we want here, so do it ourselves.
  let newWindow;
  function windowObserver(aSubject, aTopic) {
    if (aTopic == "domwindowopened") {
      Services.ww.unregisterNotification(windowObserver);

      newWindow = aSubject;
      newWindow.addEventListener(
        "load",
        function () {
          windowEvents[getOuterWindowID(newWindow)] = {
            busyEventCount: 0,
            readyEventCount: 0,
          };

          newWindow.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
          newWindow.addEventListener(
            "SSWindowStateReady",
            onSSWindowStateReady
          );
        },
        { once: true }
      );
    }
  }

  function onSSWindowStateBusy(aEvent) {
    windowEvents[getOuterWindowID(aEvent.originalTarget)].busyEventCount++;
  }

  function onSSWindowStateReady(aEvent) {
    windowEvents[getOuterWindowID(aEvent.originalTarget)].readyEventCount++;
  }

  window.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
  window.addEventListener("SSWindowStateReady", onSSWindowStateReady);
  Services.ww.registerNotification(windowObserver);

  waitForBrowserState(lameMultiWindowState, function () {
    let checkedWindows = 0;
    for (let id of Object.keys(windowEvents)) {
      let winEvents = windowEvents[id];
      is(
        winEvents.busyEventCount,
        1,
        "window" + id + " busy event count correct"
      );
      is(
        winEvents.readyEventCount,
        1,
        "window" + id + " ready event count correct"
      );
      checkedWindows++;
    }
    is(checkedWindows, 2, "checked 2 windows");
    window.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    window.removeEventListener("SSWindowStateReady", onSSWindowStateReady);
    newWindow.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    newWindow.removeEventListener("SSWindowStateReady", onSSWindowStateReady);

    newWindow.close();
    while (gBrowser.tabs.length > 1) {
      gBrowser.removeTab(gBrowser.tabs[1]);
    }

    finish();
  });
}
