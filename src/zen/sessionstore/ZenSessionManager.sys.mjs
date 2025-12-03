// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  nsZenSessionFile: 'resource:///modules/zen/ZenSessionFile.sys.mjs',
  PrivateBrowsingUtils: 'resource://gre/modules/PrivateBrowsingUtils.sys.mjs',
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.sys.mjs',
  TabGroupState: 'resource:///modules/sessionstore/TabGroupState.sys.mjs',
  SessionStore: 'resource:///modules/sessionstore/SessionStore.sys.mjs',
  SessionSaver: 'resource:///modules/sessionstore/SessionSaver.sys.mjs',
});

const OBSERVING = ['browser-window-before-show'];

class nsZenSessionManager {
  #file;

  constructor() {
    this.#file = new lazy.nsZenSessionFile();
  }

  // Called from SessionComponents.manifest on app-startup
  init() {
    for (let topic of OBSERVING) {
      Services.obs.addObserver(this, topic);
    }
  }

  uninit() {
    for (let topic of OBSERVING) {
      Services.obs.removeObserver(this, topic);
    }
  }

  async readFile() {
    await this.#file.read();
  }

  onFileRead(initialState) {
    for (const winData of initialState.windows || []) {
      this.restoreWindowData(winData);
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
    void aWindow;
  }

  /**
   * Saves the current session state. Collects data and writes to disk.
   *
   * @param state
   *        The current session state.
   */
  saveState(state) {
    if (lazy.PrivateBrowsingUtils.permanentPrivateBrowsing) {
      // Don't save (or even collect) anything in permanent private
      // browsing mode
      return;
    }
    this.#collectWindowData(state);
    this.#file.store();
  }

  /**
   * Collects session data for a given window.
   *
   * @param state
   *        The current session state.
   */
  #collectWindowData(state) {
    let sidebarData = this.#sidebar;
    if (!sidebarData) {
      sidebarData = {};
    }

    sidebarData.lastCollected = Date.now();
    this.#collectTabsData(sidebarData, state);
    this.#sidebar = sidebarData;
  }

  /**
   * Collects session data for all tabs in a given window.
   *
   * @param sidebarData
   *        The sidebar data object to populate.
   * @param state
   *        The current session state.
   */
  #collectTabsData(sidebarData, state) {
    if (!state?.windows?.length) return;

    const tabIdRelationMap = new Map();
    for (const window of state.windows) {
      // Only accept the tabs with `_zenIsActiveTab` set to true from
      // every window. We do this to avoid collecting tabs with invalid
      // state when multiple windows are open. Note that if we a tab without
      // this flag set in any other window, we just add it anyway.
      for (const tabData of window.tabs) {
        if (!tabIdRelationMap.has(tabData.zenSyncId) || tabData._zenIsActiveTab) {
          tabIdRelationMap.set(tabData.zenSyncId, tabData);
        }
      }
    }

    sidebarData.tabs = Array.from(tabIdRelationMap.values());

    sidebarData.folders = state.windows[0].folders;
    sidebarData.splitViewData = state.windows[0].splitViewData;
    sidebarData.groups = state.windows[0].groups;
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

  restoreNewWindow(aWindow, SessionStoreInternal) {
    if (aWindow.gZenWorkspaces?.privateWindowOrDisabled) {
      return;
    }
    lazy.SessionSaver.run().then(() => {
      const state = lazy.SessionStore.getCurrentState(true);
      const windows = state.windows || {};
      let newWindow = Cu.cloneInto(windows[0], {});
      delete newWindow.selected;
      const newState = { windows: [newWindow] };
      aWindow._zenRestorePromise = new Promise((resolve) => {
        SessionStoreInternal.restoreWindows(aWindow, newState, {});
        resolve();
      });
    });
  }
}

export const ZenSessionStore = new nsZenSessionManager();
