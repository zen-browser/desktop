/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-disable consistent-return */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  TabStateFlusher: "resource:///modules/sessionstore/TabStateFlusher.sys.mjs",
  // eslint-disable-next-line mozilla/valid-lazy
  ZenSessionStore: "resource:///modules/zen/ZenSessionManager.sys.mjs",
  TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(lazy, "gWindowSyncEnabled", "zen.window-sync.enabled");
XPCOMUtils.defineLazyPreferenceGetter(lazy, "gShouldLog", "zen.window-sync.log", true);

const OBSERVING = ["browser-window-before-show"];
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
    // There are 2 possibilities to know if we are trying to open
    // a new *unsynced* window:
    // 1. We are passing `zen-unsynced` in the window arguments.
    // 2. We are trying to open a link in a new window where other synced
    //   windows already exist
    // Note, we force syncing if the window is private or workspaces is disabled
    // to avoid confusing the old private window behavior.
    let forcedSync = !aWindow.gZenWorkspaces?.privateWindowOrDisabled;
    let hasUnsyncedArg = false;
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
          !![...this.#browserWindows].length))
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
    const originalSibling = aOriginalItem.previousElementSibling;
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
    this.#maybeFlushTabState(aOtherTab);
    await this.#styleSwapedBrowsers(aOurTab, aOtherTab, () => {
      this.#swapBrowserDocSheellsInner(aOurTab, aOtherTab);
    });
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
   * Swaps the browser docshells between two tabs.
   *
   * @param {object} aOurTab - The tab in the current window.
   * @param {object} aOtherTab - The tab in the other window.
   * @param {object} options - Options object.
   * @param {boolean} options.focus - Indicates if the tab should be focused after the swap.
   * @param {boolean} options.onClose - Indicates if the swap is done during a tab close operation.
   */
  #swapBrowserDocSheellsInner(aOurTab, aOtherTab, { focus = true, onClose = false } = {}) {
    // Can't swap between chrome and content processes.
    if (aOurTab.linkedBrowser.isRemoteBrowser != aOtherTab.linkedBrowser.isRemoteBrowser) {
      return false;
    }
    // See https://github.com/zen-browser/desktop/issues/11851, swapping the browsers
    // don't seem to update the state's cache properly, leading to issues when restoring
    // the session later on.
    let tabStateEntries = this.#getTabEntriesFromCache(aOtherTab);
    // Running `swapBrowsersAndCloseOther` doesn't expect us to use the tab after
    // the operation, so it doesn't really care about cleaning up the other tab.
    // We need to make a new tab progress listener for the other tab after the swap.
    this.#withRestoreTabProgressListener(
      aOtherTab,
      () => {
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
    }
    // Ensure the tab's state is flushed after the swap. By doing this,
    // we can re-schedule another session store delayed process to fire.
    // It's also important to note that if we don't flush the state here,
    // we would start receiving invalid history changes from the the incorrect
    // browser view that was just swapped out.
    this.#maybeFlushTabState(aOurTab).finally(() => {
      if (!tabStateEntries?.length) {
        this.log(`Error: No tab state entries found for tab ${aOtherTab.id} during swap`);
        return;
      }
      lazy.TabStateCache.update(aOurTab.linkedBrowser.permanentKey, {
        entries: tabStateEntries,
      });
    });
    return true;
  }

  /**
   * Styles the swapped browsers to ensure proper visibility and layout.
   *
   * @param {object} aOurTab - The tab in the current window.
   * @param {object} aOtherTab - The tab in the other window.
   * @param {Function|undefined} callback - The callback function to execute after styling.
   */
  async #styleSwapedBrowsers(aOurTab, aOtherTab, callback = undefined) {
    const ourBrowser = aOurTab.linkedBrowser;
    const otherBrowser = aOtherTab.linkedBrowser;

    if (callback) {
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
          reject(new Error("Failed to read blob as data URL"));
        };
      });

      const [img, loadPromise] = this.#createPseudoImageForBrowser(otherBrowser, mySrc);
      // Run a reflow to ensure the image is rendered before hiding the browser.
      void img.getBoundingClientRect();
      await loadPromise;
      otherBrowser.setAttribute("zen-pseudo-hidden", "true");
      callback();
    }

    this.#maybeRemovePseudoImageForBrowser(ourBrowser);
    ourBrowser.removeAttribute("zen-pseudo-hidden");
  }

  /**
   * Create and insert a new pseudo image for a browser element.
   *
   * @param {object} aBrowser - The browser element to create the pseudo image for.
   * @param {string} aSrc - The source URL of the image.
   * @returns {object} The created pseudo image element.
   */
  #createPseudoImageForBrowser(aBrowser, aSrc) {
    const doc = aBrowser.ownerDocument;
    const img = doc.createElement("img");
    img.className = "zen-pseudo-browser-image";
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
  #moveAllActiveTabsToOtherWindows(aWindow) {
    const mostRecentWindow = [...this.#browserWindows].find((win) => win !== aWindow);
    if (!mostRecentWindow || !aWindow.gZenWorkspaces) {
      return;
    }
    lazy.TabStateFlusher.flushWindow(aWindow);
    const activeTabsOnClosedWindow = aWindow.gZenWorkspaces.allStoredTabs.filter(
      (tab) => tab._zenContentsVisible
    );
    for (let tab of activeTabsOnClosedWindow) {
      const targetTab = this.getItemFromWindow(mostRecentWindow, tab.id);
      if (targetTab) {
        this.log(`Moving active tab ${tab.id} to most recent window on close`);
        this.#swapBrowserDocSheellsInner(targetTab, tab, {
          focus: targetTab.selected,
          onClose: true,
        });
        targetTab._zenContentsVisible = true;
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
      const otherTabToShow = this.#getActiveTabFromOtherWindows(
        aWindow,
        aPreviousTab.id,
        (tab) => tab?.selected
      );
      if (otherTabToShow) {
        otherTabToShow._zenContentsVisible = true;
        delete aPreviousTab._zenContentsVisible;
        await this.#swapBrowserDocShellsAsync(otherTabToShow, aPreviousTab);
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
    this.#syncItemForAllWindows(item, flags);
  }

  /**
   * Retrieves the tab state entries from the cache for a given tab.
   *
   * @param {object} aTab - The tab to retrieve the state for.
   * @returns {Array} The tab state entries.
   */
  #getTabEntriesFromCache(aTab) {
    if (!aTab.linkedBrowser) {
      return [];
    }
    let cachedState = lazy.TabStateCache.get(aTab.linkedBrowser.permanentKey) || { entries: [] };
    return cachedState.entries || [];
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
      const entries = this.#getTabEntriesFromCache(aTab);
      let activeIndex = "index" in entries ? entries.index : entries.entries.length - 1;
      activeIndex = Math.min(activeIndex, entries.entries.length - 1);
      activeIndex = Math.max(activeIndex, 0);
      const initialState = {
        entry: entries.entries[activeIndex],
        image: entries.image,
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
    let win = [...this.#browserWindows][0];
    const moveAllTabsToWindow = async (allowSelected = false) => {
      const { gBrowser, gZenWorkspaces } = win;
      win.focus();
      let success = true;
      for (const tab of tabsToMove) {
        if (tab !== selectedTab || allowSelected) {
          const newTab = gBrowser.adoptTab(tab, { tabIndex: Infinity });
          if (!newTab) {
            // The adoption failed. Restore "fadein" and don't increase the index.
            tab.setAttribute("fadein", "true");
            success = false;
            continue;
          }
          gZenWorkspaces.moveTabToWorkspace(newTab, aWorkspaceId);
        }
      }
      if (success) {
        aWindow.close();
        await gZenWorkspaces.changeWorkspaceWithID(aWorkspaceId);
        gBrowser.selectedBrowser.focus();
      }
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

  /* Mark: Event Handlers */

  on_TabOpen(aEvent) {
    const tab = aEvent.target;
    const window = tab.ownerGlobal;
    const isUnsyncedWindow = window.document.documentElement.hasAttribute("zen-unsynced-window");

    if (tab.id) {
      // This tab was opened as part of a sync operation.
      return;
    }
    tab._zenContentsVisible = true;
    tab.id = this.#newTabSyncId;
    if (isUnsyncedWindow) {
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
    this.#maybeFlushTabState(tab);
  }

  on_ZenTabIconChanged(aEvent) {
    if (!aEvent.target?._zenContentsVisible) {
      // No need to sync icon changes for tabs that aren't active in this window.
      return;
    }
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
    return this.#delegateGenericSyncEvent(aEvent, SYNC_FLAG_MOVE);
  }

  on_TabPinned(aEvent) {
    const tab = aEvent.target;
    // There are cases where the pinned state is changed but we don't
    // wan't to override the initial state we stored when the tab was created.
    // For example, when session restore pins a tab again.
    if (!tab._zenPinnedInitialState) {
      this.setPinnedTabState(tab);
    }
    return this.on_TabMove(aEvent);
  }

  on_TabUnpinned(aEvent) {
    const tab = aEvent.target;
    this.#runOnAllWindows(null, (win) => {
      const targetTab = this.getItemFromWindow(win, tab.id);
      if (targetTab) {
        delete targetTab._zenPinnedInitialState;
      }
    });
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
      const targetTab = this.getItemFromWindow(win, tab.id);
      if (targetTab) {
        win.gBrowser.removeTab(targetTab, { animate: true });
      }
    });
  }

  on_focus(aEvent) {
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
    this.#moveAllActiveTabsToOtherWindows(window);
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
        const group = win.gZenViewSplitter.splitTabs(otherWindowTabs, "grid", -1);
        if (group) {
          let otherTabGroup = group.tabs[0].group;
          otherTabGroup.id = tabGroup.id;
          this.#syncItemWithOriginal(aEvent.target, otherTabGroup, win, SYNC_FLAG_MOVE);
        }
      }
    });

    return this.#onTabSwitchOrWindowFocus(window, null, /* ignoreSameTab = */ true);
  }
}

// eslint-disable-next-line mozilla/valid-lazy
export const gWindowSyncEnabled = lazy.gWindowSyncEnabled;
export const ZenWindowSync = new nsZenWindowSync();
