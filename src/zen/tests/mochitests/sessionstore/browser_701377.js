/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

var state = {
  windows: [
    {
      tabs: [
        {
          entries: [
            { url: "http://example.com#1", triggeringPrincipal_base64 },
          ],
        },
        {
          entries: [
            { url: "http://example.com#2", triggeringPrincipal_base64 },
          ],
          hidden: true,
        },
      ],
    },
  ],
};

function test() {
  waitForExplicitFinish();

  newWindowWithState(state, function (aWindow) {
    let tab = aWindow.gBrowser.tabs[1];
    ok(tab.hidden, "the second tab is hidden");

    let tabShown = false;
    let tabShowCallback = () => (tabShown = true);
    tab.addEventListener("TabShow", tabShowCallback);

    let tabState = ss.getTabState(tab);
    ss.setTabState(tab, tabState);

    tab.removeEventListener("TabShow", tabShowCallback);
    ok(tab.hidden && !tabShown, "tab remains hidden");

    finish();
  });
}

// ----------
function newWindowWithState(aState, aCallback) {
  let opts = "chrome,all,dialog=no,height=800,width=800";
  let win = window.openDialog(AppConstants.BROWSER_CHROME_URL, "_blank", opts);

  registerCleanupFunction(() => BrowserTestUtils.closeWindow(win));

  whenWindowLoaded(win, function onWindowLoaded(aWin) {
    ss.setWindowState(aWin, JSON.stringify(aState), true);
    executeSoon(() => aCallback(aWin));
  });
}
