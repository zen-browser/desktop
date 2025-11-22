// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.sys.mjs',
  SessionStore: 'resource:///modules/sessionstore/SessionStore.sys.mjs',
  TabStateFlusher: 'resource:///modules/sessionstore/TabStateFlusher.sys.mjs',
});

const OBSERVING = ['browser-window-delayed-startup'];
const EVENTS = ['TabOpen'];

class nsZenWindowSync {
  constructor() {}

  /**
   * Whether to ignore the next set of events.
   * This is used to prevent recursive event handling.
   */
  #ignoreNextEvents = false;

  /**
   * Iterator that yields all currently opened browser windows.
   * (Might miss the most recent one.)
   * This list is in focus order, but may include minimized windows
   * before non-minimized windows.
   */
  #browserWindows = {
    *[Symbol.iterator]() {
      for (let window of lazy.BrowserWindowTracker.orderedWindows) {
        if (window.__SSi && !window.closed) {
          yield window;
        }
      }
    },
  };

  init() {
    for (let topic of OBSERVING) {
      Services.obs.addObserver(this, topic);
    }
    SessionStore.promiseInitialized.then(() => {
      this.#onSessionStoreInitialized();
    });
  }

  uninit() {
    for (let topic of OBSERVING) {
      Services.obs.removeObserver(this, topic);
    }
  }

  /**
   * Called when a browser window is about to be shown.
   * Adds event listeners for the specified events.
   *
   * @param {Window} aWindow - The browser window that is about to be shown.
   */
  #onWindowBeforeShow(aWindow) {
    for (let eventName of EVENTS) {
      aWindow.addEventListener(eventName, this);
    }
  }

  /** * Generates a unique tab ID.
   *
   * @returns {string} A unique tab ID.
   */
  get #newTabSyncId() {
    // Note: If this changes, make sure to also update the
    // getExtTabGroupIdForInternalTabGroupId implementation in
    // browser/components/extensions/parent/ext-browser.js.
    // See: Bug 1960104 - Improve tab group ID generation in addTabGroup
    // This is implemented from gBrowser.addTabGroup.
    return `${Date.now()}-${Math.round(Math.random() * 100)}`;
  }

  /**
   * Called when the session store has finished initializing for a window.
   *
   * @param {Window} aWindow - The browser window that has initialized session store.
   */
  #onSessionStoreInitialized() {
    // For every tab we have in where there's no sync ID, we need to
    // assign one and sync it to other windows.
    // This should only happen really when updating from an older version
    // that didn't have this feature.
    this.#runOnAllWindows(null, (aWindow) => {
      const { gBrowser } = aWindow;
      for (let tab of gBrowser.tabs) {
        if (!tab.id) {
          tab.id = this.#newTabSyncId;
          lazy.TabStateFlusher.flush(tab.linkedBrowser);
        }
      }
    });
  }

  /**
   * Runs a callback function on all browser windows except the specified one.
   *
   * @param {Window} aWindow - The browser window to exclude.
   * @param {Function} aCallback - The callback function to run on each window.
   */
  #runOnAllWindows(aWindow, aCallback) {
    this.#ignoreNextEvents = true;
    for (let window of this.#browserWindows) {
      if (window !== aWindow) {
        aCallback(window);
      }
    }
    this.#ignoreNextEvents = false;
  }

  observe(aSubject, aTopic) {
    switch (aTopic) {
      case 'browser-window-delayed-startup': {
        this.#onWindowBeforeShow(aSubject);
        break;
      }
    }
  }

  handleEvent(aEvent) {
    if (this.#ignoreNextEvents) {
      return;
    }
    const handler = `on_${aEvent.type}`;
    if (typeof this[handler] === 'function') {
      this[handler](aEvent);
    } else {
      console.warn(`ZenWindowSync: No handler for event type: ${aEvent.type}`);
    }
  }

  /**
   * Synchronizes the icon and label of the target tab with the original tab.
   *
   * @param {Object} aOriginalTab - The original tab to copy from.
   * @param {Object} aTargetTab - The target tab to copy to.
   * @param {Window} aWindow - The window containing the tabs.
   */
  #syncTabWithOriginal(aOriginalTab, aTargetTab, aWindow) {
    const { gBrowser } = aWindow;
    gBrowser.setIcon(aTargetTab, gBrowser.getIcon(aOriginalTab));
    gBrowser._setTabLabel(aTargetTab, aOriginalTab.label);
    this.#syncTabPosition(aOriginalTab, aTargetTab, aWindow);
  }

  /**
   * Synchronizes the position of the target tab with the original tab.
   *
   * @param {Object} aOriginalTab - The original tab to copy from.
   * @param {Object} aTargetTab - The target tab to copy to.
   * @param {Window} aWindow - The window containing the tabs.
   */
  #syncTabPosition(aOriginalTab, aTargetTab, aWindow) {
    const { gBrowser, gZenPinnedTabManager } = aWindow;
    const originalIsEssential = aOriginalTab.hasAttribute('zen-essential');
    const targetIsEssential = aTargetTab.hasAttribute('zen-essential');
    const originalIsPinned = aOriginalTab.pinned;
    const targetIsPinned = aTargetTab.pinned;

    if (originalIsEssential !== targetIsEssential) {
      if (originalIsEssential) {
        gZenPinnedTabManager.addToEssentials(aTargetTab);
      } else {
        gZenPinnedTabManager.removeEssentials(aTargetTab, /* unpin= */ !targetIsPinned);
      }
    } else if (originalIsPinned !== targetIsPinned) {
      if (originalIsPinned) {
        gBrowser.pinTab(aTargetTab);
      } else {
        gBrowser.unpinTab(aTargetTab);
      }
    }
  }

  on_TabOpen(aEvent) {
    const tab = aEvent.target;
    const window = tab.ownerGlobal;

    this.#runOnAllWindows(window, (win) => {
      const newTab = win.gBrowser.duplicateTab(tab);
      this.#syncTabWithOriginal(tab, newTab, win);
    });
  }
}

export const ZenWindowSync = new nsZenWindowSync();
