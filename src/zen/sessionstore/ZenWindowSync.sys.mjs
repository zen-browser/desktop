/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-disable consistent-return */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  TabStateFlusher: "resource:///modules/sessionstore/TabStateFlusher.sys.mjs",
  // eslint-disable-next-line mozilla/valid-lazy
  ZenSessionStore: "resource:///modules/zen/ZenSessionManager.sys.mjs",
  TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(lazy, "gWindowSyncEnabled", "zen.window-sync.enabled", true);
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gSyncOnlyPinnedTabs",
  "zen.window-sync.sync-only-pinned-tabs",
  true
);
XPCOMUtils.defineLazyPreferenceGetter(lazy, "gShouldLog", "zen.window-sync.log", true);

const OBSERVING = ["browser-window-before-show", "sessionstore-windows-restored"];
const INSTANT_EVENTS = ["SSWindowClosing"];
const UNSYNCED_WINDOW_EVENTS = ["TabOpen"];
const EVENTS = [
  "TabClose",

  "ZenTabIconChanged",
  "ZenTabLabelChanged",

  "TabMove",
  "TabPinned",
  "TabUnpinned",
  "TabAddedToEssentials",
  "TabRemovedFromEssentials",

  "TabGroupUpdate",
  "TabGroupCreate",
  "TabGroupRemoved",
  "TabGroupMoved",

  "ZenTabRemovedFromSplit",
  "ZenSplitViewTabsSplit",

  "TabSelect",

  "focus",
  ...INSTANT_EVENTS,
  ...UNSYNCED_WINDOW_EVENTS,
];

// Flags acting as an enum for sync types.
const SYNC_FLAG_LABEL = 1 << 0;
const SYNC_FLAG_ICON = 1 << 1;
const SYNC_FLAG_MOVE = 1 << 2;

class nsZenWindowSync {
  #initialized = false;
  constructor() {}

