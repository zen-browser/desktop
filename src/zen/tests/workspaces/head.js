/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const triggeringPrincipal_base64 = E10SUtils.SERIALIZED_SYSTEMPRINCIPAL;

const TAB_STATE_NEEDS_RESTORE = 1;
const TAB_STATE_RESTORING = 2;

const ROOT = getRootDirectory(gTestPath);
const HTTPROOT = ROOT.replace('chrome://mochitests/content/', 'http://example.com/');
const HTTPSROOT = ROOT.replace('chrome://mochitests/content/', 'https://example.com/');

const { SessionSaver } = ChromeUtils.importESModule(
  'resource:///modules/sessionstore/SessionSaver.sys.mjs'
);
const { SessionFile } = ChromeUtils.importESModule(
  'resource:///modules/sessionstore/SessionFile.sys.mjs'
);
const { TabState } = ChromeUtils.importESModule(
  'resource:///modules/sessionstore/TabState.sys.mjs'
);
const { TabStateFlusher } = ChromeUtils.importESModule(
  'resource:///modules/sessionstore/TabStateFlusher.sys.mjs'
);
const { SessionStoreTestUtils } = ChromeUtils.importESModule(
  'resource://testing-common/SessionStoreTestUtils.sys.mjs'
);

const { PageWireframes } = ChromeUtils.importESModule(
  'resource:///modules/sessionstore/PageWireframes.sys.mjs'
);

const ss = SessionStore;
SessionStoreTestUtils.init(this, window);

// Some tests here assume that all restored tabs are loaded without waiting for
// the user to bring them to the foreground. We ensure this by resetting the
// related preference (see the "firefox.js" defaults file for details).
Services.prefs.setBoolPref('browser.sessionstore.restore_on_demand', false);
registerCleanupFunction(function () {
  Services.prefs.clearUserPref('browser.sessionstore.restore_on_demand');
});

// Obtain access to internals
Services.prefs.setBoolPref('browser.sessionstore.debug', true);
registerCleanupFunction(function () {
  Services.prefs.clearUserPref('browser.sessionstore.debug');
});

// This kicks off the search service used on about:home and allows the
// session restore tests to be run standalone without triggering errors.
Cc['@mozilla.org/browser/clh;1'].getService(Ci.nsIBrowserHandler).defaultArgs;

function provideWindow(aCallback, aURL, aFeatures) {
  function callbackSoon(aWindow) {
    executeSoon(function executeCallbackSoon() {
      aCallback(aWindow);
    });
  }

  let win = openDialog(
    AppConstants.BROWSER_CHROME_URL,
    '',
    aFeatures || 'chrome,all,dialog=no',
    aURL || 'about:blank'
  );
  whenWindowLoaded(win, function onWindowLoaded(aWin) {
    if (!aURL) {
      info('Loaded a blank window.');
      callbackSoon(aWin);
      return;
    }

    aWin.gBrowser.selectedBrowser.addEventListener(
      'load',
      function () {
        callbackSoon(aWin);
      },
      { capture: true, once: true }
    );
  });
}

// This assumes that tests will at least have some state/entries
function waitForBrowserState(aState, aSetStateCallback) {
  return SessionStoreTestUtils.waitForBrowserState(aState, aSetStateCallback);
}

function promiseBrowserState(aState) {
  return SessionStoreTestUtils.promiseBrowserState(aState);
}

function promiseTabState(tab, state) {
  if (typeof state != 'string') {
    state = JSON.stringify(state);
  }

  let promise = promiseTabRestored(tab);
  ss.setTabState(tab, state);
  return promise;
}

function promiseWindowRestoring(win) {
  return new Promise((resolve) =>
    win.addEventListener('SSWindowRestoring', resolve, { once: true })
  );
}

function promiseWindowRestored(win) {
  return new Promise((resolve) =>
    win.addEventListener('SSWindowRestored', resolve, { once: true })
  );
}

async function setBrowserState(state, win = window) {
  ss.setBrowserState(typeof state != 'string' ? JSON.stringify(state) : state);
  await promiseWindowRestored(win);
}

async function setWindowState(win, state, overwrite = false) {
  ss.setWindowState(win, typeof state != 'string' ? JSON.stringify(state) : state, overwrite);
  await promiseWindowRestored(win);
}

