// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from 'resource://gre/modules/XPCOMUtils.sys.mjs';

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.sys.mjs',
  SessionStore: 'resource:///modules/sessionstore/SessionStore.sys.mjs',
  TabStateFlusher: 'resource:///modules/sessionstore/TabStateFlusher.sys.mjs',
  ZenSessionStore: 'resource:///modules/zen/ZenSessionManager.sys.mjs',
});

XPCOMUtils.defineLazyPreferenceGetter(lazy, 'gWindowSyncEnabled', 'zen.window-sync.enabled');

const OBSERVING = ['browser-window-before-show'];
const EVENTS = [
  'TabOpen',
  'TabClose',

  'ZenTabIconChanged',
  'ZenTabLabelChanged',

  'TabMove',
  'TabPinned',
  'TabUnpinned',
  'TabAddedToEssentials',
  'TabRemovedFromEssentials',

  'TabGroupUpdate',
  'TabGroupCreate',
  'TabGroupRemoved',
  'TabGroupMoved',

  'TabSelect',

  'focus',
  'unload',
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
   * Last focused window.
   * Used to determine which window to sync tab contents visibility from.
   */
  #lastFocusedWindow = null;

  /**
   * Last selected tab.
   * Used to determine if we should run another sync operation
   * when switching browser views.
   */
  #lastSelectedTab = null;

  /**
   * Iterator that yields all currently opened browser windows.
   * (Might miss the most recent one.)
   * This list is in focus order, but may include minimized windows
   * before non-minimized windows.
   */
  #browserWindows = {
    *[Symbol.iterator]() {
      for (let window of lazy.BrowserWindowTracker.orderedWindows) {
        if (
          window.__SSi &&
          !window.closed &&
          window.gZenStartup.isReady &&
          !window.gZenWorkspaces?.privateWindowOrDisabled
        ) {
          yield window;
        }
      }
    },
  };

  init() {
    if (!lazy.gWindowSyncEnabled) {
      return;
    }
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
    // There are 2 possibilities to know if we are trying to open
    // a new *unsynced* window:
    // 1. We are passing `zen-unsynced` in the window arguments.
    // 2. We are trying to open a link in a new window where other synced
    //   windows already exist
    let forcedSync = false;
    let hasUnsyncedArg = false;
    for (let arg of aWindow.arguments) {
      if (arg === 'zen-synced') {
        forcedSync = true;
      } else if (arg === 'zen-unsynced') {
        hasUnsyncedArg = true;
      }
    }
    if (
      !forcedSync &&
      (hasUnsyncedArg ||
        (typeof aWindow.arguments[0] === 'string' &&
          aWindow.arguments.length > 1 &&
          [...this.#browserWindows].length > 0))
    ) {
      aWindow.document.documentElement.setAttribute('zen-unsynced-window', 'true');
      return;
    }
    aWindow.gZenWindowSync = this;
    for (let eventName of EVENTS) {
      aWindow.addEventListener(eventName, this, true);
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
   * @returns {any} The value returned by the callback function, if any.
   */
  #runOnAllWindows(aWindow, aCallback) {
    for (let window of this.#browserWindows) {
      if (window !== aWindow) {
        let value = aCallback(window);
        if (value) {
          return value;
        }
      }
    }
    return null;
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
    if (!window.gZenStartup.isReady || window.gZenWorkspaces?.privateWindowOrDisabled) {
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
   * Retrieves a item element from a window by its ID.
   *
   * @param {Window} aWindow - The window containing the item.
   * @param {string} aItemId - The ID of the item to retrieve.
   * @returns {MozTabbrowserTab|MozTabbrowserTabGroup|null} The item element if found, otherwise null.
   */
  #getItemFromWindow(aWindow, aItemId) {
    return aWindow.document.getElementById(aItemId);
  }

  /**
   * Synchronizes the icon and label of the target tab with the original tab.
   *
   * @param {Object} aOriginalTab - The original tab to copy from.
   * @param {Object} aTargetTab - The target tab to copy to.
   * @param {Window} aWindow - The window containing the tabs.
   * @param {number} flags - The sync flags indicating what to synchronize.
   */
  #syncItemWithOriginal(aOriginalItem, aTargetItem, aWindow, flags = 0) {
    if (!aOriginalItem || !aTargetItem) {
      return;
    }
    const { gBrowser, gZenFolders } = aWindow;
    if (flags & SYNC_FLAG_ICON) {
      if (gBrowser.isTab(aOriginalItem)) {
        gBrowser.setIcon(aTargetItem, gBrowser.getIcon(aOriginalItem));
      } else if (aOriginalItem.isZenFolder) {
        // Icons are a zen-only feature for tab groups.
        gZenFolders.setFolderUserIcon(aTargetItem, aOriginalItem.iconURL);
      }
    }
    if (flags & SYNC_FLAG_LABEL) {
      if (gBrowser.isTab(aOriginalItem)) {
        gBrowser._setTabLabel(aTargetItem, aOriginalItem.label);
      } else if (gBrowser.isTabGroup(aOriginalItem)) {
        aTargetItem.label = aOriginalItem.label;
      }
    }
    if (flags & SYNC_FLAG_MOVE && !aTargetItem.hasAttribute('zen-empty-tab')) {
      const workspaceId = aOriginalItem.getAttribute('zen-workspace-id');
      if (workspaceId) {
        aTargetItem.setAttribute('zen-workspace-id', workspaceId);
      } else {
        aTargetItem.removeAttribute('zen-workspace-id');
      }
      this.#syncItemPosition(aOriginalItem, aTargetItem, aWindow);
    }
    if (gBrowser.isTab(aTargetItem)) {
      lazy.TabStateFlusher.flush(aTargetItem.linkedBrowser);
    }
  }

  /**
   * Synchronizes the position of the target item with the original item.
   *
   * @param {MozTabbrowserTab|MozTabbrowserTabGroup} aOriginalItem - The original item to copy from.
   * @param {MozTabbrowserTab|MozTabbrowserTabGroup} aTargetItem - The target item to copy to.
   * @param {Window} aWindow - The window containing the items.
   */
  #syncItemPosition(aOriginalItem, aTargetItem, aWindow) {
    const { gBrowser, gZenPinnedTabManager } = aWindow;
    const originalIsEssential = aOriginalItem.hasAttribute('zen-essential');
    const targetIsEssential = aTargetItem.hasAttribute('zen-essential');
    const originalIsPinned = aOriginalItem.pinned;
    const targetIsPinned = aTargetItem.pinned;

    const isGroup = gBrowser.isTabGroup(aOriginalItem);
    const isTab = !isGroup;

    if (isTab) {
      if (originalIsEssential !== targetIsEssential) {
        if (originalIsEssential) {
          gZenPinnedTabManager.addToEssentials(aTargetItem);
        } else {
          gZenPinnedTabManager.removeEssentials(aTargetItem, /* unpin= */ !targetIsPinned);
        }
      } else if (originalIsPinned !== targetIsPinned) {
        if (originalIsPinned) {
          gBrowser.pinTab(aTargetItem);
        } else {
          gBrowser.unpinTab(aTargetItem);
        }
      }
    }

    this.#moveItemToMatchOriginal(aOriginalItem, aTargetItem, aWindow, {
      isEssential: originalIsEssential,
      isPinned: originalIsPinned,
    });
  }

  /**
   * Moves the target item to match the position of the original item.
   *
   * @param {MozTabbrowserTab|MozTabbrowserTabGroup} aOriginalItem - The original item to match.
   * @param {MozTabbrowserTab|MozTabbrowserTabGroup} aTargetItem - The target item to move.
   * @param {Window} aWindow - The window containing the items.
   */
  #moveItemToMatchOriginal(aOriginalItem, aTargetItem, aWindow, { isEssential, isPinned }) {
    const { gBrowser, gZenWorkspaces } = aWindow;
    const originalSibling = aOriginalItem.previousElementSibling;
    let isFirstTab = true;
    if (gBrowser.isTabGroup(originalSibling) || gBrowser.isTab(originalSibling)) {
      isFirstTab =
        !originalSibling.hasAttribute('id') || originalSibling.hasAttribute('zen-empty-tab');
    }

    gBrowser.zenHandleTabMove(aOriginalItem, () => {
      if (isFirstTab) {
        let container;
        const parentGroup = aOriginalItem.group;
        if (parentGroup?.hasAttribute('id')) {
          container = this.#getItemFromWindow(aWindow, parentGroup.getAttribute('id'));
          if (container) {
            if (container?.tabs?.length) {
              // First tab in folders is the empty tab placeholder.
              container.tabs[0].after(aTargetItem);
            } else {
              container.appendChild(aTargetItem);
            }
            return;
          }
        }
        if (isEssential) {
          container = gZenWorkspaces.getEssentialsSection(aTargetItem);
        } else {
          const workspaceId = aTargetItem.getAttribute('zen-workspace-id');
          const workspaceElement = gZenWorkspaces.workspaceElement(workspaceId);
          container = isPinned
            ? workspaceElement?.pinnedTabsContainer
            : workspaceElement?.tabsContainer;
        }
        if (container) {
          container.insertBefore(aTargetItem, container.firstChild);
        }
        return;
      }
      const relativeTab = this.#getItemFromWindow(aWindow, originalSibling.id);
      if (relativeTab) {
        relativeTab.after(aTargetItem);
      }
    });
  }

  /**
   * Synchronizes a item across all browser windows.
   *
   * @param {MozTabbrowserTab|MozTabbrowserTabGroup} aItem - The item to synchronize.
   * @param {number} flags - The sync flags indicating what to synchronize.
   */
  #syncItemForAllWindows(aItem, flags = 0) {
    const window = aItem.ownerGlobal;
    this.#runOnAllWindows(window, (win) => {
      this.#syncItemWithOriginal(aItem, this.#getItemFromWindow(win, aItem.id), win, flags);
    });
  }

  /**
   * Swaps the browser docshells between two tabs.
   *
   * @param {Object} aOurTab - The tab in the current window.
   * @param {Object} aOtherTab - The tab in the other window.
   */
  async #swapBrowserDocShellsAsync(aOurTab, aOtherTab) {
    await this.#styleSwapedBrowsers(aOurTab, aOtherTab);
    this.#swapBrowserDocSheellsInner(aOurTab, aOtherTab);
  }

  /**
   * Swaps the browser docshells between two tabs.
   *
   * @param {Object} aOurTab - The tab in the current window.
   * @param {Object} aOtherTab - The tab in the other window.
   */
  #swapBrowserDocSheellsInner(aOurTab, aOtherTab, focus = true) {
    // Load about:blank
    if (aOurTab.linkedBrowser?.currentURI.spec !== 'about:blank') {
      aOurTab.linkedBrowser.loadURI(Services.io.newURI('about:blank'), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        loadFlags: Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY,
      });
    }
    aOurTab.ownerGlobal.gBrowser.swapBrowsersAndCloseOther(aOurTab, aOtherTab, false);
    aOtherTab.permanentKey = aOurTab.permanentKey;
    const kAttributesToRemove = ['muted', 'soundplaying', 'sharing', 'pictureinpicture'];
    // swapBrowsersAndCloseOther already takes care of transferring attributes like 'muted',
    // but we need to manually remove some attributes from the other tab.
    for (let attr of kAttributesToRemove) {
      aOtherTab.removeAttribute(attr);
    }
    if (focus) {
      // Recalculate the focus in order to allow the user to continue typing
      // inside the web contentx area without having to click outside and back in.
      aOurTab.linkedBrowser.blur();
      aOurTab.ownerGlobal.gBrowser._adjustFocusAfterTabSwitch(aOurTab);
    }
    // Ensure the tab's state is flushed after the swap. By doing this,
    // we can re-schedule another session store delayed process to fire.
    // It's also important to note that if we don't flush the state here,
    // we would start recieving invalid history changes from the the incorrect
    // browser view that was just swapped out.
    lazy.TabStateFlusher.flush(aOurTab.linkedBrowser);
  }

  /**
   * Styles the swapped browsers to ensure proper visibility and layout.
   *
   * @param {Object} aOurTab - The tab in the current window.
   * @param {Object} aOtherTab - The tab in the other window.
   * @param {boolean} onClose - Indicates if the styling is done during a tab close operation.
   */
  async #styleSwapedBrowsers(aOurTab, aOtherTab, onClose = false) {
    const ourBrowser = aOurTab.linkedBrowser;
    const otherBrowser = aOtherTab.linkedBrowser;

    if (!onClose) {
      const browserBlob = await aOtherTab.ownerGlobal.PageThumbs.captureToBlob(
        aOtherTab.linkedBrowser,
        {
          fullScale: true,
          fullViewport: true,
        }
      );

      let mySrc = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(browserBlob);
        reader.onloadend = function () {
          // result includes identifier 'data:image/png;base64,' plus the base64 data
          resolve(reader.result);
        };
        reader.onerror = function () {
          reject(new Error('Failed to read blob as data URL'));
        };
      });

      const [img, loadPromise] = this.#createPseudoImageForBrowser(otherBrowser, mySrc);
      // Run a reflow to ensure the image is rendered before hiding the browser.
      void img.getBoundingClientRect();
      await loadPromise;
      otherBrowser.setAttribute('zen-pseudo-hidden', 'true');
    }

    this.#maybeRemovePseudoImageForBrowser(ourBrowser);
    ourBrowser.removeAttribute('zen-pseudo-hidden');
  }

  /**
   * Create and insert a new pseudo image for a browser element.
   *
   * @param {Object} aBrowser - The browser element to create the pseudo image for.
   * @param {string} aSrc - The source URL of the image.
   * @returns {Object} The created pseudo image element.
   */
  #createPseudoImageForBrowser(aBrowser, aSrc) {
    const doc = aBrowser.ownerDocument;
    const img = doc.createElement('img');
    img.className = 'zen-pseudo-browser-image';
    aBrowser.after(img);
    const loadPromise = new Promise((resolve) => {
      img.onload = () => resolve();
      img.src = aSrc;
    });
    return [img, loadPromise];
  }

  /**
   * Removes the pseudo image element for a browser if it exists.
   *
   * @param {Object} aBrowser - The browser element to remove the pseudo image for.
   */
  #maybeRemovePseudoImageForBrowser(aBrowser) {
    const elements = aBrowser.parentNode?.querySelectorAll('.zen-pseudo-browser-image');
    if (elements) {
      elements.forEach((element) => element.remove());
    }
  }

  /**
   * Retrieves the active tab, where the web contents are being viewed
   * from other windows by its ID.
   *
   * @param {Window} aWindow - The window to exclude.
   * @param {string} aTabId - The ID of the tab to retrieve.
   * @param {Function} filter - A function to filter the tabs.
   * @returns {Object|null} The active tab from other windows if found, otherwise null.
   */
  #getActiveTabFromOtherWindows(aWindow, aTabId, filter = (tab) => tab?._zenContentsVisible) {
    return this.#runOnAllWindows(aWindow, (win) => {
      const tab = this.#getItemFromWindow(win, aTabId);
      if (filter(tab)) {
        return tab;
      }
    });
  }

  /**
   * Moves all active tabs from the specified window to other windows.
   *
   * @param {Window} aWindow - The window to move active tabs from.
   */
  #moveAllActiveTabsToOtherWindows(aWindow) {
    const mostRecentWindow = [...this.#browserWindows].find((win) => win !== aWindow);
    if (!mostRecentWindow || !aWindow.gZenWorkspaces) {
      return;
    }
    const activeTabsOnClosedWindow = aWindow.gZenWorkspaces.allStoredTabs.filter(
      (tab) => tab._zenContentsVisible
    );
    for (let tab of activeTabsOnClosedWindow) {
      const targetTab = this.#getItemFromWindow(mostRecentWindow, tab.id);
      if (targetTab) {
        targetTab._zenContentsVisible = true;
        this.#swapBrowserDocSheellsInner(targetTab, tab, targetTab.selected);
        // We can animate later, whats important is to always stay on the same
        // process and avoid async operations here to avoid the closed window
        // being unloaded before the swap is done.
        this.#styleSwapedBrowsers(targetTab, tab, /* onClose =*/ true);
      }
    }
  }

  /**
   * Handles tab switch or window focus events to synchronize tab contents visibility.
   *
   * @param {Window} aWindow - The window that triggered the event.
   * @param {Object} aPreviousTab - The previously selected tab.
   */
  #onTabSwitchOrWindowFocus(aWindow, aPreviousTab = null) {
    const selectedTab = aWindow.gBrowser.selectedTab;
    if (aPreviousTab?._zenContentsVisible) {
      const otherTabToShow = this.#getActiveTabFromOtherWindows(
        aWindow,
        aPreviousTab.id,
        (tab) => tab?.selected
      );
      if (otherTabToShow) {
        otherTabToShow._zenContentsVisible = true;
        delete aPreviousTab._zenContentsVisible;
        this.#swapBrowserDocShellsAsync(otherTabToShow, aPreviousTab);
      }
    }
    if (selectedTab._zenContentsVisible) {
      return;
    }
    const otherSelectedTab = this.#getActiveTabFromOtherWindows(aWindow, selectedTab.id);
    selectedTab._zenContentsVisible = true;
    if (otherSelectedTab) {
      delete otherSelectedTab._zenContentsVisible;
      this.#swapBrowserDocShellsAsync(selectedTab, otherSelectedTab);
    }
  }

  /**
   * Delegates generic sync events to synchronize tabs across windows.
   *
   * @param {Event} aEvent - The event to delegate.
   * @param {number} flags - The sync flags indicating what to synchronize.
   */
  #delegateGenericSyncEvent(aEvent, flags = 0) {
    const item = aEvent.target;
    this.#syncItemForAllWindows(item, flags);
  }

  /* Mark: Public API */

  shouldLoadTab(aTab) {
    if (!lazy.gWindowSyncEnabled) {
      // Since we are never going to sync the tab, we can always load it.
      return true;
    }
    if (aTab._zenContentsVisible) {
      // This tab is already active in this window.
      return true;
    }
    // We don't want to trigger a new browser kick-off if there's
    // another window where this tab is already active.
    return !this.#getActiveTabFromOtherWindows(
      aTab.ownerGlobal,
      aTab.id,
      (tab) => tab?._zenContentsVisible
    );
  }

  moveTabsToSyncedWorkspace(aWindow, aWorkspaceId) {
    const tabsToMove = aWindow.gZenWorkspaces.allStoredTabs.filter(
      (tab) => !tab.hasAttribute('zen-empty-tab')
    );
    const selectedTab = aWindow.gBrowser.selectedTab;
    let win = [...this.#browserWindows][0];
    const moveAllTabsToWindow = (allowSelected = false) => {
      const { gBrowser, gZenWorkspaces } = win;
      win.focus();
      let tabIndex = 0;
      let success = true;
      for (const tab of tabsToMove) {
        if (tab !== selectedTab || allowSelected) {
          const newTab = gBrowser.adoptTab(tab, { tabIndex });
          if (!newTab) {
            // The adoption failed. Restore "fadein" and don't increase the index.
            tab.setAttribute('fadein', 'true');
            success = false;
            continue;
          }
          gZenWorkspaces.moveTabToWorkspace(newTab, aWorkspaceId);
          ++tabIndex;
        }
      }
      if (success) {
        aWindow.close();
      }
    };
    if (!win) {
      win = this.replaceTabWithWindow(selectedTab, {}, /* zenForceSync = */ true);
      win.addEventListener(
        'before-initial-tab-adopted',
        () => {
          moveAllTabsToWindow();
        },
        { once: true }
      );
      return;
    }
    moveAllTabsToWindow(true);
  }

  /* Mark: Event Handlers */

  on_TabOpen(aEvent) {
    const tab = aEvent.target;
    const window = tab.ownerGlobal;
    // TODO: Should we only set this flag if the tab is selected?
    tab._zenContentsVisible = true;
    if (tab.id) {
      // This tab was opened as part of a sync operation.
      return;
    }
    tab.id = this.#newTabSyncId;
    this.#runOnAllWindows(window, (win) => {
      const newTab = win.gBrowser.addTrustedTab('about:blank', {
        animate: true,
        createLazyBrowser: true,
        zenWorkspaceId: tab.getAttribute('zen-workspace-id') || '',
        _forZenEmptyTab: tab.hasAttribute('zen-empty-tab'),
      });
      newTab.id = tab.id;
      this.#syncItemWithOriginal(
        tab,
        newTab,
        win,
        SYNC_FLAG_ICON | SYNC_FLAG_LABEL | SYNC_FLAG_MOVE
      );
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
      const targetTab = this.#getItemFromWindow(win, tab.id);
      if (targetTab) {
        win.gBrowser.removeTab(targetTab, { animate: true });
      }
    });
  }

  on_focus(aEvent) {
    const { ownerGlobal: window } = aEvent.target;
    if (!window.gBrowser || this.#lastFocusedWindow?.deref() === window) {
      return;
    }
    this.#lastFocusedWindow = new WeakRef(window);
    this.#lastSelectedTab = new WeakRef(window.gBrowser.selectedTab);
    this.#onTabSwitchOrWindowFocus(window);
  }

  on_TabSelect(aEvent) {
    const tab = aEvent.target;
    if (this.#lastSelectedTab?.deref() === tab) {
      return;
    }
    this.#lastSelectedTab = new WeakRef(tab);
    const previousTab = aEvent.detail.previousTab;
    this.#onTabSwitchOrWindowFocus(aEvent.target.ownerGlobal, previousTab);
  }

  on_unload(aEvent) {
    const window = aEvent.target.ownerGlobal;
    for (let eventName of EVENTS) {
      window.removeEventListener(eventName, this);
    }
    delete window.gZenWindowSync;
    this.#moveAllActiveTabsToOtherWindows(window);
  }

  on_TabGroupCreate(aEvent) {
    const tabGroup = aEvent.target;
    if (tabGroup.id) {
      // This tab group was opened as part of a sync operation.
      console.log('Duplicate!');
    }
    const window = tabGroup.ownerGlobal;
    const isFolder = tabGroup.isZenFolder;
    const isSplitView = tabGroup.hasAttribute('split-view-group');
    // Tab groups already have an ID upon creation.
    this.#runOnAllWindows(window, (win) => {
      const newGroup = isFolder
        ? win.gZenFolders.createFolder([], {})
        : win.gBrowser.addTabGroup({ splitView: isSplitView });
      newGroup.id = tabGroup.id;
      this.#syncItemWithOriginal(
        tabGroup,
        newGroup,
        win,
        SYNC_FLAG_ICON | SYNC_FLAG_LABEL | SYNC_FLAG_MOVE
      );
    });
  }

  on_TabGroupRemoved(aEvent) {
    const tabGroup = aEvent.target;
    const window = tabGroup.ownerGlobal;
    this.#runOnAllWindows(window, (win) => {
      const targetGroup = this.#getItemFromWindow(win, tabGroup.id);
      if (targetGroup) {
        if (targetGroup.isZenFolder) {
          targetGroup.delete();
        } else {
          win.gBrowser.removeTabGroup(targetGroup, { isUserTriggered: true });
        }
      }
    });
  }

  on_TabGroupMoved(aEvent) {
    return this.on_TabMove(aEvent);
  }

  on_TabGroupUpdate(aEvent) {
    return this.#delegateGenericSyncEvent(aEvent, SYNC_FLAG_ICON | SYNC_FLAG_LABEL);
  }
}

export const ZenWindowSync = new nsZenWindowSync();
