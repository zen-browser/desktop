/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from 'resource://gre/modules/JSONFile.sys.mjs';
import { XPCOMUtils } from 'resource://gre/modules/XPCOMUtils.sys.mjs';

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PrivateBrowsingUtils: 'resource://gre/modules/PrivateBrowsingUtils.sys.mjs',
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.sys.mjs',
  TabGroupState: 'resource:///modules/sessionstore/TabGroupState.sys.mjs',
  SessionStore: 'resource:///modules/sessionstore/SessionStore.sys.mjs',
  SessionSaver: 'resource:///modules/sessionstore/SessionSaver.sys.mjs',
  setTimeout: 'resource://gre/modules/Timer.sys.mjs',
});

XPCOMUtils.defineLazyPreferenceGetter(lazy, 'gShouldLog', 'zen.session-store.log', true);

// Note that changing this hidden pref will make the previous session file
// unused, causing a new session file to be created on next write.
const SHOULD_COMPRESS_FILE = Services.prefs.getBoolPref('zen.session-store.compress-file', true);
const SHOULD_BACKUP_FILE = Services.prefs.getBoolPref('zen.session-store.backup-file', true);

const FILE_NAME = SHOULD_COMPRESS_FILE ? 'zen-sessions.jsonlz4' : 'zen-sessions.json';
const MIGRATION_PREF = 'zen.ui.migration.session-manager-restore';

/**
 * Class representing the sidebar object stored in the session file.
 * This object holds all the data related to tabs, groups, folders
 * and split view state.
 */
class nsZenSidebarObject {
  #sidebar = {};

  get data() {
    return { ...this.#sidebar };
  }

  set data(data) {
    console.log(data);
    this.#sidebar = data;
  }
}

export class nsZenSessionManager {
  #file;
  #sidebarObject = new nsZenSidebarObject();

  // Called from SessionComponents.manifest on app-startup
  init() {
    let profileDir = Services.dirsvc.get('ProfD', Ci.nsIFile).path;
    let backupFile = null;
    if (SHOULD_BACKUP_FILE) {
      backupFile = PathUtils.join(profileDir, 'zen-sessions-backup', FILE_NAME);
    }
    let filePath = PathUtils.join(profileDir, FILE_NAME);
    this.#file = new JSONFile({
      path: filePath,
      compression: SHOULD_COMPRESS_FILE ? 'lz4' : undefined,
      backupFile,
    });
  }

  log(...args) {
    if (lazy.gShouldLog) {
      console.info('ZenSessionManager:', ...args);
    }
  }

  async readFile() {
    console.log(await this.#file.load());
    try {
      this.#sidebar = (await this.#file.load()) || {};
    } catch (e) {
      console.error('ZenSessionManager: Failed to read session file', e);
      this.#sidebar = {};
    }
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
    this.log(`Restoring Zen session data into ${initialState.windows?.length || 0} windows`);
    for (const winData of initialState.windows || []) {
      this.restoreWindowData(winData);
    }
  }

  get #sidebar() {
    return { ...this.#sidebarObject.data };
  }

  set #sidebar(data) {
    this.#sidebarObject.data = data;
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
    // This would save the data to disk asynchronously.
    this.#file.data = this.#sidebar;
    this.#file.saveSoon();
    this.log(`Saving Zen session data with ${this.#sidebar.tabs?.length || 0} tabs`);
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
    const sidebar = this.#sidebar;
    console.log(sidebar);
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
    this.log('Restoring new window with Zen session data');
    aWindow._zenPromiseNewWindowRestored = new Promise((resolve) => {
      lazy.setTimeout(() => {
        const state = lazy.SessionStore.getCurrentState(true);
        const windows = (state.windows || []).find(
          (win) => !win.isPrivate && !win.isPopup && !win.isTaskbarTab && !win.isZenUnsynced
        );
        let windowToClone = windows[0];
        let newWindow = Cu.cloneInto(windowToClone, {});
        if (windows.length < 2) {
          // We only want to restore the sidebar object if we found
          // only one normal window to clone from (which is the one
          // we are opening).
          this.log('Restoring sidebar data into new window');
          this.restoreWindowData(newWindow);
        }
        newWindow.tabs = this.#filterUnusedTabs(newWindow.tabs || []);
        delete newWindow.selected;
        const newState = { windows: [newWindow] };
        this.log(`Cloning window with ${newWindow.tabs.length} tabs`);
        SessionStoreInternal.restoreWindows(aWindow, newState, {
          firstWindow: true,
        });
        resolve();
      });
    });
  }
}

export const ZenSessionStore = new nsZenSessionManager();