function waitForTopic(aTopic, aTimeout, aCallback) {
  let observing = false;
  function removeObserver() {
    if (!observing) {
      return;
    }
    Services.obs.removeObserver(observer, aTopic);
    observing = false;
  }

  let timeout = setTimeout(function () {
    removeObserver();
    aCallback(false);
  }, aTimeout);

  function observer() {
    removeObserver();
    timeout = clearTimeout(timeout);
    executeSoon(() => aCallback(true));
  }

  registerCleanupFunction(function () {
    removeObserver();
    if (timeout) {
      clearTimeout(timeout);
    }
  });

  observing = true;
  Services.obs.addObserver(observer, aTopic);
}

/**
 * Wait until session restore has finished collecting its data and is
 * has written that data ("sessionstore-state-write-complete").
 *
 * @param {function} aCallback If sessionstore-state-write-complete is sent
 * within buffering interval + 100 ms, the callback is passed |true|,
 * otherwise, it is passed |false|.
 */
function waitForSaveState(aCallback) {
  let timeout = 100 + Services.prefs.getIntPref('browser.sessionstore.interval');
  return waitForTopic('sessionstore-state-write-complete', timeout, aCallback);
}
function promiseSaveState() {
  return new Promise((resolve, reject) => {
    waitForSaveState((isSuccessful) => {
      if (!isSuccessful) {
        reject(new Error('Save state timeout'));
      } else {
        resolve();
      }
    });
  });
}
function forceSaveState() {
  return SessionSaver.run();
}

function promiseRecoveryFileContents() {
  let promise = forceSaveState();
  return promise.then(function () {
    return IOUtils.readUTF8(SessionFile.Paths.recovery, {
      decompress: true,
    });
  });
}

var promiseForEachSessionRestoreFile = async function (cb) {
  for (let key of SessionFile.Paths.loadOrder) {
    let data = '';
    try {
      data = await IOUtils.readUTF8(SessionFile.Paths[key], {
        decompress: true,
      });
    } catch (ex) {
      // Ignore missing files
      if (!(DOMException.isInstance(ex) && ex.name == 'NotFoundError')) {
        throw ex;
      }
    }
    cb(data, key);
  }
};

function promiseBrowserLoaded(aBrowser, ignoreSubFrames = true, wantLoad = null) {
  return BrowserTestUtils.browserLoaded(aBrowser, !ignoreSubFrames, wantLoad);
}

function whenWindowLoaded(aWindow, aCallback) {
  aWindow.addEventListener(
    'load',
    function () {
      executeSoon(function executeWhenWindowLoaded() {
        aCallback(aWindow);
      });
    },
    { once: true }
  );
}
function promiseWindowLoaded(aWindow) {
  return new Promise((resolve) => whenWindowLoaded(aWindow, resolve));
}

var gUniqueCounter = 0;
function r() {
  return Date.now() + '-' + ++gUniqueCounter;
}

function* BrowserWindowIterator() {
  for (let currentWindow of Services.wm.getEnumerator('navigator:browser')) {
    if (!currentWindow.closed) {
      yield currentWindow;
    }
  }
}

var gWebProgressListener = {
  _callback: null,

  setCallback(aCallback) {
    if (!this._callback) {
      window.gBrowser.addTabsProgressListener(this);
    }
    this._callback = aCallback;
  },

  unsetCallback() {
    if (this._callback) {
      this._callback = null;
      window.gBrowser.removeTabsProgressListener(this);
    }
  },

  onStateChange(aBrowser, aWebProgress, aRequest, aStateFlags, _aStatus) {
    if (
      aStateFlags & Ci.nsIWebProgressListener.STATE_STOP &&
      aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK &&
      aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW
    ) {
      this._callback(aBrowser);
    }
  },
};

registerCleanupFunction(function () {
  gWebProgressListener.unsetCallback();
});

var gProgressListener = {
  _callback: null,

  setCallback(callback) {
    Services.obs.addObserver(this, 'sessionstore-debug-tab-restored');
    this._callback = callback;
  },

  unsetCallback() {
    if (this._callback) {
      this._callback = null;
      Services.obs.removeObserver(this, 'sessionstore-debug-tab-restored');
    }
  },

  observe(browser) {
    gProgressListener.onRestored(browser);
  },

  onRestored(browser) {
    if (ss.getInternalObjectState(browser) == TAB_STATE_RESTORING) {
      let args = [browser].concat(gProgressListener._countTabs());
      gProgressListener._callback.apply(gProgressListener, args);
    }
  },

  _countTabs() {
    let needsRestore = 0,
      isRestoring = 0,
      wasRestored = 0;

    for (let win of BrowserWindowIterator()) {
      for (let i = 0; i < win.gBrowser.tabs.length; i++) {
        let browser = win.gBrowser.tabs[i].linkedBrowser;
        let state = ss.getInternalObjectState(browser);
        if (browser.isConnected && !state) {
          wasRestored++;
        } else if (state == TAB_STATE_RESTORING) {
          isRestoring++;
        } else if (state == TAB_STATE_NEEDS_RESTORE || !browser.isConnected) {
          needsRestore++;
        }
      }
    }
    return [needsRestore, isRestoring, wasRestored];
  },
};

