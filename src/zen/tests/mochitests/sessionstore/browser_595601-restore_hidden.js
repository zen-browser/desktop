/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

var windowState = {
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
        },
        {
          entries: [
            { url: "http://example.com#3", triggeringPrincipal_base64 },
          ],
        },
        {
          entries: [
            { url: "http://example.com#4", triggeringPrincipal_base64 },
          ],
        },
        {
          entries: [
            { url: "http://example.com#5", triggeringPrincipal_base64 },
          ],
          hidden: true,
        },
        {
          entries: [
            { url: "http://example.com#6", triggeringPrincipal_base64 },
          ],
          hidden: true,
        },
        {
          entries: [
            { url: "http://example.com#7", triggeringPrincipal_base64 },
          ],
          hidden: true,
        },
        {
          entries: [
            { url: "http://example.com#8", triggeringPrincipal_base64 },
          ],
          hidden: true,
        },
      ],
    },
  ],
};

function test() {
  waitForExplicitFinish();
  requestLongerTimeout(2);

  registerCleanupFunction(function () {
    Services.prefs.clearUserPref("browser.sessionstore.restore_hidden_tabs");
  });

  // First stage: restoreHiddenTabs = true
  // Second stage: restoreHiddenTabs = false
  test_loadTabs(true, function () {
    test_loadTabs(false, finish);
  });
}

function test_loadTabs(restoreHiddenTabs, callback) {
  Services.prefs.setBoolPref(
    "browser.sessionstore.restore_hidden_tabs",
    restoreHiddenTabs
  );

  let expectedTabs = restoreHiddenTabs ? 8 : 4;
  let firstProgress = true;

  newWindowWithState(windowState, function (win, needsRestore, isRestoring) {
    if (firstProgress) {
      firstProgress = false;
      is(isRestoring, 3, "restoring 3 tabs concurrently");
    } else {
      Assert.less(isRestoring, 4, "restoring max. 3 tabs concurrently");
    }

    // We're explicity checking for (isRestoring == 1) here because the test
    // progress listener is called before the session store one. So when we're
    // called with one tab left to restore we know that the last tab has
    // finished restoring and will soon be handled by the SS listener.
    let tabsNeedingRestore = win.gBrowser.tabs.length - needsRestore;
    if (isRestoring == 1 && tabsNeedingRestore == expectedTabs) {
      is(win.gBrowser.visibleTabs.length, 4, "only 4 visible tabs");

      TabsProgressListener.uninit();
      executeSoon(callback);
    }
  });
}

var TabsProgressListener = {
  init(win) {
    this.window = win;
    Services.obs.addObserver(this, "sessionstore-debug-tab-restored");
  },

  uninit() {
    Services.obs.removeObserver(this, "sessionstore-debug-tab-restored");

    delete this.window;
    delete this.callback;
  },

  setCallback(callback) {
    this.callback = callback;
  },

  observe(browser) {
    TabsProgressListener.onRestored(browser);
  },

  onRestored(browser) {
    if (
      this.callback &&
      ss.getInternalObjectState(browser) == TAB_STATE_RESTORING
    ) {
      this.callback.apply(null, [this.window].concat(this.countTabs()));
    }
  },

  countTabs() {
    let needsRestore = 0,
      isRestoring = 0;

    for (let i = 0; i < this.window.gBrowser.tabs.length; i++) {
      let state = ss.getInternalObjectState(
        this.window.gBrowser.tabs[i].linkedBrowser
      );
      if (state == TAB_STATE_RESTORING) {
        isRestoring++;
      } else if (state == TAB_STATE_NEEDS_RESTORE) {
        needsRestore++;
      }
    }

    return [needsRestore, isRestoring];
  },
};

// ----------
function newWindowWithState(state, callback) {
  let opts = "chrome,all,dialog=no,height=800,width=800";
  let win = window.openDialog(AppConstants.BROWSER_CHROME_URL, "_blank", opts);

  registerCleanupFunction(() => BrowserTestUtils.closeWindow(win));

  whenWindowLoaded(win, function onWindowLoaded(aWin) {
    TabsProgressListener.init(aWin);
    TabsProgressListener.setCallback(callback);

    ss.setWindowState(aWin, JSON.stringify(state), true);
  });
}
