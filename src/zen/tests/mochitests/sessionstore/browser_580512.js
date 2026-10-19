/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const URIS_PINNED = ["about:license", "about:about"];
const URIS_NORMAL_A = ["about:mozilla"];
const URIS_NORMAL_B = ["about:buildconfig"];

function test() {
  waitForExplicitFinish();

  isnot(
    Services.prefs.getIntPref("browser.startup.page"),
    3,
    "pref to save session must not be set for this test"
  );
  ok(
    !Services.prefs.getBoolPref("browser.sessionstore.resume_session_once"),
    "pref to save session once must not be set for this test"
  );

  document.documentElement.setAttribute(
    "windowtype",
    "navigator:browsertestdummy"
  );

  openWinWithCb(closeFirstWin, URIS_PINNED.concat(URIS_NORMAL_A));
}

function closeFirstWin(win) {
  win.gBrowser.pinTab(win.gBrowser.tabs[0]);
  win.gBrowser.pinTab(win.gBrowser.tabs[1]);

  let winClosed = BrowserTestUtils.windowClosed(win);
  // We need to call BrowserCommands.tryToCloseWindow in order to trigger
  // the machinery that chooses whether or not to save the session
  // for the last window.
  win.BrowserCommands.tryToCloseWindow();
  ok(win.closed, "window closed");

  winClosed.then(() => {
    openWinWithCb(
      checkSecondWin,
      URIS_NORMAL_B,
      URIS_PINNED.concat(URIS_NORMAL_B)
    );
  });
}

function checkSecondWin(win) {
  is(
    win.gBrowser.browsers[0].currentURI.spec,
    URIS_PINNED[0],
    "first pinned tab restored"
  );
  is(
    win.gBrowser.browsers[1].currentURI.spec,
    URIS_PINNED[1],
    "second pinned tab restored"
  );
  ok(win.gBrowser.tabs[0].pinned, "first pinned tab is still pinned");
  ok(win.gBrowser.tabs[1].pinned, "second pinned tab is still pinned");

  BrowserTestUtils.closeWindow(win).then(() => {
    // cleanup
    document.documentElement.setAttribute("windowtype", "navigator:browser");
    finish();
  });
}

function openWinWithCb(cb, argURIs, expectedURIs) {
  if (!expectedURIs) {
    expectedURIs = argURIs;
  }

  var win = openDialog(
    AppConstants.BROWSER_CHROME_URL,
    "_blank",
    "chrome,all,dialog=no",
    argURIs.join("|")
  );

  win.addEventListener(
    "load",
    function () {
      info("the window loaded");

      var expectedLoads = expectedURIs.length;

      win.gBrowser.addTabsProgressListener({
        onStateChange(aBrowser, aWebProgress, aRequest, aStateFlags, _aStatus) {
          if (
            aRequest &&
            aStateFlags & Ci.nsIWebProgressListener.STATE_STOP &&
            aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK &&
            expectedURIs.indexOf(
              aRequest.QueryInterface(Ci.nsIChannel).originalURI.spec
            ) > -1 &&
            --expectedLoads <= 0
          ) {
            win.gBrowser.removeTabsProgressListener(this);
            info("all tabs loaded");
            is(
              win.gBrowser.tabs.length,
              expectedURIs.length,
              "didn't load any unexpected tabs"
            );
            executeSoon(function () {
              cb(win);
            });
          }
        },
      });
    },
    { once: true }
  );
}
