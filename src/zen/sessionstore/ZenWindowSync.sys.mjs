// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.sys.mjs',
  SessionStore: 'resource:///modules/sessionstore/SessionStore.sys.mjs',
  TabStateFlusher: 'resource:///modules/sessionstore/TabStateFlusher.sys.mjs',
});

const OBSERVING = ['browser-window-before-show'];
const EVENTS = [
  'TabOpen',
  'ZenTabIconChanged',
  'ZenTabLabelChanged',
  'TabMove',
  'TabPinned',
  'TabUnpinned',
  'TabClose',
  'TabAddedToEssentials',
  'TabRemovedFromEssentials',
];

// Flags acting as an enum for sync types.
const SYNC_FLAG_LABEL = 1 << 0;
const SYNC_FLAG_ICON = 1 << 1;
const SYNC_FLAG_MOVE = 1 << 2;

class nsZenWindowSync {
  constructor() {}

  /**
   * Context about the currently handled event.
   * Used to avoid re-entrancy issues.
   *
   * We do still wan't to keep a stack of these in order
   * to handle consequtive events properly. For example,
   * loading a webpage will call IconChanged and TitleChanged
   * events one after another.
   */
  #eventHandlingContext = {
    window: null,
    eventCount: 0,
    lastHandlerPromise: Promise.resolve(),
  };

  /**
   * Iterator that yields all currently opened browser windows.
   * (Might miss the most recent one.)
   * This list is in focus order, but may include minimized windows
   * before non-minimized windows.
   */
  #browserWindows = {
    *[Symbol.iterator]() {
      for (let window of lazy.BrowserWindowTracker.orderedWindows) {
        if (window.__SSi && !window.closed && window.gZenStartup.isReady) {
          yield window;
        }
      }
    },
  };

  init() {
    for (let topic of OBSERVING) {
      Services.obs.addObserver(this, topic);
    }
    lazy.SessionStore.promiseAllWindowsRestored.then(() => {
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
    for (let window of this.#browserWindows) {
      if (window !== aWindow) {
        aCallback(window);
      }
    }
  }

  observe(aSubject, aTopic) {
    switch (aTopic) {
      case 'browser-window-before-show': {
        this.#onWindowBeforeShow(aSubject);
        break;
      }
    }
  }

  handleEvent(aEvent) {
    const window = aEvent.currentTarget.ownerGlobal;
    if (!window.gZenStartup.isReady) {
      return;
    }
    if (this.#eventHandlingContext.window && this.#eventHandlingContext.window !== window) {
      // We're already handling an event for another window.
      // To avoid re-entrancy issues, we skip this event.
      return;
    }
    const lastHandlerPromise = this.#eventHandlingContext.lastHandlerPromise;
    this.#eventHandlingContext.eventCount++;
    this.#eventHandlingContext.window = window;
    let resolveNewPromise;
    this.#eventHandlingContext.lastHandlerPromise = new Promise((resolve) => {
      resolveNewPromise = resolve;
    });
    // Wait for the last handler to finish before processing the next event.
    lastHandlerPromise.then(() => {
      try {
        this.#handleNextEvent(aEvent);
      } finally {
        if (--this.#eventHandlingContext.eventCount === 0) {
          this.#eventHandlingContext.window = null;
        }
        resolveNewPromise();
      }
    });
  }

  /**
   * Handles the next event by calling the appropriate handler method.
   *
   * @param {Event} aEvent - The event to handle.
   */
  #handleNextEvent(aEvent) {
    const handler = `on_${aEvent.type}`;
    if (typeof this[handler] === 'function') {
      this[handler](aEvent);
    } else {
      console.warn(`ZenWindowSync: No handler for event type: ${aEvent.type}`);
    }
  }

  /**
   * Retrieves a tab element from a window by its ID.
   *
   * @param {Window} aWindow - The window containing the tab.
   * @param {string} aTabId - The ID of the tab to retrieve.
   * @returns {Object|null} The tab element if found, otherwise null.
   */
  #getTabFromWindow(aWindow, aTabId) {
    return aWindow.document.getElementById(aTabId);
  }

  /**
   * Synchronizes the icon and label of the target tab with the original tab.
   *
   * @param {Object} aOriginalTab - The original tab to copy from.
   * @param {Object} aTargetTab - The target tab to copy to.
   * @param {Window} aWindow - The window containing the tabs.
   * @param {number} flags - The sync flags indicating what to synchronize.
   */
  #syncTabWithOriginal(aOriginalTab, aTargetTab, aWindow, flags = 0) {
    if (!aOriginalTab || !aTargetTab) {
      return;
    }
    const { gBrowser } = aWindow;
    if (flags & SYNC_FLAG_ICON) {
      gBrowser.setIcon(aTargetTab, gBrowser.getIcon(aOriginalTab));
    }
    if (flags & SYNC_FLAG_LABEL) {
      gBrowser._setTabLabel(aTargetTab, aOriginalTab.label);
    }
    if (flags & SYNC_FLAG_MOVE && !aTargetTab.hasAttribute('zen-empty-tab')) {
      const workspaceId = aOriginalTab.getAttribute('zen-workspace-id');
      if (workspaceId) {
        aTargetTab.setAttribute('zen-workspace-id', workspaceId);
      } else {
        aTargetTab.removeAttribute('zen-workspace-id');
      }
      this.#syncTabPosition(aOriginalTab, aTargetTab, aWindow);
    }
    lazy.TabStateFlusher.flush(aTargetTab.linkedBrowser);
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

    this.#moveTabToMatchOriginal(aOriginalTab, aTargetTab, aWindow, {
      isEssential: originalIsEssential,
      isPinned: originalIsPinned,
    });
  }

  /**
   * Moves the target tab to match the position of the original tab.
   *
   * @param {Object} aOriginalTab - The original tab to match.
   * @param {Object} aTargetTab - The target tab to move.
   * @param {Window} aWindow - The window containing the tabs.
   */
  #moveTabToMatchOriginal(aOriginalTab, aTargetTab, aWindow, { isEssential, isPinned }) {
    const { gBrowser, gZenWorkspaces } = aWindow;
    const originalSibling = aOriginalTab.previousElementSibling;
    let isFirstTab = true;
    if (gBrowser.isTabGroup(originalSibling) || gBrowser.isTab(originalSibling)) {
      isFirstTab = !originalSibling.hasAttribute('id');
    }

    gBrowser.zenHandleTabMove(aOriginalTab, () => {
      if (isFirstTab) {
        let container;
        if (isEssential) {
          container = gZenWorkspaces.getEssentialsSection(aTargetTab);
        } else {
          const workspaceId = aTargetTab.getAttribute('zen-workspace-id');
          const workspaceElement = gZenWorkspaces.workspaceElement(workspaceId);
          container = isPinned
            ? workspaceElement.pinnedTabsContainer
            : workspaceElement.tabsContainer;
        }
        if (container) {
          container.insertBefore(aTargetTab, container.firstChild);
        }
        return;
      }
      const relativeTab = this.#getTabFromWindow(aWindow, originalSibling.id);
      if (relativeTab) {
        relativeTab.after(aTargetTab);
      }
    });
  }

  /**
   * Synchronizes a tab across all browser windows.
   *
   * @param {Object} aTab - The tab to synchronize.
   * @param {number} flags - The sync flags indicating what to synchronize.
   */
  #syncTabForAllWindows(aTab, flags = 0) {
    const window = aTab.ownerGlobal;
    this.#runOnAllWindows(window, (win) => {
      this.#syncTabWithOriginal(aTab, this.#getTabFromWindow(win, aTab.id), win, flags);
    });
  }

  /**
   * Delegates generic sync events to synchronize tabs across windows.
   *
   * @param {Event} aEvent - The event to delegate.
   * @param {number} flags - The sync flags indicating what to synchronize.
   */
  #delegateGenericSyncEvent(aEvent, flags = 0) {
    const tab = aEvent.target;
    this.#syncTabForAllWindows(tab, flags);
  }

  /* Mark: Event Handlers */

  on_TabOpen(aEvent) {
    const tab = aEvent.target;
    const window = tab.ownerGlobal;
    tab.id = this.#newTabSyncId;
    this.#runOnAllWindows(window, (win) => {
      const newTab = win.gBrowser.duplicateTab(tab);
      newTab.id = tab.id;
      this.#syncTabWithOriginal(
        tab,
        newTab,
        win,
        SYNC_FLAG_ICON | SYNC_FLAG_LABEL | SYNC_FLAG_MOVE
      );
      win.gZenVerticalTabsManager.animateItemOpen(newTab);
    });
  }

  on_ZenTabIconChanged(aEvent) {
    return this.#delegateGenericSyncEvent(aEvent, SYNC_FLAG_ICON);
  }

  on_ZenTabLabelChanged(aEvent) {
    return this.#delegateGenericSyncEvent(aEvent, SYNC_FLAG_LABEL);
  }

  on_TabMove(aEvent) {
    return this.#delegateGenericSyncEvent(aEvent, SYNC_FLAG_MOVE);
  }

  on_TabPinned(aEvent) {
    return this.on_TabMove(aEvent);
  }

  on_TabUnpinned(aEvent) {
    return this.on_TabMove(aEvent);
  }

  on_TabAddedToEssentials(aEvent) {
    return this.on_TabMove(aEvent);
  }

  on_TabRemovedFromEssentials(aEvent) {
    return this.on_TabMove(aEvent);
  }

  on_TabClose(aEvent) {
    const tab = aEvent.target;
    const window = tab.ownerGlobal;
    this.#runOnAllWindows(window, (win) => {
      const targetTab = this.#getTabFromWindow(win, tab.id);
      if (targetTab) {
        win.gBrowser.removeTab(targetTab, { animate: true });
      }
    });
  }
}

export const ZenWindowSync = new nsZenWindowSync();