registerCleanupFunction(function () {
  gProgressListener.unsetCallback();
});

// Close all but our primary window.
function promiseAllButPrimaryWindowClosed() {
  let windows = [];
  for (let win of BrowserWindowIterator()) {
    if (win != window) {
      windows.push(win);
    }
  }

  return Promise.all(windows.map(BrowserTestUtils.closeWindow));
}

// Forget all closed windows.
function forgetClosedWindows() {
  while (ss.getClosedWindowCount() > 0) {
    ss.forgetClosedWindow(0);
  }
}

// Forget all closed tabs for a window
function forgetClosedTabs(win) {
  const closedTabCount = ss.getClosedTabCountForWindow(win);
  for (let i = 0; i < closedTabCount; i++) {
    try {
      ss.forgetClosedTab(win, 0);
    } catch (err) {
      // This will fail if there are tab groups in here
    }
  }
}

function forgetSavedTabGroups() {
  const tabGroups = ss.getSavedTabGroups();
  tabGroups.forEach((tabGroup) => ss.forgetSavedTabGroup(tabGroup.id));
}

function forgetClosedTabGroups(win) {
  const tabGroups = ss.getClosedTabGroups(win);
  tabGroups.forEach((tabGroup) => ss.forgetClosedTabGroup(win, tabGroup.id));
}

/**
 * When opening a new window it is not sufficient to wait for its load event.
 * We need to use whenDelayedStartupFinshed() here as the browser window's
 * delayedStartup() routine is executed one tick after the window's load event
 * has been dispatched. browser-delayed-startup-finished might be deferred even
 * further if parts of the window's initialization process take more time than
 * expected (e.g. reading a big session state from disk).
 */
function whenNewWindowLoaded(aOptions, aCallback) {
  let features = '';
  let url = 'about:blank';

  if ((aOptions && aOptions.private) || false) {
    features = ',private';
    url = 'about:privatebrowsing';
  }

  let win = openDialog(AppConstants.BROWSER_CHROME_URL, '', 'chrome,all,dialog=no' + features, url);
  let delayedStartup = promiseDelayedStartupFinished(win);

  let browserLoaded = new Promise((resolve) => {
    if (url == 'about:blank') {
      resolve();
      return;
    }

    win.addEventListener(
      'load',
      function () {
        let browser = win.gBrowser.selectedBrowser;
        promiseBrowserLoaded(browser).then(resolve);
      },
      { once: true }
    );
  });

  Promise.all([delayedStartup, browserLoaded]).then(() => aCallback(win));
}
function promiseNewWindowLoaded(aOptions) {
  return new Promise((resolve) => whenNewWindowLoaded(aOptions, resolve));
}

/**
 * This waits for the browser-delayed-startup-finished notification of a given
 * window. It indicates that the windows has loaded completely and is ready to
 * be used for testing.
 */
function whenDelayedStartupFinished(aWindow, aCallback) {
  Services.obs.addObserver(function observer(aSubject, aTopic) {
    if (aWindow == aSubject) {
      Services.obs.removeObserver(observer, aTopic);
      executeSoon(aCallback);
    }
  }, 'browser-delayed-startup-finished');
}
function promiseDelayedStartupFinished(aWindow) {
  return new Promise((resolve) => whenDelayedStartupFinished(aWindow, resolve));
}

function promiseTabRestored(tab) {
  return BrowserTestUtils.waitForEvent(tab, 'SSTabRestored');
}

function promiseTabRestoring(tab) {
  return BrowserTestUtils.waitForEvent(tab, 'SSTabRestoring');
}

// Removes the given tab immediately and returns a promise that resolves when
// all pending status updates (messages) of the closing tab have been received.
function promiseRemoveTabAndSessionState(tab) {
  let sessionUpdatePromise = BrowserTestUtils.waitForSessionStoreUpdate(tab);
  BrowserTestUtils.removeTab(tab);
  return sessionUpdatePromise;
}

