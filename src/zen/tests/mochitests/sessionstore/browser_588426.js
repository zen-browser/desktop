/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function test() {
  let state = {
    windows: [
      {
        tabs: [
          {
            entries: [{ url: "about:mozilla", triggeringPrincipal_base64 }],
            hidden: true,
          },
          {
            entries: [{ url: "about:rights", triggeringPrincipal_base64 }],
            hidden: true,
          },
        ],
      },
    ],
  };

  waitForExplicitFinish();

  newWindowWithState(state, function (win) {
    registerCleanupFunction(() => BrowserTestUtils.closeWindow(win));

    is(win.gBrowser.tabs.length, 2, "two tabs were restored");
    is(win.gBrowser.visibleTabs.length, 1, "one tab is visible");

    let tab = win.gBrowser.visibleTabs[0];
    is(
      tab.linkedBrowser.currentURI.spec,
      "about:mozilla",
      "visible tab is about:mozilla"
    );

    finish();
  });
}

function newWindowWithState(state, callback) {
  let opts = "chrome,all,dialog=no,height=800,width=800";
  let win = window.openDialog(AppConstants.BROWSER_CHROME_URL, "_blank", opts);

  win.addEventListener(
    "load",
    function () {
      executeSoon(function () {
        win.addEventListener(
          "SSWindowStateReady",
          function () {
            promiseTabRestored(win.gBrowser.tabs[0]).then(() => callback(win));
          },
          { once: true }
        );

        ss.setWindowState(win, JSON.stringify(state), true);
      });
    },
    { once: true }
  );
}
