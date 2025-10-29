// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  cancelIdleCallback,
  clearTimeout,
  requestIdleCallback,
  setTimeout,
} from 'resource://gre/modules/Timer.sys.mjs';

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  nsZenSessionFile: 'resource:///modules/zen/ZenSessionFile.sys.mjs',
  PrivateBrowsingUtils: 'resource://gre/modules/PrivateBrowsingUtils.sys.mjs',
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.sys.mjs',
  TabGroupState: 'resource:///modules/sessionstore/TabGroupState.sys.mjs',
  SessionStore: 'resource:///modules/sessionstore/SessionStore.sys.mjs',
});

const TAB_CUSTOM_VALUES = new WeakMap();
const LAZY_COLLECT_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const OBSERVING = ['sessionstore-state-write-complete', 'browser-window-before-show'];

class nsZenSessionManager {
  #file;

  constructor() {
    this.#file = new lazy.nsZenSessionFile();
  }

  // Called from SessionComponents.manifest on app-startup
  init() {
    this.#initObservers();
  }

  async readFile() {
    await this.#file.read();
  }

  onFileRead(initialState) {
    for (const winData of initialState.windows || []) {
      this.restoreWindowData(winData);
    }
  }

  #initObservers() {
    for (let topic of OBSERVING) {
      Services.obs.addObserver(this, topic);
    }
  }

  get #sidebar() {
    return this.#file.sidebar;
  }

  set #sidebar(data) {
    this.#file.sidebar = data;
  }

  observe(aSubject, aTopic) {
    switch (aTopic) {
      case 'sessionstore-state-write-complete': {
        this.#saveState(true);
        break;
      }
      case 'browser-window-before-show': // catch new windows
        this.#onBeforeBrowserWindowShown(aSubject);
        break;
      default:
        break;
    }
  }

  /** Handles the browser-window-before-show observer notification. */
  #onBeforeBrowserWindowShown(aWindow) {
    // TODO: Initialize new window
  }

  get #topMostWindow() {
    return lazy.BrowserWindowTracker.getTopWindow();
  }

  /**
   * Saves the current session state. Collects data and writes to disk.
   *
   * @param forceUpdateAllWindows (optional)
   *        Forces us to recollect data for all windows and will bypass and
   *        update the corresponding caches.
   */
  async #saveState(forceUpdateAllWindows = false) {
    if (lazy.PrivateBrowsingUtils.permanentPrivateBrowsing) {
      // Don't save (or even collect) anything in permanent private
      // browsing mode
      return Promise.resolve();
    }
    // Collect an initial snapshot of window data before we do the flush.
    const window = this.#topMostWindow;
    // We don't have any normal windows or no windows at all
    if (!window) {
      return;
    }
    this.#collectWindowData(this.#topMostWindow, forceUpdateAllWindows);
    this.#file.store();
  }

  /**
   * Collects session data for a given window.
   *
   * @param window
   *        The window to collect data for.
   * @param forceUpdate
   *        Forces us to recollect data and will bypass and update the
   *        corresponding caches.
   * @param zIndex
   *        The z-index of the window.
   */
  #collectWindowData(window, forceUpdate = false, zIndex = 0) {
    let sidebarData = this.#sidebar;
    if (!sidebarData || forceUpdate) {
      sidebarData = {};
    }

    // If it hasn't changed, don't update.
    if (
      !forceUpdate &&
      sidebarData.lastCollected &&
      Date.now() - sidebarData.lastCollected < LAZY_COLLECT_THRESHOLD
    ) {
      return;
    }
    sidebarData.lastCollected = Date.now();
    this.#collectTabsData(window, sidebarData);
    this.#sidebar = sidebarData;
  }

  /**
   * Collects session data for all tabs in a given window.
   *
   * @param aWindow
   *        The window to collect tab data for.
   * @param winData
   *        The window data object to populate.
   */
  #collectTabsData(aWindow, sidebarData) {
    const winData = lazy.SessionStore.getWindowState(aWindow).windows[0];
    if (!winData) return;
    sidebarData.tabs = winData.tabs;
    sidebarData.folders = winData.folders;
    sidebarData.splitViewData = winData.splitViewData;
    sidebarData.groups = winData.groups;
  }

  restoreWindowData(aWindowData) {
    const sidebar = this.#file.sidebar;
    if (!sidebar) {
      return;
    }
    aWindowData.tabs = sidebar.tabs || [];
    aWindowData.splitViewData = sidebar.splitViewData;
    aWindowData.folders = sidebar.folders;
    aWindowData.groups = sidebar.groups;
  }

  getNewWindowData(aWindows) {
    return { windows: [Cu.cloneInto(aWindows[Object.keys(aWindows)[0]], {})] };
  }
}

export const ZenSessionStore = new nsZenSessionManager();