// Write DOMSessionStorage data to the given browser.
function modifySessionStorage(browser, storageData, storageOptions = {}) {
  let browsingContext = browser.browsingContext;
  if (storageOptions && 'frameIndex' in storageOptions) {
    browsingContext = browsingContext.children[storageOptions.frameIndex];
  }

  return SpecialPowers.spawn(
    browsingContext,
    [[storageData, storageOptions]],
    async function ([data]) {
      let frame = content;
      let keys = new Set(Object.keys(data));
      let isClearing = !keys.size;
      let storage = frame.sessionStorage;

      return new Promise((resolve) => {
        docShell.chromeEventHandler.addEventListener(
          'MozSessionStorageChanged',
          function onStorageChanged(event) {
            if (event.storageArea == storage) {
              keys.delete(event.key);
            }

            if (keys.size == 0) {
              docShell.chromeEventHandler.removeEventListener(
                'MozSessionStorageChanged',
                onStorageChanged,
                true
              );
              resolve();
            }
          },
          true
        );

        if (isClearing) {
          storage.clear();
        } else {
          for (let key of keys) {
            frame.sessionStorage[key] = data[key];
          }
        }
      });
    }
  );
}

function pushPrefs(...aPrefs) {
  return SpecialPowers.pushPrefEnv({ set: aPrefs });
}

function popPrefs() {
  return SpecialPowers.popPrefEnv();
}

function setScrollPosition(bc, x, y) {
  return SpecialPowers.spawn(bc, [x, y], (childX, childY) => {
    return new Promise((resolve) => {
      content.addEventListener(
        'mozvisualscroll',
        function onScroll(event) {
          if (content.document.ownerGlobal.visualViewport == event.target) {
            content.removeEventListener('mozvisualscroll', onScroll, {
              mozSystemGroup: true,
            });
            resolve();
          }
        },
        { mozSystemGroup: true }
      );
      content.scrollTo(childX, childY);
    });
  });
}

async function checkScroll(tab, expected, msg) {
  let browser = tab.linkedBrowser;
  await TabStateFlusher.flush(browser);

  let scroll = JSON.parse(ss.getTabState(tab)).scroll || null;
  is(JSON.stringify(scroll), JSON.stringify(expected), msg);
}

function whenDomWindowClosedHandled(aCallback) {
  Services.obs.addObserver(function observer(aSubject, aTopic) {
    Services.obs.removeObserver(observer, aTopic);
    aCallback();
  }, 'sessionstore-debug-domwindowclosed-handled');
}

function getPropertyOfFormField(browserContext, selector, propName) {
  return SpecialPowers.spawn(
    browserContext,
    [selector, propName],
    (selectorChild, propNameChild) => {
      return content.document.querySelector(selectorChild)[propNameChild];
    }
  );
}

function setPropertyOfFormField(browserContext, selector, propName, newValue) {
  return SpecialPowers.spawn(
    browserContext,
    [selector, propName, newValue],
    (selectorChild, propNameChild, newValueChild) => {
      let node = content.document.querySelector(selectorChild);
      node[propNameChild] = newValueChild;

      let event = node.ownerDocument.createEvent('UIEvents');
      event.initUIEvent('input', true, true, node.ownerGlobal, 0);
      node.dispatchEvent(event);
    }
  );
}

function promiseOnHistoryReplaceEntry(browser) {
  return new Promise((resolve) => {
    let sessionHistory = browser.browsingContext?.sessionHistory;
    if (sessionHistory) {
      var historyListener = {
        OnHistoryNewEntry() {},
        OnHistoryGotoIndex() {},
        OnHistoryPurge() {},
        OnHistoryReload() {
          return true;
        },

        OnHistoryReplaceEntry() {
          resolve();
        },

        QueryInterface: ChromeUtils.generateQI(['nsISHistoryListener', 'nsISupportsWeakReference']),
      };

      sessionHistory.addSHistoryListener(historyListener);
    }
  });
}

function loadTestSubscript(filePath) {
  Services.scriptloader.loadSubScript(new URL(filePath, gTestPath).href, this);
}

function addCoopTask(aFile, aTest, aUrlRoot) {
  async function taskToBeAdded() {
    info(`File ${aFile} has COOP headers enabled`);
    let filePath = `browser/browser/components/sessionstore/test/${aFile}`;
    let url = aUrlRoot + `coopHeaderCommon.sjs?fileRoot=${filePath}`;
    await aTest(url);
  }
  Object.defineProperty(taskToBeAdded, 'name', { value: aTest.name });
  add_task(taskToBeAdded);
}

function addNonCoopTask(aFile, aTest, aUrlRoot) {
  async function taskToBeAdded() {
    await aTest(aUrlRoot + aFile);
  }
  Object.defineProperty(taskToBeAdded, 'name', { value: aTest.name });
  add_task(taskToBeAdded);
}

function openAndCloseTab(window, url) {
  return SessionStoreTestUtils.openAndCloseTab(window, url);
}

