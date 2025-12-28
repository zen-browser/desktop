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

// 'browser.startup.page' preference value to resume the previous session.
const BROWSER_STARTUP_RESUME_SESSION = 3;

/**
 * Class representing the sidebar object stored in the session file.
 * This object holds all the data related to tabs, groups, folders
 * and split view state.
 */
class nsZenSidebarObject {
  #sidebar = {};

  get data() {
    return Cu.cloneInto(this.#sidebar, {});
  }

  set data(data) {
    this.#sidebar = data;
  }
}

export class nsZenSessionManager {
  /**
   * The JSON file instance used to read/write session data.
   * @type {JSONFile}
   */
  #file = null;
  /**
   * The sidebar object holding tabs, groups, folders and split view data.
   * @type {nsZenSidebarObject}
   */
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

    lazy.SessionStore.promiseAllWindowsRestored.then(() => {
      delete this._migrationData;
    });
  }

  log(...args) {
    if (lazy.gShouldLog) {
      console.info('ZenSessionManager:', ...args);
    }
  }

  /**
   * Gets the spaces data from the Places database for migration.
   * This is only called once during the first run after updating
   * to a version that uses the new session manager.
   */
  async #getDataFromDBForMigration() {
    try {
      const { PlacesUtils } = ChromeUtils.importESModule(
        'resource://gre/modules/PlacesUtils.sys.mjs'
      );
      const db = await PlacesUtils.promiseDBConnection();
      let data = {};
      let rows = await db.execute('SELECT * FROM zen_workspaces ORDER BY created_at ASC');
      data.spaces = rows.map((row) => ({
        uuid: row.getResultByName('uuid'),
        name: row.getResultByName('name'),
        icon: row.getResultByName('icon'),
        containerTabId: row.getResultByName('container_id') ?? 0,
        position: row.getResultByName('position'),
        theme: row.getResultByName('theme_type')
          ? {
              type: row.getResultByName('theme_type'),
              gradientColors: JSON.parse(row.getResultByName('theme_colors')),
              opacity: row.getResultByName('theme_opacity'),
              rotation: row.getResultByName('theme_rotation'),
              texture: row.getResultByName('theme_texture'),
            }
          : null,
      }));
      rows = await db.execute('SELECT * FROM zen_pins ORDER BY position ASC');
      data.pins = rows.map((row) => ({
        uuid: row.getResultByName('uuid'),
        title: row.getResultByName('title'),
        url: row.getResultByName('url'),
        containerTabId: row.getResultByName('container_id'),
        workspaceUuid: row.getResultByName('workspace_uuid'),
        position: row.getResultByName('position'),
        isEssential: Boolean(row.getResultByName('is_essential')),
        isGroup: Boolean(row.getResultByName('is_group')),
        parentUuid: row.getResultByName('folder_parent_uuid'),
        editedTitle: Boolean(row.getResultByName('edited_title')),
        folderIcon: row.getResultByName('folder_icon'),
        isFolderCollapsed: Boolean(row.getResultByName('is_folder_collapsed')),
      }));
      this._migrationData = data;
    } catch {
      /* ignore errors during migration */
    }
  }

  /**
   * Reads the session file and populates the sidebar object.
   * This should be only called once at startup.
   * @see SessionFileInternal.read
   */
  async readFile() {
    try {
      let promises = [];
      promises.push(this.#file.load());
      if (!Services.prefs.getBoolPref(MIGRATION_PREF, false)) {
        promises.push(this.#getDataFromDBForMigration());
      }
      await Promise.all(promises);
    } catch (e) {
      console.error('ZenSessionManager: Failed to read session file', e);
    }
    this.#sidebar = this.#file.data || {};
  }

  /**
   * Called when the session file is read. Restores the sidebar data
   * into all windows.
   *
   * @param initialState
   *        The initial session state read from the session file.
   */
  onFileRead(initialState) {
    // For the first time after migration, we restore the tabs
    // That where going to be restored by SessionStore. The sidebar
    // object will always be empty after migration because we haven't
    // gotten the opportunity to save the session yet.
    if (!Services.prefs.getBoolPref(MIGRATION_PREF, false)) {
      Services.prefs.setBoolPref(MIGRATION_PREF, true);
      const pins = this._migrationData?.pins || [];
      const applyTabsToObject = (obj) => {
        // Lets add pins that don't exist yet in the sidebar object.
        obj.tabs = obj.tabs || [];
        obj.folders = obj.folders || [];
        for (const pin of pins) {
          let isGroup = pin.isGroup;
          let object = {
            pinned: true,
            ...(isGroup
              ? {
                  workspaceId: pin.workspaceUuid,
                  userIcon: pin.folderIcon,
                  name: pin.title,
                  parentId: pin.parentUuid,
                  collapsed: pin.isFolderCollapsed,
                  id: pin.uuid,
                  emptyTabIds: [],
                }
              : {
                  zenSyncId: pin.uuid,
                  groupId: pin.parentUuid,
                  entries: [{ url: pin.url, title: pin.title }],
                  zenStaticLabel: pin.editedTitle,
                  zenEssential: pin.isEssential,
                  userContextId: pin.containerTabId || 0,
                  zenWorkspace: pin.workspaceUuid,
                  title: pin.title,
                }),
          };
          let items = isGroup ? obj.folders : obj.tabs;
          let index = items.findIndex(
            (tab) =>
              tab.zenSyncId === pin.uuid || tab.zenPinnedId === pin.uuid || tab.id === pin.uuid
          );
          if (index === -1) {
            // Add to the start of the tabs array to keep the order
            items.unshift(object);
          } else {
            // Update existing tab data
            items[index] = { ...object, ...items[index] };
          }
        }
      };
      this.#sidebar = {
        ...this.#sidebar,
        spaces: this._migrationData?.spaces || [],
      };
      applyTabsToObject(this.#sidebar);
      for (const winData of initialState?.windows || []) {
        winData.spaces = this._migrationData?.spaces || [];
        applyTabsToObject(winData);
      }
      return;
    }
    // If there's no initial state, nothing to restore. This would
    // happen if the file is empty or corrupted.
    if (!initialState) {
      this.log('No initial state to restore!');
      return;
    }
    // If there are no windows, we create an empty one. By default,
    // firefox would create simply a new empty window, but we want
    // to make sure that the sidebar object is properly initialized.
    // This would happen on first run after having a single private window
    // open when quitting the app, for example.
    if (!initialState.windows?.length) {
      initialState.windows = [{}];
    }
    // When we don't have browser.startup.page set to resume session,
    // we only want to restore the pinned tabs into the new windows.
    if (
      Services.prefs.getIntPref('browser.startup.page', 1) !== BROWSER_STARTUP_RESUME_SESSION &&
      this.#sidebar?.tabs
    ) {
      this.log('Restoring only pinned tabs into windows');
      const sidebar = this.#sidebar;
      sidebar.tabs = (sidebar.tabs || []).filter((tab) => tab.pinned);
      this.#sidebar = sidebar;
    }
    // Restore all windows with the same sidebar object, this will
    // guarantee that all tabs, groups, folders and split view data
    // are properly synced across all windows.
    this.log(`Restoring Zen session data into ${initialState.windows?.length || 0} windows`);
    for (const winData of initialState.windows) {
      this.#restoreWindowData(winData);
    }
  }

  get #sidebar() {
    return this.#sidebarObject.data;
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
    // This would save the data to disk asynchronously or when
    // quitting the app.
    this.#file.data = this.#sidebar;
    this.#file.saveSoon();
    this.log(`Saving Zen session data with ${this.#sidebar.tabs?.length || 0} tabs`);
  }

  /**
   * Saves the session data for a closed window if it meets the criteria.
   * See SessionStoreInternal.maybeSaveClosedWindow for more details.
   *
   * @param aWinData - The window data object to save.
   * @param isLastWindow - Whether this is the last saveable window.
   */
  maybeSaveClosedWindow(aWinData, isLastWindow) {
    // We only want to save the *last* normal window that is closed.
    // If its not the last window, we can still update the sidebar object
    // based on other open windows.
    if (aWinData.isPopup || aWinData.isTaskbarTab || aWinData.isZenUnsynced || !isLastWindow) {
      return;
    }
    this.log('Saving closed window session data into Zen session store');
    this.saveState({ windows: [aWinData] });
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
    sidebarData.spaces = state.windows[0].spaces;
  }

  /**
   * Restores the sidebar data into a given window data object.
   * We do this in order to make sure all new window objects
   * have the same sidebar data.
   *
   * @param aWindowData The window data object to restore into.
   */
  #restoreWindowData(aWindowData) {
    const sidebar = this.#sidebar;
    if (!sidebar) {
      return;
    }
    aWindowData.tabs = sidebar.tabs || [];
    aWindowData.splitViewData = sidebar.splitViewData;
    aWindowData.folders = sidebar.folders;
    aWindowData.groups = sidebar.groups;
    aWindowData.spaces = sidebar.spaces;
  }

  /**
   * Restores a new window with Zen session data. This should be called
   * not at startup, but when a new window is opened by the user.
   *
   * @param aWindow
   *        The window to restore.
   * @param SessionStoreInternal
   *        The SessionStore module instance.
   * @param resolvePromise
   *        The promise resolver to call when done. We use a promise
   *        here because out workspace manager always waits for SessionStore
   *        to restore all the windows before initializing, but when opening
   *        a new window, that promise is always resolved, meaning it may run
   *        into a race condition if we try to restore the window synchronously
   *        here.
   */
  restoreNewWindow(aWindow, SessionStoreInternal) {
    if (aWindow.gZenWorkspaces?.privateWindowOrDisabled) {
      return;
    }
    this.log('Restoring new window with Zen session data');
    const state = lazy.SessionStore.getCurrentState(true);
    const windows = (state.windows || []).filter(
      (win) => !win.isPrivate && !win.isPopup && !win.isTaskbarTab && !win.isZenUnsynced
    );
    let windowToClone = windows[0] || {};
    let newWindow = Cu.cloneInto(windowToClone, {});
    if (windows.length < 2) {
      // We only want to restore the sidebar object if we found
      // only one normal window to clone from (which is the one
      // we are opening).
      this.log('Restoring sidebar data into new window');
      this.#restoreWindowData(newWindow);
    }
    newWindow.tabs = this.#filterUnusedTabs(newWindow.tabs || []);

    // These are window-specific from the previous window state that
    // we don't want to restore into the new window. Otherwise, new
    // windows would appear overlapping the previous one, or with
    // the same size and position, which should be decided by the
    // window manager.
    delete newWindow.selected;
    delete newWindow.screenX;
    delete newWindow.screenY;
    delete newWindow.width;
    delete newWindow.height;
    delete newWindow.sizemode;
    delete newWindow.sizemodeBeforeMinimized;
    delete newWindow.zIndex;

    const newState = { windows: [newWindow] };
    this.log(`Cloning window with ${newWindow.tabs.length} tabs`);

    SessionStoreInternal._deferredInitialState = newState;
    SessionStoreInternal.initializeWindow(aWindow, newState);
  }

  /**
   * Called when a new empty session is created. For example,
   * when creating a new profile or when the user installed it for
   * the first time.
   * @param {*} aWindow
   * @returns
   */
  onNewEmptySession(aWindow) {
    aWindow.gZenWorkspaces.restoreWorkspacesFromSessionStore({
      spaces: this.#sidebar.spaces || [],
    });
  }

  /**
   * Gets the cloned spaces data from the sidebar object.
   * This is used during migration to restore spaces into
   * the initial session state.
   *
   * @returns {Array} The cloned spaces data.
   */
  getClonedSpaces() {
    const sidebar = this.#sidebar;
    if (!sidebar || !sidebar.spaces) {
      return [];
    }
    return Cu.cloneInto(sidebar.spaces, {});
  }
}

export const ZenSessionStore = new nsZenSessionManager();
