const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  BrowserTestUtils: "resource://testing-common/BrowserTestUtils.sys.mjs",
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  TabStateFlusher: "resource:///modules/sessionstore/TabStateFlusher.sys.mjs",
  TestUtils: "resource://testing-common/TestUtils.sys.mjs",
});

export var SessionStoreTestUtils = {
  /**
   * Running this init allows helpers to access test scope helpers, like Assert
   * and SimpleTest.
   * Tests should call this init() before using the helpers which rely on properties assign here.
   *
   * @param {object} scope The global scope where tests are being run.
   * @param {DOMWindow} windowGlobal The global window object, for acessing gBrowser etc.
   */
  init(scope, windowGlobal) {
    if (!scope) {
      throw new Error(
        "Must initialize SessionStoreTestUtils with a test scope"
      );
    }
    if (!windowGlobal) {
      throw new Error("this.windowGlobal must be defined when we init");
    }
    this._scopeRef = new WeakRef(scope);
    this._windowGlobalRef = new WeakRef(windowGlobal);
  },

  get info() {
    return this._scopeRef.deref()?.info;
  },

  get registerCleanupFunction() {
    return this._scopeRef.deref()?.registerCleanupFunction;
  },

  get windowGlobal() {
    return this._windowGlobalRef.deref();
  },

  async closeTab(tab) {
    await lazy.TabStateFlusher.flush(tab.linkedBrowser);
    let sessionUpdatePromise =
      lazy.BrowserTestUtils.waitForSessionStoreUpdate(tab);
    lazy.BrowserTestUtils.removeTab(tab);
    await sessionUpdatePromise;
  },

  async openAndCloseTab(window, url) {
    let { updatePromise } = await lazy.BrowserTestUtils.withNewTab(
      { url, gBrowser: window.gBrowser },
      async browser => {
        return {
          updatePromise: lazy.BrowserTestUtils.waitForSessionStoreUpdate({
            linkedBrowser: browser,
          }),
        };
      }
    );
    await updatePromise;
    return lazy.TestUtils.topicObserved("sessionstore-closed-objects-changed");
  },

  // This assumes that tests will at least have some state/entries
  waitForBrowserState(aState, aSetStateCallback) {
    if (typeof aState == "string") {
      aState = JSON.parse(aState);
    }
    if (typeof aState != "object") {
      throw new TypeError(
        "Argument must be an object or a JSON representation of an object"
      );
    }
    if (!this.windowGlobal) {
      throw new Error(
        "no windowGlobal defined, please call init() first with the scope and window object"
      );
    }
    let windows = [this.windowGlobal];
    let tabsRestored = 0;
    let expectedTabsRestored = 0;
    let expectedWindows = aState.windows.length;
    let windowsOpen = 1;
    let listening = false;
    let windowObserving = false;
    let restoreHiddenTabs = Services.prefs.getBoolPref(
      "browser.sessionstore.restore_hidden_tabs"
    );
    // This should match the |restoreTabsLazily| value that
    // SessionStore.restoreWindow() uses.
    let restoreTabsLazily =
      Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand") &&
      Services.prefs.getBoolPref("browser.sessionstore.restore_tabs_lazily");

    aState.windows.forEach(function (winState) {
      winState.tabs.forEach(function (tabState) {
        if (!restoreTabsLazily && (restoreHiddenTabs || !tabState.hidden)) {
          expectedTabsRestored++;
        }
      });
    });

    // If there are only hidden tabs and restoreHiddenTabs = false, we still
    // expect one of them to be restored because it gets shown automatically.
    // Otherwise if lazy tab restore there will only be one tab restored per window.
    if (!expectedTabsRestored) {
      expectedTabsRestored = 1;
    } else if (restoreTabsLazily) {
      expectedTabsRestored = aState.windows.length;
    }

    function onSSTabRestored() {
      if (++tabsRestored == expectedTabsRestored) {
        // Remove the event listener from each window
        windows.forEach(function (win) {
          win.gBrowser.tabContainer.removeEventListener(
            "SSTabRestored",
            onSSTabRestored,
            true
          );
        });
        listening = false;
        SessionStoreTestUtils.info("running " + aSetStateCallback.name);
        lazy.TestUtils.executeSoon(aSetStateCallback);
      }
    }

    // Used to add our listener to further windows so we can catch SSTabRestored
    // coming from them when creating a multi-window state.
    function windowObserver(aSubject, aTopic) {
      if (aTopic == "domwindowopened") {
        let newWindow = aSubject;
        newWindow.addEventListener(
          "load",
          function () {
            if (++windowsOpen == expectedWindows) {
              Services.ww.unregisterNotification(windowObserver);
              windowObserving = false;
            }

            // Track this window so we can remove the progress listener later
            windows.push(newWindow);
            // Add the progress listener
            newWindow.gBrowser.tabContainer.addEventListener(
              "SSTabRestored",
              onSSTabRestored,
              true
            );
          },
          { once: true }
        );
      }
    }

    // We only want to register the notification if we expect more than 1 window
    if (expectedWindows > 1) {
      this.registerCleanupFunction(function () {
        if (windowObserving) {
          Services.ww.unregisterNotification(windowObserver);
        }
      });
      windowObserving = true;
      Services.ww.registerNotification(windowObserver);
    }

    this.registerCleanupFunction(function () {
      if (listening) {
        windows.forEach(function (win) {
          win.gBrowser.tabContainer.removeEventListener(
            "SSTabRestored",
            onSSTabRestored,
            true
          );
        });
      }
    });
    // Add the event listener for this window as well.
    listening = true;
    this.windowGlobal.gBrowser.tabContainer.addEventListener(
      "SSTabRestored",
      onSSTabRestored,
      true
    );

    // Ensure setBrowserState() doesn't remove the initial tab.
    this.windowGlobal.gBrowser.selectedTab = this.windowGlobal.gBrowser.tabs[0];

    // Finally, call setBrowserState
    lazy.SessionStore.setBrowserState(JSON.stringify(aState));
  },

  promiseBrowserState(aState) {
    return new Promise(resolve => this.waitForBrowserState(aState, resolve));
  },
};
