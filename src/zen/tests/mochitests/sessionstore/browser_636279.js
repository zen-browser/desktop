/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

var stateBackup = ss.getBrowserState();

var statePinned = {
  windows: [
    {
      tabs: [
        {
          entries: [
            { url: "http://example.com#1", triggeringPrincipal_base64 },
          ],
          pinned: true,
        },
      ],
    },
  ],
};

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
      ],
    },
  ],
};

function test() {
  waitForExplicitFinish();

  registerCleanupFunction(function () {
    TabsProgressListener.uninit();
    ss.setBrowserState(stateBackup);
  });

  TabsProgressListener.init();

  window.addEventListener(
    "SSWindowStateReady",
    function () {
      let firstProgress = true;

      TabsProgressListener.setCallback(function (needsRestore, isRestoring) {
        if (firstProgress) {
          firstProgress = false;
          is(isRestoring, 3, "restoring 3 tabs concurrently");
        } else {
          Assert.lessOrEqual(
            isRestoring,
            3,
            "restoring max. 2 tabs concurrently"
          );
        }

        if (0 == needsRestore) {
          TabsProgressListener.unsetCallback();
          waitForFocus(finish);
        }
      });

      ss.setBrowserState(JSON.stringify(state));
    },
    { once: true }
  );

  ss.setBrowserState(JSON.stringify(statePinned));
}

function countTabs() {
  let needsRestore = 0,
    isRestoring = 0;
  for (let window of Services.wm.getEnumerator("navigator:browser")) {
    if (window.closed) {
      continue;
    }

    for (let i = 0; i < window.gBrowser.tabs.length; i++) {
      let browserState = ss.getInternalObjectState(
        window.gBrowser.tabs[i].linkedBrowser
      );
      if (browserState == TAB_STATE_RESTORING) {
        isRestoring++;
      } else if (browserState == TAB_STATE_NEEDS_RESTORE) {
        needsRestore++;
      }
    }
  }

  return [needsRestore, isRestoring];
}

var TabsProgressListener = {
  init() {
    Services.obs.addObserver(this, "sessionstore-debug-tab-restored");
  },

  uninit() {
    Services.obs.removeObserver(this, "sessionstore-debug-tab-restored");
    this.unsetCallback();
  },

  setCallback(callback) {
    this.callback = callback;
  },

  unsetCallback() {
    delete this.callback;
  },

  observe(browser) {
    TabsProgressListener.onRestored(browser);
  },

  onRestored(browser) {
    if (
      this.callback &&
      ss.getInternalObjectState(browser) == TAB_STATE_RESTORING
    ) {
      this.callback.apply(null, countTabs());
    }
  },
};