  /**
   * Context about the currently handled event.
   * Used to avoid re-entrancy issues.
   *
   * We do still want to keep a stack of these in order
   * to handle consecutive events properly. For example,
   * loading a webpage will call IconChanged and TitleChanged
   * events one after another.
   */
  #eventHandlingContext = {
    window: null,
    eventCount: 0,
    lastHandlerPromise: Promise.resolve(),
  };

  /**
   * Map of sync handlers for different event types.
   * Each handler is a function that takes the event as an argument.
   */
  #syncHandlers = new Set();

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
   * A list containing all swaped tabs with their respective browser permanent
   * keys. This is used in between SSWindowClosing and WindowCloseAndBrowserFlushed.
   *
   * When we close windows, there's a small chance that browsers havent't been flushed
   * yet when we try to move active tabs to other windows. This map allows us to
   * retrieve the correct tab entries from the cache in order to avoid losing
   * tab history.
   *
   * @type {WeakMap<object, MozTabbrowserTab>}
   */
  #swapedTabsEntriesForWC = new WeakMap();

  /**
   * Iterator that yields all currently opened browser windows.
   * (Might miss the most recent one.)
   * This list is in focus order, but may include minimized windows
   * before non-minimized windows.
   */
  #browserWindows = {
    *[Symbol.iterator]() {
      for (let window of lazy.BrowserWindowTracker.orderedWindows) {
        if (window.__SSi && !window.closed && !window.gZenWorkspaces?.privateWindowOrDisabled) {
          yield window;
        }
      }
    },
  };

  /**
   * @returns {Array<Window>} A list of all currently opened browser windows.
   */
  get #browserWindowsList() {
    return Array.from(this.#browserWindows);
  }

  /**
   * @returns {Window|null} The first opened browser window, or null if none exist.
   */
  get #firstSyncedWindow() {
    for (let window of this.#browserWindows) {
      return window;
    }
    return null;
  }

  init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
    for (let topic of OBSERVING) {
      Services.obs.addObserver(this, topic);
    }
  }

  uninit() {
    if (!this.#initialized) {
      return;
    }
    this.#initialized = false;
    for (let topic of OBSERVING) {
      Services.obs.removeObserver(this, topic);
    }
  }

  log(...args) {
    if (lazy.gShouldLog) {
      // eslint-disable-next-line no-console
      console.info("ZenWindowSync:", ...args);
    }
  }

  /**
   * Called when a browser window is about to be shown.
   * Adds event listeners for the specified events.
   *
   * @param {Window} aWindow - The browser window that is about to be shown.
   */
  #onWindowBeforeShow(aWindow) {
    if (
      aWindow.gZenWindowSync ||
      aWindow.document.documentElement.hasAttribute("zen-unsynced-window")
    ) {
      return;
    }
    this.log("Setting up window sync for window", aWindow);
    // There are 2 possibilities to know if we are trying to open
    // a new *unsynced* window:
    // 1. We are passing `zen-unsynced` in the window arguments.
    // 2. We are trying to open a link in a new window where other synced
    //   windows already exist
    // Note, we force syncing if the window is private or workspaces is disabled
    // to avoid confusing the old private window behavior.
    let forcedSync = !aWindow.gZenWorkspaces?.privateWindowOrDisabled;
    let hasUnsyncedArg = false;
    // See issue https://github.com/zen-browser/desktop/issues/12211
    if (lazy.PrivateBrowsingUtils.isWindowPrivate(aWindow)) {
      aWindow._zenStartupSyncFlag = "synced";
    }
    if (aWindow._zenStartupSyncFlag === "synced") {
      forcedSync = true;
    } else if (aWindow._zenStartupSyncFlag === "unsynced") {
      hasUnsyncedArg = true;
    }
    delete aWindow._zenStartupSyncFlag;
    if (
      !forcedSync &&
      (hasUnsyncedArg ||
        (typeof aWindow.arguments[0] === "string" &&
          aWindow.arguments.length > 1 &&
          !!this.#browserWindowsList.length))
    ) {
      this.log("Not syncing new window due to unsynced argument or existing synced windows");
      aWindow.document.documentElement.setAttribute("zen-unsynced-window", "true");
      for (let eventName of UNSYNCED_WINDOW_EVENTS) {
        aWindow.addEventListener(eventName, this, true);
      }
      return;
    }
    aWindow.gZenWindowSync = this;
    for (let eventName of EVENTS) {
      aWindow.addEventListener(eventName, this, true);
    }
  }

  /**
   * Called when the session store has finished initializing for a window.
   */
  async #onSessionStoreInitialized() {
    // For every tab we have in where there's no sync ID, we need to
    // assign one and sync it to other windows.
    // This should only happen really when updating from an older version
    // that didn't have this feature.
    await this.#runOnAllWindowsAsync(null, async (aWindow) => {
      const { gZenWorkspaces } = aWindow;
      this.#onWindowBeforeShow(aWindow);
      await gZenWorkspaces.promiseInitialized;
      for (let tab of gZenWorkspaces.allStoredTabs) {
        if (!tab.id) {
          tab.id = this.#newTabSyncId;
          // Don't call with await here to avoid blocking the loop.
          this.#maybeFlushTabState(tab);
        }
        if (tab.pinned && !tab._zenPinnedInitialState) {
          await this.setPinnedTabState(tab);
        }
        if (!lazy.gWindowSyncEnabled || (lazy.gSyncOnlyPinnedTabs && !tab.pinned)) {
          tab._zenContentsVisible = true;
        }
      }
    });
  }

  /**
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
   * Runs a callback function on all browser windows except the specified one.
   *
   * @param {Window} aWindow - The browser window to exclude.
   * @param {Function} aCallback - The callback function to run on each window.
   * @returns {any} The value returned by the callback function, if any.
   */
  #runOnAllWindows(aWindow, aCallback) {
    for (let window of this.#browserWindows) {
      if (window !== aWindow && !window._zenClosingWindow) {
        let value = aCallback(window);
        if (value) {
          return value;
        }
      }
    }
    return null;
  }

  /**
   * Runs a callback function on all browser windows except the specified one.
   * This version supports asynchronous callbacks.
   *
   * @see #runOnAllWindows - Make sure functionality is the same.
   * @param {Window} aWindow - The browser window to exclude.
   * @param {Function} aCallback - The asynchronous callback function to run on each window.
   */
  async #runOnAllWindowsAsync(aWindow, aCallback) {
    for (let window of this.#browserWindows) {
      if (window !== aWindow && !window._zenClosingWindow) {
        await aCallback(window);
      }
    }
  }

  observe(aSubject, aTopic) {
    switch (aTopic) {
      case "browser-window-before-show": {
        this.#onWindowBeforeShow(aSubject);
        break;
      }
      case "sessionstore-windows-restored": {
        this.#onSessionStoreInitialized();
        break;
      }
    }
  }

  handleEvent(aEvent) {
    const window = aEvent.currentTarget.ownerGlobal;
    if (
      !window.gZenStartup.isReady ||
      !window.gZenWorkspaces?.shouldHaveWorkspaces ||
      window._zenClosingWindow
    ) {
      return;
    }
    if (!lazy.gWindowSyncEnabled && !UNSYNCED_WINDOW_EVENTS.includes(aEvent.type)) {
      return;
    }
    if (INSTANT_EVENTS.includes(aEvent.type)) {
      this.#handleNextEvent(aEvent);
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
      this.#handleNextEvent(aEvent).finally(() => {
        if (--this.#eventHandlingContext.eventCount === 0) {
          this.#eventHandlingContext.window = null;
        }
        resolveNewPromise();
      });
    });
  }

  /**
   * Adds a sync handler for a specific event type.
   *
   * @param {Function} aHandler - The sync handler function to add.
   */
  addSyncHandler(aHandler) {
    if (!aHandler || this.#syncHandlers.has(aHandler)) {
      return;
    }
    this.#syncHandlers.add(aHandler);
  }

  /**
   * Removes a sync handler for a specific event type.
   *
   * @param {Function} aHandler - The sync handler function to remove.
   */
  removeSyncHandler(aHandler) {
    this.#syncHandlers.delete(aHandler);
  }

  /**
   * Handles the next event by calling the appropriate handler method.
   *
   * @param {Event} aEvent - The event to handle.
   */
  #handleNextEvent(aEvent) {
    const handler = `on_${aEvent.type}`;
    try {
      if (typeof this[handler] === "function") {
        let promise = this[handler](aEvent) || Promise.resolve();
        promise.then(() => {
          for (let syncHandler of this.#syncHandlers) {
            try {
              syncHandler(aEvent);
            } catch (e) {
              console.error(e);
            }
          }
        });
        return promise;
      }
      throw new Error(`No handler for event type: ${aEvent.type}`);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Retrieves a item element from a window by its ID.
   *
   * @param {Window} aWindow - The window containing the item.
   * @param {string} aItemId - The ID of the item to retrieve.
   * @returns {MozTabbrowserTab|MozTabbrowserTabGroup|null} The item element if found, otherwise null.
   */
  getItemFromWindow(aWindow, aItemId) {
    if (!aItemId) {
      return null;
    }
    return aWindow.document.getElementById(aItemId);
  }

  /**
   * Synchronizes a specific attribute from the original item to the target item.
   *
   * @param {MozTabbrowserTab|MozTabbrowserTabGroup} aOriginalItem - The original item to copy from.
   * @param {MozTabbrowserTab|MozTabbrowserTabGroup} aTargetItem - The target item to copy to.
   * @param {string} aAttributeName - The name of the attribute to synchronize.
   */
  #maybeSyncAttributeChange(aOriginalItem, aTargetItem, aAttributeName) {
    if (aOriginalItem.hasAttribute(aAttributeName)) {
      aTargetItem.setAttribute(aAttributeName, aOriginalItem.getAttribute(aAttributeName));
    } else {
      aTargetItem.removeAttribute(aAttributeName);
    }
  }

  /**
   * Synchronizes the icon and label of the target tab with the original tab.
   *
   * @param {object} aOriginalItem - The original item to copy from.
   * @param {object} aTargetItem - The target item to copy to.
   * @param {Window} aWindow - The window containing the tabs.
   * @param {number} flags - The sync flags indicating what to synchronize.
   */
  #syncItemWithOriginal(aOriginalItem, aTargetItem, aWindow, flags = 0) {
    if (!aOriginalItem || !aTargetItem) {
      return;
    }
    const { gBrowser, gZenFolders } = aWindow;
    if (flags & SYNC_FLAG_ICON) {
      aTargetItem.zenStaticIcon = aOriginalItem.zenStaticIcon;
      if (gBrowser.isTab(aOriginalItem)) {
        gBrowser.setIcon(
          aTargetItem,
          aOriginalItem.getAttribute("image") || gBrowser.getIcon(aOriginalItem)
        );
      } else if (aOriginalItem.isZenFolder) {
        // Icons are a zen-only feature for tab groups.
        gZenFolders.setFolderUserIcon(aTargetItem, aOriginalItem.iconURL);
      }
    }
    if (flags & SYNC_FLAG_LABEL) {
      if (gBrowser.isTab(aOriginalItem)) {
        aTargetItem._zenChangeLabelFlag = true;
        aTargetItem.zenStaticLabel = aOriginalItem.zenStaticLabel;
        gBrowser._setTabLabel(aTargetItem, aOriginalItem.label);
        delete aTargetItem._zenChangeLabelFlag;
      } else if (gBrowser.isTabGroup(aOriginalItem)) {
        aTargetItem.label = aOriginalItem.label;
      }
    }
    if (flags & SYNC_FLAG_MOVE && !aTargetItem.hasAttribute("zen-empty-tab")) {
      this.#maybeSyncAttributeChange(aOriginalItem, aTargetItem, "zen-workspace-id");
      this.#syncItemPosition(aOriginalItem, aTargetItem, aWindow);
    }
    if (gBrowser.isTab(aTargetItem)) {
      this.#maybeFlushTabState(aTargetItem);
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
    const originalIsEssential = aOriginalItem.hasAttribute("zen-essential");
    const targetIsEssential = aTargetItem.hasAttribute("zen-essential");
    const originalIsPinned = aOriginalItem.pinned;
    const targetIsPinned = aTargetItem.pinned;

    const isGroup = gBrowser.isTabGroup(aOriginalItem);
    const isTab = !isGroup;

    if (aOriginalItem.hasAttribute("zen-glance-tab")) {
      return;
    }

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
    } else {
      aTargetItem.pinned = aOriginalItem.pinned;
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
   * @param {object} options - Additional options for moving the item.
   * @param {boolean} options.isEssential - Indicates if the item is essential.
   * @param {boolean} options.isPinned - Indicates if the item is pinned.
   */
  #moveItemToMatchOriginal(aOriginalItem, aTargetItem, aWindow, { isEssential, isPinned }) {
    const { gBrowser, gZenWorkspaces } = aWindow;
    let originalSibling = aOriginalItem.previousElementSibling;
    if (originalSibling?.classList.contains("space-fake-collapsible-start")) {
      // Skip space fake elements.
      originalSibling = originalSibling.previousElementSibling;
    }
    let isFirstTab = true;
    if (gBrowser.isTabGroup(originalSibling) || gBrowser.isTab(originalSibling)) {
      isFirstTab =
        !originalSibling.hasAttribute("id") || originalSibling.hasAttribute("zen-empty-tab");
    }

    gBrowser.zenHandleTabMove(aTargetItem, () => {
      if (isFirstTab) {
        let container;
        const parentGroup = aOriginalItem.group;
        if (parentGroup?.hasAttribute("id")) {
          container = this.getItemFromWindow(aWindow, parentGroup.getAttribute("id"));
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
          const workspaceId =
            aTargetItem.getAttribute("zen-workspace-id") ||
            aOriginalItem.ownerGlobal.gZenWorkspaces.activeWorkspace;
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
      const relativeTab = this.getItemFromWindow(aWindow, originalSibling.id);
      if (relativeTab) {
        gBrowser.tabContainer.tabDragAndDrop.handle_drop_transition(
          relativeTab,
          aTargetItem,
          [aTargetItem],
          false
        );
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
      this.#syncItemWithOriginal(aItem, this.getItemFromWindow(win, aItem.id), win, flags);
    });
  }

  /**
   * Swaps the browser docshells between two tabs.
   *
   * @param {object} aOurTab - The tab in the current window.
   * @param {object} aOtherTab - The tab in the other window.
   */
  async #swapBrowserDocShellsAsync(aOurTab, aOtherTab) {
    if (!this.#canSwapBrowsers(aOurTab, aOtherTab)) {
      this.log(
        `Cannot swap browsers between tabs ${aOurTab.id} and ${aOtherTab.id} due to process mismatch`
      );
      return;
    }
    if (aOtherTab.closing) {
      this.log(`Cannot swap browsers, other tab ${aOtherTab.id} is closing`);
      return;
    }
    let promise = this.#maybeFlushTabState(aOtherTab);
    await this.#styleSwapedBrowsers(
      aOurTab,
      aOtherTab,
      () => {
        this.#swapBrowserDocShellsInner(aOurTab, aOtherTab);
      },
      promise
    );
  }

  /**
   * Restores the tab progress listener for a given tab.
   *
   * @param {object} aTab - The tab to restore the progress listener for.
   * @param {Function} callback - The callback function to execute while the listener is removed.
   * @param {boolean} onClose - Indicates if the swap is done during a tab close operation.
   */
  #withRestoreTabProgressListener(aTab, callback, onClose = false) {
    const otherTabBrowser = aTab.ownerGlobal.gBrowser;
    const otherBrowser = aTab.linkedBrowser;

    // We aren't closing the other tab so, we also need to swap its tablisteners.
    let filter = otherTabBrowser._tabFilters.get(aTab);
    let tabListener = otherTabBrowser._tabListeners.get(aTab);
    try {
      otherBrowser.webProgress.removeProgressListener(filter);
      filter.removeProgressListener(tabListener);
    } catch {
      /* ignore errors, we might have already removed them */
    }

    try {
      callback();
    } catch (e) {
      console.error(e);
    }

    // Restore the listeners for the swapped in tab.
    if (!onClose && filter) {
      tabListener = new otherTabBrowser.zenTabProgressListener(aTab, otherBrowser, true, false);
      otherTabBrowser._tabListeners.set(aTab, tabListener);

      const notifyAll = Ci.nsIWebProgress.NOTIFY_ALL;
      filter.addProgressListener(tabListener, notifyAll);
      otherBrowser.webProgress.addProgressListener(filter, notifyAll);
    }
  }

  /**
   * Checks if two tabs can have their browsers swapped.
   *
   * @param {object} aOurTab - The tab in the current window.
   * @param {object} aOtherTab - The tab in the other window.
   * @returns {boolean} True if the tabs can be swapped, false otherwise.
   */
  #canSwapBrowsers(aOurTab, aOtherTab) {
    // In this case, the other tab is most likely discarded or pending.
    // We *shouldn't* care about this scenario since the remoteness should be
    // the same anyways.
    if (!aOurTab.linkedBrowser || !aOtherTab.linkedBrowser) {
      return true;
    }
    // Can't swap between chrome and content processes.
    if (aOurTab.linkedBrowser.isRemoteBrowser != aOtherTab.linkedBrowser.isRemoteBrowser) {
      return false;
    }
    return true;
  }

  /**
   * Swaps the browser docshells between two tabs.
   *
   * @param {object} aOurTab - The tab in the current window.
   * @param {object} aOtherTab - The tab in the other window.
   * @param {object} options - Options object.
   * @param {boolean} options.focus - Indicates if the tab should be focused after the swap.
   * @param {boolean} options.onClose - Indicates if the swap is done during a tab close operation.
   * @returns {Promise|null} A promise that resolves when the tab state is flushed, or null if the swap cannot be performed.
   */
  #swapBrowserDocShellsInner(aOurTab, aOtherTab, { focus = true, onClose = false } = {}) {
    // Can't swap between chrome and content processes.
    if (!this.#canSwapBrowsers(aOurTab, aOtherTab)) {
      this.log(
        `Cannot swap browsers between tabs ${aOurTab.id} and ${aOtherTab.id} due to process mismatch`
      );
      return null;
    }
    // See https://github.com/zen-browser/desktop/issues/11851, swapping the browsers
    // don't seem to update the state's cache properly, leading to issues when restoring
    // the session later on.
    let tabStateEntries = this.#getTabEntriesFromCache(aOtherTab);
    const setStateToTab = () => {
      if (!tabStateEntries?.entries.length) {
        this.log(`Error: No tab state entries found for tab ${aOurTab.id} during swap`);
        return;
      }
      lazy.TabStateCache.update(aOurTab.linkedBrowser.permanentKey, {
        history: tabStateEntries,
      });
    };
    // Running `swapBrowsersAndCloseOther` doesn't expect us to use the tab after
    // the operation, so it doesn't really care about cleaning up the other tab.
    // We need to make a new tab progress listener for the other tab after the swap.
    this.#withRestoreTabProgressListener(
      aOtherTab,
      () => {
        setStateToTab();
        this.log(`Swapping docshells between windows for tab ${aOurTab.id}`);
        aOurTab.ownerGlobal.gBrowser.swapBrowsersAndCloseOther(aOurTab, aOtherTab, false);
        // Since we are moving progress listeners around, there's a chance that we
        // trigger a load while making the switch, and since we remove the previous
        // tab's listeners, the other browser window will never get the 'finish load' event
        // and will stay in a 'busy' state forever.
        // To avoid this, we manually check if the other tab is still busy after the swap,
        // and if not, we remove the busy attribute from our tab.
        if (!aOtherTab.hasAttribute("busy")) {
          aOurTab.removeAttribute("busy");
        }
        // Load about:blank if by any chance we loaded the previous tab's URL.
        // TODO: We should maybe start using a singular about:blank preloaded view
        //  to avoid loading a full blank page each time and wasting resources.
        // We do need to do this though instead of just unloading the browser because
        // firefox doesn't expect an unloaded + selected tab, so we need to get
        // around this limitation somehow.
        if (
          !onClose &&
          (aOtherTab.linkedBrowser?.currentURI.spec !== "about:blank" ||
            aOtherTab.hasAttribute("busy"))
        ) {
          this.log(`Loading about:blank in our tab ${aOtherTab.id} before swap`);
          aOtherTab.linkedBrowser.loadURI(Services.io.newURI("about:blank"), {
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            loadFlags: Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY,
          });
        }
      },
      onClose
    );
    const kAttributesToRemove = ["muted", "soundplaying", "sharing", "pictureinpicture", "busy"];
    // swapBrowsersAndCloseOther already takes care of transferring attributes like 'muted',
    // but we need to manually remove some attributes from the other tab.
    for (let attr of kAttributesToRemove) {
      aOtherTab.removeAttribute(attr);
    }
    if (focus) {
      // Recalculate the focus in order to allow the user to continue typing
      // inside the web content area without having to click outside and back in.
      aOurTab.linkedBrowser.blur();
      aOurTab.ownerGlobal.gBrowser._adjustFocusAfterTabSwitch(aOurTab);
      aOurTab.linkedBrowser.docShellIsActive = true;
    }
    // Ensure the tab's state is flushed after the swap. By doing this,
    // we can re-schedule another session store delayed process to fire.
    // It's also important to note that if we don't flush the state here,
    // we would start receiving invalid history changes from the the incorrect
    // browser view that was just swapped out.
    return this.#maybeFlushTabState(aOurTab).finally(() => {
      setStateToTab();
    });
  }

  /**
   * Styles the swapped browsers to ensure proper visibility and layout.
   *
   * @param {object} aOurTab - The tab in the current window.
   * @param {object} aOtherTab - The tab in the other window.
   * @param {Function|undefined} callback - The callback function to execute after styling.
   * @param {Promise|null} promiseToWait - A promise to wait for before executing the callback.
   */
  #styleSwapedBrowsers(aOurTab, aOtherTab, callback = undefined, promiseToWait = null) {
    const ourBrowser = aOurTab.linkedBrowser;
    const otherBrowser = aOtherTab.linkedBrowser;
    return new Promise((resolve) => {
      aOurTab.ownerGlobal.requestAnimationFrame(async () => {
        if (callback) {
          const browserBlob = await aOtherTab.ownerGlobal.PageThumbs.captureToBlob(
            aOtherTab.linkedBrowser,
            {
              fullScale: true,
              fullViewport: true,
            }
          );

          let mySrc = await new Promise((r, re) => {
            const reader = new FileReader();
            reader.readAsDataURL(browserBlob);
            reader.onloadend = function () {
              // result includes identifier 'data:image/png;base64,' plus the base64 data
              r(reader.result);
            };
            reader.onerror = function () {
              re(new Error("Failed to read blob as data URL"));
            };
          });

          this.#createPseudoImageForBrowser(otherBrowser, mySrc);
          otherBrowser.setAttribute("zen-pseudo-hidden", "true");
          await promiseToWait;
          callback();
        }

        this.#maybeRemovePseudoImageForBrowser(ourBrowser);
        ourBrowser.removeAttribute("zen-pseudo-hidden");
        resolve();
      });
    });
  }

  /**
   * Create and insert a new pseudo image for a browser element.
   *
   * @param {object} aBrowser - The browser element to create the pseudo image for.
   * @param {string} aSrc - The source URL of the image.
   */
  #createPseudoImageForBrowser(aBrowser, aSrc) {
    const doc = aBrowser.ownerDocument;
    const img = doc.createElement("img");
    img.className = "zen-pseudo-browser-image";
    img.src = aSrc;
    aBrowser.after(img);
  }

  /**
   * Removes the pseudo image element for a browser if it exists.
   *
   * @param {object} aBrowser - The browser element to remove the pseudo image for.
   */
  #maybeRemovePseudoImageForBrowser(aBrowser) {
    const elements = aBrowser.parentNode?.querySelectorAll(".zen-pseudo-browser-image");
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
   * @returns {object | null} The active tab from other windows if found, otherwise null.
   */
  #getActiveTabFromOtherWindows(aWindow, aTabId, filter = (tab) => tab?._zenContentsVisible) {
    return this.#runOnAllWindows(aWindow, (win) => {
      const tab = this.getItemFromWindow(win, aTabId);
      if (filter(tab)) {
        return tab;
      }
      return undefined;
    });
  }

  /**
   * Moves all active tabs from the specified window to other windows.
   *
   * @param {Window} aWindow - The window to move active tabs from.
   */
  #moveAllActiveTabsToOtherWindowsForClose(aWindow) {
    const mostRecentWindow = this.#browserWindowsList.find((win) => win !== aWindow);
    if (!mostRecentWindow || !aWindow.gZenWorkspaces) {
      return;
    }
    const activeTabsOnClosedWindow = aWindow.gZenWorkspaces.allStoredTabs.filter(
      (tab) => tab._zenContentsVisible
    );
    for (let tab of activeTabsOnClosedWindow) {
      const targetTab = this.getItemFromWindow(mostRecentWindow, tab.id);
      if (targetTab) {
        this.log(`Moving active tab ${tab.id} to most recent window on close`);
        targetTab._zenContentsVisible = true;
        if (!tab.linkedBrowser) {
          continue;
        }
        delete tab._zenContentsVisible;
        this.#swapBrowserDocShellsInner(targetTab, tab, {
          focus: targetTab.selected,
          onClose: true,
        });
        this.#swapedTabsEntriesForWC.set(tab.linkedBrowser.permanentKey, targetTab);
        // We can animate later, whats important is to always stay on the same
        // process and avoid async operations here to avoid the closed window
        // being unloaded before the swap is done.
        this.#styleSwapedBrowsers(targetTab, tab);
      }
    }
  }

  /**
   * Handles tab switch or window focus events to synchronize tab contents visibility.
   *
   * @param {Window} aWindow - The window that triggered the event.
   * @param {object} aPreviousTab - The previously selected tab.
   * @param {boolean} ignoreSameTab - Indicates if the same tab should be ignored.
   */
  async #onTabSwitchOrWindowFocus(aWindow, aPreviousTab = null, ignoreSameTab = false) {
    // On some occasions, such as when closing a window, this
    // function might be called multiple times for the same tab.
    if (aWindow.gBrowser.selectedTab === this.#lastSelectedTab && !ignoreSameTab) {
      return;
    }
    let activeBrowsers = aWindow.gBrowser.selectedBrowsers;
    let activeTabs = activeBrowsers.map((browser) => aWindow.gBrowser.getTabForBrowser(browser));
    // Ignore previous tabs that are still "active". These scenarios could happen for example,
    // when selecting on a split view tab that was already active.
    if (aPreviousTab?._zenContentsVisible && !activeTabs.includes(aPreviousTab)) {
      let tabsToSwap = aPreviousTab.splitView ? aPreviousTab.group.tabs : [aPreviousTab];
      for (const tab of tabsToSwap) {
        const otherTabToShow = this.#getActiveTabFromOtherWindows(aWindow, tab.id, (t) =>
          t?.splitView ? t.group.tabs.some((st) => st.selected) : t?.selected
        );
        if (otherTabToShow) {
          otherTabToShow._zenContentsVisible = true;
          delete tab._zenContentsVisible;
          await this.#swapBrowserDocShellsAsync(otherTabToShow, tab);
        }
      }
    }
    let promises = [];
    for (const selectedTab of activeTabs) {
      if (selectedTab._zenContentsVisible || selectedTab.hasAttribute("zen-empty-tab")) {
        continue;
      }
      const otherSelectedTab = this.#getActiveTabFromOtherWindows(aWindow, selectedTab.id);
      selectedTab._zenContentsVisible = true;
      if (otherSelectedTab) {
        delete otherSelectedTab._zenContentsVisible;
        promises.push(this.#swapBrowserDocShellsAsync(selectedTab, otherSelectedTab));
      }
    }
    await Promise.all(promises);
  }

  /**
   * Delegates generic sync events to synchronize tabs across windows.
   *
   * @param {Event} aEvent - The event to delegate.
   * @param {number} flags - The sync flags indicating what to synchronize.
   */
  #delegateGenericSyncEvent(aEvent, flags = 0) {
    const item = aEvent.target;
    if (lazy.gSyncOnlyPinnedTabs && !item.pinned) {
      return;
    }
    this.#syncItemForAllWindows(item, flags);
  }

  /**
   * Retrieves the tab state entries from the cache for a given tab.
   *
   * @param {object} aTab - The tab to retrieve the state for.
   * @returns {object} The tab state entries.
   */
  #getTabEntriesFromCache(aTab) {
    let cachedState;
    if (aTab.linkedBrowser) {
      cachedState = lazy.TabStateCache.get(aTab.linkedBrowser.permanentKey);
    }
    return cachedState?.history?.entries ? Cu.cloneInto(cachedState.history, {}) : { entries: [] };
  }

  /**
   * Flushes the tab state for a given tab if it has a linked browser.
   *
   * @param {object} aTab - The tab to flush the state for.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  #maybeFlushTabState(aTab) {
    if (!aTab.linkedBrowser) {
      return Promise.resolve();
    }
    return lazy.TabStateFlusher.flush(aTab.linkedBrowser);
  }

  /* Mark: Public API */

  /**
   * Sets the initial pinned state for a tab across all windows.
   *
   * @param {object} aTab - The tab to set the pinned state for.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  setPinnedTabState(aTab) {
    return this.#maybeFlushTabState(aTab).finally(() => {
      this.log(`Setting pinned initial state for tab ${aTab.id}`);
      let { entries, index } = this.#getTabEntriesFromCache(aTab);
      let image = aTab.getAttribute("image") || aTab.ownerGlobal.gBrowser.getIcon(aTab);
      let activeIndex = typeof index === "number" ? index : entries.length;
      // Tab state cache gives us the index starting from 1 instead of 0.
      activeIndex--;
      activeIndex = Math.min(activeIndex, entries.length - 1);
      activeIndex = Math.max(activeIndex, 0);
      const initialState = {
        entry: (entries[activeIndex] || entries[0]) ?? null,
        image,
      };
      this.#runOnAllWindows(null, (win) => {
        const targetTab = this.getItemFromWindow(win, aTab.id);
        if (targetTab) {
          targetTab._zenPinnedInitialState = initialState;
        }
      });
    });
  }

  /**
   * Propagates the workspaces to all windows.
   *
   * @param {Array} aWorkspaces - The workspaces to propagate.
   */
  propagateWorkspacesToAllWindows(aWorkspaces) {
    this.#runOnAllWindows(null, (win) => {
      win.gZenWorkspaces.propagateWorkspaces(aWorkspaces);
    });
  }

  /**
   * Moves all tabs from a window to a synced workspace in another window.
   * If no synced window exists, creates a new one.
   *
   * @param {Window} aWindow - The window to move tabs from.
   * @param {string} aWorkspaceId - The ID of the workspace to move tabs to.
   */
  moveTabsToSyncedWorkspace(aWindow, aWorkspaceId) {
    const tabsToMove = aWindow.gZenWorkspaces.allStoredTabs.filter(
      (tab) => !tab.hasAttribute("zen-empty-tab")
    );
    const selectedTab = aWindow.gBrowser.selectedTab;
    let win = this.#firstSyncedWindow;
    const moveAllTabsToWindow = async (allowSelected = false) => {
      const { gBrowser, gZenWorkspaces } = win;
      win.focus();
      let tabToSelect;
      for (const tab of tabsToMove) {
        if (tab !== selectedTab || allowSelected) {
          const newTab = gBrowser.adoptTab(tab, { tabIndex: Infinity });
          gZenWorkspaces.moveTabToWorkspace(newTab, aWorkspaceId);
          if (!tabToSelect) {
            tabToSelect = newTab;
          }
        }
      }
      aWindow.close();
      if (tabToSelect) {
        gBrowser.selectedTab = tabToSelect;
      }
      await gZenWorkspaces.changeWorkspaceWithID(aWorkspaceId);
      gBrowser.selectedBrowser.focus();
    };
    if (!win) {
      this.log("No synced window found, creating a new one");
      win = aWindow.gBrowser.replaceTabWithWindow(selectedTab, {}, /* zenForceSync = */ true);
      win.gZenWorkspaces.promiseInitialized.then(() => {
        moveAllTabsToWindow();
      });
      return;
    }
    moveAllTabsToWindow(true);
  }

  /**
   * Updates the initial pinned tab image for all windows if not already set.
   *
   * @param {object} aTab - The tab to update the image for.
   */
  #maybeEditAllTabsEntryImage(aTab) {
    if (!aTab?._zenPinnedInitialState || aTab._zenPinnedInitialState.image) {
      return;
    }
    let image = aTab.getAttribute("image") || aTab.ownerGlobal.gBrowser.getIcon(aTab);
    this.#runOnAllWindows(null, (win) => {
      const targetTab = this.getItemFromWindow(win, aTab.id);
      if (targetTab) {
        targetTab._zenPinnedInitialState.image = image;
      }
    });
  }

  /* Mark: Event Handlers */

  on_TabOpen(aEvent, { duringPinning = false } = {}) {
    const tab = aEvent.target;
    const window = tab.ownerGlobal;
    const isUnsyncedWindow = window.gZenWorkspaces.privateWindowOrDisabled;
    if (tab.id && !duringPinning) {
      // This tab was opened as part of a sync operation.
      return;
    }
    tab._zenContentsVisible = true;
    tab.id = this.#newTabSyncId;
    if (lazy.gSyncOnlyPinnedTabs && !tab.pinned) {
      return;
    }
    if (isUnsyncedWindow || !lazy.gWindowSyncEnabled) {
      return;
    }
    this.#runOnAllWindows(window, (win) => {
      const newTab = win.gBrowser.addTrustedTab("about:blank", {
        animate: true,
        createLazyBrowser: true,
        _forZenEmptyTab: tab.hasAttribute("zen-empty-tab"),
      });
      newTab.id = tab.id;
      this.#syncItemWithOriginal(
        tab,
        newTab,
        win,
        SYNC_FLAG_ICON | SYNC_FLAG_LABEL | SYNC_FLAG_MOVE
      );
    });
    if (duringPinning && tab?.splitView) {
      this.on_ZenSplitViewTabsSplit({ target: tab.group });
    }
    this.#maybeFlushTabState(tab);
  }

  on_ZenTabIconChanged(aEvent) {
    if (!aEvent.target?._zenContentsVisible) {
      // No need to sync icon changes for tabs that aren't active in this window.
      return;
    }
    this.#maybeEditAllTabsEntryImage(aEvent.target);
    return this.#delegateGenericSyncEvent(aEvent, SYNC_FLAG_ICON);
  }

  on_ZenTabLabelChanged(aEvent) {
    if (!aEvent.target?._zenContentsVisible) {
      // No need to sync label changes for tabs that aren't active in this window.
      return;
    }
    return this.#delegateGenericSyncEvent(aEvent, SYNC_FLAG_LABEL);
  }

  on_TabMove(aEvent) {
    this.#delegateGenericSyncEvent(aEvent, SYNC_FLAG_MOVE);
    return Promise.resolve();
  }

  on_TabPinned(aEvent) {
    const tab = aEvent.target;
    // There are cases where the pinned state is changed but we don't
    // wan't to override the initial state we stored when the tab was created.
    // For example, when session restore pins a tab again.
    let tabStatePromise;
    if (!tab._zenPinnedInitialState) {
      tabStatePromise = this.setPinnedTabState(tab);
    }
    return Promise.all([
      tabStatePromise,
      this.on_TabMove(aEvent).then(() => {
        if (lazy.gSyncOnlyPinnedTabs) {
          this.on_TabOpen({ target: tab }, { duringPinning: true });
        }
      }),
    ]);
  }

  on_TabUnpinned(aEvent) {
    const tab = aEvent.target;
    this.#runOnAllWindows(null, (win) => {
      const targetTab = this.getItemFromWindow(win, tab.id);
      if (targetTab) {
        delete targetTab._zenPinnedInitialState;
      }
    });
    return this.on_TabMove(aEvent).then(() => {
      if (lazy.gSyncOnlyPinnedTabs) {
        this.on_TabClose({ target: tab });
      }
    });
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
      const targetTab = this.getItemFromWindow(win, tab.id);
      if (targetTab) {
        win.gBrowser.removeTab(targetTab, { animate: true });
      }
    });
  }

  on_focus(aEvent) {
    if (typeof aEvent.target !== "object") {
      return;
    }
    const { ownerGlobal: window } = aEvent.target;
    if (
      !window?.gBrowser ||
      this.#lastFocusedWindow?.deref() === window ||
      window.closing ||
      !window.toolbar.visible
    ) {
      return;
    }
    this.#lastFocusedWindow = new WeakRef(window);
    this.#lastSelectedTab = new WeakRef(window.gBrowser.selectedTab);
    return this.#onTabSwitchOrWindowFocus(window);
  }

  on_TabSelect(aEvent) {
    const tab = aEvent.target;
    if (this.#lastSelectedTab?.deref() === tab) {
      return;
    }
    this.#lastSelectedTab = new WeakRef(tab);
    const previousTab = aEvent.detail.previousTab;
    return this.#onTabSwitchOrWindowFocus(aEvent.target.ownerGlobal, previousTab);
  }

  on_SSWindowClosing(aEvent) {
    const window = aEvent.target.ownerGlobal;
    window._zenClosingWindow = true;
    for (let eventName of EVENTS) {
      window.removeEventListener(eventName, this);
    }
    delete window.gZenWindowSync;
    this.#moveAllActiveTabsToOtherWindowsForClose(window);
  }

  on_WindowCloseAndBrowserFlushed(aBrowsers) {
    if (this.#swapedTabsEntriesForWC.size === 0) {
      return;
    }
    for (let browser of aBrowsers) {
      const tab = this.#swapedTabsEntriesForWC.get(browser.permanentKey);
      if (tab) {
        let win = tab.ownerGlobal;
        this.log(`Finalizing swap for tab ${tab.id} on window close`);
        lazy.TabStateCache.update(
          tab.linkedBrowser.permanentKey,
          lazy.TabStateCache.get(browser.permanentKey)
        );
        let tabData = this.#getTabEntriesFromCache(tab);
        let activePageData = tabData.entries[tabData.index - 1] || null;

        // If the page has a title, set it. When doing a swap and we still didn't
        // flush the tab state, the title might not be correct.
        if (activePageData) {
          win.gBrowser.setInitialTabTitle(tab, activePageData.title, {
            isContentTitle: activePageData.title && activePageData.title != activePageData.url,
          });
        }
      }
    }
    // We don't need to keep these references anymore.
    // and weak maps don't have a clear method, they get cleared automatically.
    this.#swapedTabsEntriesForWC = new WeakMap();
  }

  on_TabGroupCreate(aEvent) {
    const tabGroup = aEvent.target;
    if (tabGroup.id && tabGroup.alreadySynced) {
      // This tab group was opened as part of a sync operation.
      return;
    }
    const window = tabGroup.ownerGlobal;
    const isFolder = tabGroup.isZenFolder;
    const isSplitView = tabGroup.hasAttribute("split-view-group");
    if (isSplitView) {
      return; // Split view groups are synced via ZenSplitViewTabsSplit event.
    }
    // Tab groups already have an ID upon creation.
    this.#runOnAllWindows(window, (win) => {
      // Check if a group with this ID already exists in the target window.
      const existingGroup = this.getItemFromWindow(win, tabGroup.id);
      if (existingGroup) {
        this.log(
          `Attempted to create group ${tabGroup.id} in window ${win}, but it already exists.`
        );
        return; // Do not proceed with creation.
      }

      const newGroup = isFolder
        ? win.gZenFolders.createFolder([], {})
        : win.gBrowser.addTabGroup([]);
      newGroup.id = tabGroup.id;
      newGroup.alreadySynced = true;
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
      const targetGroup = this.getItemFromWindow(win, tabGroup.id);
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

  on_ZenTabRemovedFromSplit(aEvent) {
    const tab = aEvent.target;
    const window = tab.ownerGlobal;
    this.#runOnAllWindows(window, (win) => {
      const targetTab = this.getItemFromWindow(win, tab.id);
      if (targetTab && win.gZenViewSplitter) {
        win.gZenViewSplitter.removeTabFromGroup(targetTab);
      }
    });
  }

  on_ZenSplitViewTabsSplit(aEvent) {
    const tabGroup = aEvent.target;
    const window = tabGroup.ownerGlobal;
    const tabs = tabGroup.tabs;
    this.#runOnAllWindows(window, (win) => {
      const otherWindowTabs = tabs
        .map((tab) => this.getItemFromWindow(win, tab.id))
        .filter(Boolean);
      if (otherWindowTabs.length && win.gZenViewSplitter) {
        const group = win.gZenViewSplitter.splitTabs(otherWindowTabs, undefined, -1, {
          groupFetchId: tabGroup.id,
        });
        if (group) {
          let otherTabGroup = group.tabs[0].group;
          otherTabGroup.id = tabGroup.id;
          this.#syncItemWithOriginal(aEvent.target, otherTabGroup, win, SYNC_FLAG_MOVE);
        }
      }
    });

    return new Promise((resolve) => {
      lazy.setTimeout(() => {
        this.#onTabSwitchOrWindowFocus(window, null, /* ignoreSameTab = */ true).finally(resolve);
      }, 0);
    });
  }
}

// eslint-disable-next-line mozilla/valid-lazy
export const gWindowSyncEnabled = lazy.gWindowSyncEnabled;
// eslint-disable-next-line mozilla/valid-lazy
export const gSyncOnlyPinnedTabs = lazy.gSyncOnlyPinnedTabs;
export const ZenWindowSync = new nsZenWindowSync();
