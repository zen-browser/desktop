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

function test() {
  /** Test for Bug 615394 - Session Restore should notify when it is beginning and ending a restore */
  waitForExplicitFinish();

  let newWindow, reopenedWindow;

  function firstWindowObserver(aSubject, aTopic) {
    if (aTopic == "domwindowopened") {
      newWindow = aSubject;
      Services.ww.unregisterNotification(firstWindowObserver);
    }
  }
  Services.ww.registerNotification(firstWindowObserver);

  waitForBrowserState(lameMultiWindowState, function () {
    // Close the window which isn't window
    BrowserTestUtils.closeWindow(newWindow).then(() => {
      // Now give it time to close
      reopenedWindow = ss.undoCloseWindow(0);
      reopenedWindow.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
      reopenedWindow.addEventListener(
        "SSWindowStateReady",
        onSSWindowStateReady
      );

      reopenedWindow.addEventListener(
        "load",
        function () {
          reopenedWindow.gBrowser.tabContainer.addEventListener(
            "SSTabRestored",
            onSSTabRestored
          );
        },
        { once: true }
      );
    });
  });

  let busyEventCount = 0,
    readyEventCount = 0,
    tabRestoredCount = 0;
  // These will listen to the reopened closed window...
  function onSSWindowStateBusy() {
    busyEventCount++;
  }

  function onSSWindowStateReady() {
    readyEventCount++;
  }

  function onSSTabRestored() {
    if (++tabRestoredCount < 4) {
      return;
    }

    is(busyEventCount, 1);
    is(readyEventCount, 1);

    reopenedWindow.removeEventListener(
      "SSWindowStateBusy",
      onSSWindowStateBusy
    );
    reopenedWindow.removeEventListener(
      "SSWindowStateReady",
      onSSWindowStateReady
    );
    reopenedWindow.gBrowser.tabContainer.removeEventListener(
      "SSTabRestored",
      onSSTabRestored
    );

    reopenedWindow.close();
    while (gBrowser.tabs.length > 1) {
      gBrowser.removeTab(gBrowser.tabs[1]);
    }

    finish();
  }
}