/**
 * This is regrettable, but when `promiseBrowserState` resolves, we're still
 * midway through loading the tabs. To avoid race conditions in URLs for tabs
 * being available, wait for all the loads to finish:
 */
function promiseSessionStoreLoads(numberOfLoads) {
  let loadsSeen = 0;
  return new Promise((resolve) => {
    Services.obs.addObserver(function obs(browser) {
      loadsSeen++;
      if (loadsSeen == numberOfLoads) {
        resolve();
      }
      // The typeof check is here to avoid one test messing with everything else by
      // keeping the observer indefinitely.
      if (typeof info == 'undefined' || loadsSeen >= numberOfLoads) {
        Services.obs.removeObserver(obs, 'sessionstore-debug-tab-restored');
      }
      info('Saw load for ' + browser.currentURI.spec);
    }, 'sessionstore-debug-tab-restored');
  });
}

function triggerClickOn(target, options) {
  let promise = BrowserTestUtils.waitForEvent(target, 'click');
  if (AppConstants.platform == 'macosx') {
    options.metaKey = options.ctrlKey;
    delete options.ctrlKey;
  }
  EventUtils.synthesizeMouseAtCenter(target, options);
  return promise;
}

async function openTabMenuFor(tab) {
  let tabMenu = tab.ownerDocument.getElementById('tabContextMenu');

  let tabMenuShown = BrowserTestUtils.waitForEvent(tabMenu, 'popupshown');
  EventUtils.synthesizeMouseAtCenter(tab, { type: 'contextmenu' }, tab.ownerGlobal);
  await tabMenuShown;

  return tabMenu;
}

var withBookmarksDialog = async function (autoCancel, openFn, taskFn, closeFn) {
  let dialogUrl = 'chrome://browser/content/places/bookmarkProperties.xhtml';
  let closed = false;
  // We can't show the in-window prompt for windows which don't have
  // gDialogBox, like the library (Places:Organizer) window.
  let hasDialogBox = !!Services.wm.getMostRecentWindow('').gDialogBox;
  let dialogPromise;
  if (hasDialogBox) {
    dialogPromise = BrowserTestUtils.promiseAlertDialogOpen(null, dialogUrl, {
      isSubDialog: true,
    });
  } else {
    dialogPromise = BrowserTestUtils.domWindowOpenedAndLoaded(null, (win) => {
      return win.document.documentURI.startsWith(dialogUrl);
    }).then((win) => {
      ok(
        win.location.href.startsWith(dialogUrl),
        'The bookmark properties dialog is open: ' + win.location.href
      );
      // This is needed for the overlay.
      return SimpleTest.promiseFocus(win).then(() => win);
    });
  }
  let dialogClosePromise = dialogPromise.then((win) => {
    if (!hasDialogBox) {
      return BrowserTestUtils.domWindowClosed(win);
    }
    let container = win.top.document.getElementById('window-modal-dialog');
    return BrowserTestUtils.waitForEvent(container, 'close').then(() => {
      return BrowserTestUtils.waitForMutationCondition(
        container,
        { childList: true, attributes: true },
        () => !container.hasChildNodes() && !container.open
      );
    });
  });
  dialogClosePromise.then(() => {
    closed = true;
  });

  info('withBookmarksDialog: opening the dialog');
  // The dialog might be modal and could block our events loop, so executeSoon.
  executeSoon(openFn);

  info('withBookmarksDialog: waiting for the dialog');
  let dialogWin = await dialogPromise;

  // Ensure overlay is loaded
  info('waiting for the overlay to be loaded');
  await dialogWin.document.mozSubdialogReady;

  // Check the first input is focused.
  let doc = dialogWin.document;
  let elt = doc.querySelector('input:not([hidden="true"])');
  ok(elt, 'There should be an input to focus.');

  if (elt) {
    info('waiting for focus on the first textfield');
    await TestUtils.waitForCondition(
      () => doc.activeElement == elt,
      'The first non collapsed input should have been focused'
    );
  }

  info('withBookmarksDialog: executing the task');

  let closePromise = () => Promise.resolve();
  if (closeFn) {
    closePromise = closeFn(dialogWin);
  }
  let guid;
  try {
    await taskFn(dialogWin);
  } finally {
    if (!closed && autoCancel) {
      info('withBookmarksDialog: canceling the dialog');
      doc.getElementById('bookmarkpropertiesdialog').cancelDialog();
      await closePromise;
    }
    guid = await PlacesUIUtils.lastBookmarkDialogDeferred.promise;
    // Give the dialog a little time to close itself.
    await dialogClosePromise;
  }
  return guid;
};
