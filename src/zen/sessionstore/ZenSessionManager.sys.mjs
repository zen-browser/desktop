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
  setTimeout: 'resource://gre/modules/Timer.sys.mjs',
});

const MIGRATION_PREF = 'zen.ui.migration.session-manager-restore';
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
    // For the first time after migration, we restore the tabs
    // That where going to be restored by SessionStore. The sidebar
    // object will always be empty after migration because we haven't
    // gotten the opportunity to save the session yet.
    if (!Services.prefs.getBoolPref(MIGRATION_PREF, false)) {
      Services.prefs.setBoolPref(MIGRATION_PREF, true);
      return;
    }
    // Restore all windows with the same sidebar object, this will
    // guarantee that all tabs, groups, folders and split view data
    // are properly synced across all windows.
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
    if (lazy.PrivateBrowsingUtils.permanentPrivateBrowsing || !state?.windows?.length) {
      // Don't save (or even collect) anything in permanent private
      // browsing mode. We also don't want to save if there are no windows.
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

  #filterUnusedTabs(tabs) {
    return tabs.filter((tab) => {
      // We need to ignore empty tabs with no group association
      // as they are not useful to restore.
      return !(tab.zenIsEmpty && !tab.groupId);
    });
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

    sidebarData.tabs = this.#filterUnusedTabs(Array.from(tabIdRelationMap.values()));

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
    aWindow._zenPromiseNewWindowRestored = new Promise((resolve) => {
      lazy.SessionSaver.run().then(() => {
        lazy.setTimeout(() => {
          const state = lazy.SessionStore.getCurrentState(true);
          const windows = state.windows || [];
          let windowToClone =
            windows.find(
              (win) => !win.isPrivate && !win.isPopup && !win.isTaskbarTab && !win.isZenUnsynced
            ) || {};
          let newWindow = Cu.cloneInto(windowToClone, {});
          this.restoreWindowData(newWindow);
          newWindow.tabs = this.#filterUnusedTabs(newWindow.tabs || []);
          delete newWindow.selected;
          const newState = { windows: [newWindow] };
          SessionStoreInternal.restoreWindows(aWindow, newState, {
            firstWindow: true,
          });
          resolve();
        });
      });
    });
  }
}

export const ZenSessionStore = new nsZenSessionManager();
