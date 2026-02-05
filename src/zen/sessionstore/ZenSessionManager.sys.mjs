/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  gWindowSyncEnabled: "resource:///modules/zen/ZenWindowSync.sys.mjs",
  gSyncOnlyPinnedTabs: "resource:///modules/zen/ZenWindowSync.sys.mjs",
  DeferredTask: "resource://gre/modules/DeferredTask.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(lazy, "gShouldLog", "zen.session-store.log", true);
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gMaxSessionBackups",
  "zen.session-store.max-backups",
  20
);
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gBackupHourSpan",
  "zen.session-store.backup-hour-span",
  3
);

const SHOULD_BACKUP_FILE = Services.prefs.getBoolPref("zen.session-store.backup-file", true);
const FILE_NAME = "zen-sessions.jsonlz4";

// 'browser.startup.page' preference value to resume the previous session.
const BROWSER_STARTUP_RESUME_SESSION = 3;

// The amount of time (in milliseconds) to wait for our backup regeneration
// debouncer to kick off a regeneration.
const REGENERATION_DEBOUNCE_RATE_MS = 10 * 60 * 1000; // 10 minutes

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
   *
   * @type {JSONFile}
   */
  #file = null;
  /**
   * The sidebar object holding tabs, groups, folders and split view data.
   *
   * @type {nsZenSidebarObject}
   */
  #sidebarObject = new nsZenSidebarObject();
  /**
   * A deferred task to create backups of the session file.
   */
  #deferredBackupTask = null;

  init() {
    this.log("Initializing session manager");
    let backupFile = null;
    if (SHOULD_BACKUP_FILE) {
      backupFile = PathUtils.join(this.#backupFolderPath, FILE_NAME);
    }
    this.#file = new JSONFile({
      path: this.#storeFilePath,
      compression: "lz4",
      backupFile,
    });
    this.log("Session file path:", this.#file.path);
    this.#deferredBackupTask = new lazy.DeferredTask(async () => {
      await this.#createBackupsIfNeeded();
    }, REGENERATION_DEBOUNCE_RATE_MS);
  }

  log(...args) {
    if (lazy.gShouldLog) {
      // eslint-disable-next-line no-console
      console.log("ZenSessionManager:", ...args);
    }
  }

  get #storeFilePath() {
    let profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile).path;
    return PathUtils.join(profileDir, FILE_NAME);
  }

  get #backupFolderPath() {
    let profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile).path;
    return PathUtils.join(profileDir, "zen-sessions-backup");
  }

  /**
   * Gets the spaces data from the Places database for migration.
   * This is only called once during the first run after updating
   * to a version that uses the new session manager.
   */
  async #getDataFromDBForMigration() {
    try {
      const { PlacesUtils } = ChromeUtils.importESModule(
        "resource://gre/modules/PlacesUtils.sys.mjs"
      );
      const db = await PlacesUtils.promiseDBConnection();
      let data = {};
      let rows = await db.execute("SELECT * FROM zen_workspaces ORDER BY created_at ASC");
      data.spaces = rows.map((row) => ({
        uuid: row.getResultByName("uuid"),
        name: row.getResultByName("name"),
        icon: row.getResultByName("icon"),
        containerTabId: row.getResultByName("container_id") ?? 0,
        position: row.getResultByName("position"),
        theme: row.getResultByName("theme_type")
          ? {
              type: row.getResultByName("theme_type"),
              gradientColors: JSON.parse(row.getResultByName("theme_colors")),
              opacity: row.getResultByName("theme_opacity"),
              rotation: row.getResultByName("theme_rotation"),
              texture: row.getResultByName("theme_texture"),
            }
          : null,
      }));
      rows = await db.execute("SELECT * FROM zen_pins ORDER BY position ASC");
      data.pins = rows.map((row) => ({
        uuid: row.getResultByName("uuid"),
        title: row.getResultByName("title"),
        url: row.getResultByName("url"),
        containerTabId: row.getResultByName("container_id"),
        workspaceUuid: row.getResultByName("workspace_uuid"),
        position: row.getResultByName("position"),
        isEssential: Boolean(row.getResultByName("is_essential")),
        isGroup: Boolean(row.getResultByName("is_group")),
        parentUuid: row.getResultByName("folder_parent_uuid"),
        editedTitle: Boolean(row.getResultByName("edited_title")),
        folderIcon: row.getResultByName("folder_icon"),
        isFolderCollapsed: Boolean(row.getResultByName("is_folder_collapsed")),
      }));
      try {
        data.recoveryData = await IOUtils.readJSON(
          PathUtils.join(
            Services.dirsvc.get("ProfD", Ci.nsIFile).path,
            "sessionstore-backups",
            "recovery.jsonlz4"
          ),
          { decompress: true }
        );
        this.log("Recovered recovery data from sessionstore-backups");
      } catch {
        /* ignore errors reading recovery data */
      }
      if (!data.recoverYData) {
        try {
          data.recoveryData = await IOUtils.readJSON(
            PathUtils.join(
              Services.dirsvc.get("ProfD", Ci.nsIFile).path,
              "sessionstore-backups",
              "recovery.jsonlz4"
            ),
            { decompress: true }
          );
          this.log("Recovered recovery data from sessionstore-backups");
        } catch {
          /* ignore errors reading recovery data */
        }
      }
      this._migrationData = data;
    } catch {
      /* ignore errors during migration */
    }
  }

  /**
   * Reads the session file and populates the sidebar object.
   * This should be only called once at startup.
   *
   * @see SessionFileInternal.read
   */
  async readFile() {
    let fileExists = await IOUtils.exists(this.#storeFilePath);
    if (!fileExists) {
      this.log("Session file does not exist, running migration", this.#storeFilePath);
      this._shouldRunMigration = true;
    }
    this.init();
    try {
      this.log("Reading Zen session file from disk");
      let promises = [];
      promises.push(this.#file.load());
      if (this._shouldRunMigration) {
        promises.push(this.#getDataFromDBForMigration());
      }
      await Promise.all(promises);
    } catch (e) {
      console.error("ZenSessionManager: Failed to read session file", e);
    }
    this.#sidebar = this.#file.data || {};
    if (!this.#sidebar.spaces?.length && !this._shouldRunMigration) {
      this.log("No spaces data found in session file, running migration", this.#sidebar);
      // If we have no spaces data, we should run migration
      // to restore them from the database. Note we also do a
      // check if we already planned to run migration for optimization.
      this._shouldRunMigration = true;
      await this.#getDataFromDBForMigration();
    }
  }

  get #shouldRestoreOnlyPinned() {
    return (
      Services.prefs.getIntPref("browser.startup.page", 1) !== BROWSER_STARTUP_RESUME_SESSION ||
      lazy.PrivateBrowsingUtils.permanentPrivateBrowsing
    );
  }

  /**
   * Called when the session file is read. Restores the sidebar data
   * into all windows.
   *
   * @param {object} initialState
   *        The initial session state read from the session file.
   */
  onFileRead(initialState) {
    // For the first time after migration, we restore the tabs
    // That where going to be restored by SessionStore. The sidebar
    // object will always be empty after migration because we haven't
    // gotten the opportunity to save the session yet.
    if (this._shouldRunMigration) {
      initialState = this.#runStateMigration(initialState);
    }
    if (!lazy.gWindowSyncEnabled) {
      if (initialState?.windows?.length && this.#shouldRestoreOnlyPinned) {
        this.log("Window sync disabled, restoring only pinned tabs");
        for (let i = 0; i < initialState.windows.length; i++) {
          let winData = initialState.windows[i];
          winData.tabs = (winData.tabs || []).filter((tab) => tab.pinned);
        }
      }
      return initialState;
    }
    // If there are no windows, we create an empty one. By default,
    // firefox would create simply a new empty window, but we want
    // to make sure that the sidebar object is properly initialized.
    // This would happen on first run after having a single private window
    // open when quitting the app, for example.
    if (!initialState?.windows?.length) {
      this.log("No windows found in initial state, creating an empty one");
      initialState ||= {};
      initialState.windows = [
        {
          tabs: [],
        },
      ];
    }
    // When we don't have browser.startup.page set to resume session,
    // we only want to restore the pinned tabs into the new windows.
    if (this.#shouldRestoreOnlyPinned && this.#sidebar?.tabs) {
      this.log("Restoring only pinned tabs into windows");
      const sidebar = this.#sidebar;
      sidebar.tabs = (sidebar.tabs || []).filter((tab) => tab.pinned);
      this.#sidebar = sidebar;
    }
    // Restore all windows with the same sidebar object, this will
    // guarantee that all tabs, groups, folders and split view data
    // are properly synced across all windows.
    const allowRestoreUnsynced = Services.prefs.getBoolPref(
      "zen.session-store.restore-unsynced-windows",
      true
    );
    if (!this._shouldRunMigration) {
      this.log(`Restoring Zen session data into ${initialState.windows?.length || 0} windows`);
      for (let i = 0; i < initialState.windows.length; i++) {
        let winData = initialState.windows[i];
        if (winData.isZenUnsynced) {
          if (!allowRestoreUnsynced) {
            // We don't wan't to restore any unsynced windows with the sidebar data.
            this.log("Skipping restore of unsynced window");
            delete initialState.windows[i];
          }
          continue;
        }
        this.#restoreWindowData(winData);
      }
    } else if (initialState) {
      this.log("Saving windata state after migration");
      this.saveState(Cu.cloneInto(initialState, {}));
    }
    delete this._shouldRunMigration;
    return initialState;
  }

  get #sidebar() {
    return this.#sidebarObject.data;
  }

  set #sidebar(data) {
    this.#sidebarObject.data = data;
  }

  /**
   * Runs the state migration to restore spaces and pinned tabs
   * from the Places database into the initial session state.
   *
   * @param {object} initialState
   *        The initial session state read from the session file.
   */
  // eslint-disable-next-line complexity
  #runStateMigration(initialState) {
    this.log(
      "Restoring tabs from Places DB after migration",
      initialState,
      initialState?.lastSessionState,
      this._migrationData
    );
    if (!initialState?.windows?.length && this._migrationData?.recoveryData) {
      this.log("Using recovery data for migration");
      initialState = this._migrationData.recoveryData;
    }
    delete this._migrationData?.recoveryData;
    // Restore spaces into the sidebar object if we don't
    // have any yet.
    if (!this.#sidebar.spaces?.length) {
      this.#sidebar = {
        ...this.#sidebar,
        spaces: this._migrationData?.spaces || [],
      };
    }
    if (
      !initialState?.windows?.length &&
      (initialState?.lastSessionState || initialState?.deferredInitialState)
    ) {
      initialState = { ...(initialState.lastSessionState || initialState.deferredInitialState) };
    }
    // There might be cases where there are no windows in the
    // initial state, for example if the user had 'restore previous
    // session' disabled before migration. In that case, we try
    // to restore the last closed normal window.
    if (!initialState?.windows?.length) {
      let normalClosedWindow = initialState?._closedWindows?.find(
        (win) => !win.isPopup && !win.isTaskbarTab && !win.isPrivate
      );
      if (normalClosedWindow) {
        initialState.windows = [Cu.cloneInto(normalClosedWindow, {})];
        this.log("Restoring tabs from last closed normal window");
      }
    }
    if (!initialState?.windows?.length) {
      initialState ||= {};
      initialState.windows = [
        {
          tabs: [],
        },
      ];
    }
    for (const winData of initialState?.windows || []) {
      winData.spaces = this._migrationData?.spaces || [];
      if (winData.tabs) {
        for (const tabData of winData.tabs) {
          let storeId = tabData.zenSyncId || tabData.zenPinnedId;
          const pinData = this._migrationData?.pins?.find((pin) => pin.uuid === storeId);
          // We need to migrate the static label from the pin data as this information
          // was not stored in the session file before.
          if (pinData) {
            tabData.zenStaticLabel = pinData.editedTitle ? pinData.title : undefined;
          }
        }
      }
    }
    return initialState;
  }

  /**
   * Determines if a given window data object is saveable.
   *
   * @param {object} aWinData - The window data object to check.
   * @returns {boolean} True if the window is saveable, false otherwise.
   */
  #isWindowSaveable(aWinData) {
    return !aWinData.isPopup && !aWinData.isTaskbarTab && !aWinData.isZenUnsynced;
  }

  /**
   * Saves the current session state. Collects data and writes to disk.
   *
   * @param {object} state The current session state.
   */
  saveState(state) {
    let windows = state?.windows || [];
    windows = windows.filter((win) => this.#isWindowSaveable(win));
    if (!windows.length) {
      // Don't save (or even collect) anything in permanent private
      // browsing mode. We also don't want to save if there are no windows.
      return;
    }
    this.#collectWindowData(windows);
    // This would save the data to disk asynchronously or when
    // quitting the app.
    this.#file.data = this.#sidebar;
    this.#file.saveSoon();
    this.#debounceRegeneration();
    this.log(`Saving Zen session data with ${this.#sidebar.tabs?.length || 0} tabs`);
  }

  /**
   * Called when the last known backup should be deleted and a new one
   * created. This uses the #deferredBackupTask to debounce clusters of
   * events that might cause such a regeneration to occur.
   */
  #debounceRegeneration() {
    this.#deferredBackupTask.arm();
  }

  /**
   * Creates backups of the session file if needed. We only keep
   * a limited number of backups to avoid using too much disk space.
   * The way we are doing this is by replacing the file for today's
   * date if it already exists, otherwise we create a new one.
   * We then delete the oldest backups if we exceed the maximum
   * number of backups allowed.
   *
   * We run the next backup creation after a delay or when idling,
   * to avoid blocking the main thread during session saves.
   */
  async #createBackupsIfNeeded() {
    if (!SHOULD_BACKUP_FILE) {
      return;
    }
    try {
      const today = new Date();
      const backupFolder = this.#backupFolderPath;
      await IOUtils.makeDirectory(backupFolder, {
        ignoreExisting: true,
        createAncestors: true,
      });
      // Since backups from days ago are not that useful compared to more
      // recent ones, we would ideally want to keep more backups for recent days
      // and less for older ones. To achieve this, we create backups only
      // every few hours (configurable via gBackupHourSpan), so that we
      // can have multiple backups per day for recent days, but only
      // one backup per day for older days.
      let dateToUse = today.toISOString().slice(0, 10); // YYYY-MM-DD
      const hourSpan = Math.min(Math.max(1, lazy.gBackupHourSpan), 24);
      const backupHour = Math.floor(today.getHours() / hourSpan) * hourSpan;
      dateToUse += `-${String(backupHour).padStart(2, "0")}`;
      const todayFileName = `zen-sessions-${dateToUse}.jsonlz4`;
      const todayFilePath = PathUtils.join(backupFolder, todayFileName);
      const sessionFilePath = this.#file.path;
      this.log(`Backing up session file to ${todayFileName}`);
      await IOUtils.copy(sessionFilePath, todayFilePath, { noOverwrite: false });
      // Now we need to check if we have exceeded the maximum
      // number of backups allowed, and delete the oldest ones
      // if needed.
      let files = await IOUtils.getChildren(backupFolder);
      files = files.filter((file) => file.startsWith("zen-sessions-")).sort();
      for (let i = 0; i < files.length - lazy.gMaxSessionBackups; i++) {
        const fileToDelete = PathUtils.join(backupFolder, files[i].name);
        this.log(`Deleting old backup file ${files[i].name}`);
        await IOUtils.remove(fileToDelete);
      }
    } catch (e) {
      console.error("ZenSessionManager: Failed to create session file backups", e);
    }
  }

  /**
   * Saves the session data for a closed window if it meets the criteria.
   * See SessionStoreInternal.maybeSaveClosedWindow for more details.
   *
   * @param {object} aWinData - The window data object to save.
   * @param {boolean} isLastWindow - Whether this is the last saveable window.
   */
  maybeSaveClosedWindow(aWinData, isLastWindow) {
    // We only want to save the *last* normal window that is closed.
    // If its not the last window, we can still update the sidebar object
    // based on other open windows.
    if (aWinData.isPopup || aWinData.isTaskbarTab || aWinData.isZenUnsynced || !isLastWindow) {
      return;
    }
    this.log("Saving closed window session data into Zen session store");
    this.saveState({ windows: [aWinData] });
  }

  /**
   * Collects session data for a given window.
   *
   * @param {object} aStateWindows The array of window state objects.
   */
  #collectWindowData(aStateWindows) {
    // We only want to collect the sidebar data once from
    // a single window, as all windows share the same
    // sidebar data.
    let sidebarData = this.#sidebar;
    if (!sidebarData) {
      sidebarData = {};
    }

    sidebarData.lastCollected = Date.now();
    this.#collectTabsData(sidebarData, aStateWindows);
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
   * @param {object} sidebarData The sidebar data object to populate.
   * @param {object} aStateWindows The array of window state objects.
   */
  #collectTabsData(sidebarData, aStateWindows) {
    const tabIdRelationMap = new Map();
    for (const window of aStateWindows) {
      // Only accept the tabs with `_zenIsActiveTab` set to true from
      // every window. We do this to avoid collecting tabs with invalid
      // state when multiple windows are open. Note that if we a tab without
      // this flag set in any other window, we just add it anyway.
      for (const tabData of window.tabs || []) {
        if (!tabIdRelationMap.has(tabData.zenSyncId) || tabData._zenIsActiveTab) {
          tabIdRelationMap.set(tabData.zenSyncId, tabData);
        }
      }
    }

    sidebarData.tabs = this.#filterUnusedTabs(Array.from(tabIdRelationMap.values()));

    let firstWindow = aStateWindows[0];
    sidebarData.folders = firstWindow.folders;
    sidebarData.splitViewData = firstWindow.splitViewData;
    sidebarData.groups = firstWindow.groups;
    sidebarData.spaces = firstWindow.spaces;
  }

  /**
   * Restores the sidebar data into a given window data object.
   * We do this in order to make sure all new window objects
   * have the same sidebar data.
   *
   * @param {object} aWindowData The window data object to restore into.
   */
  #restoreWindowData(aWindowData) {
    const sidebar = this.#sidebar;
    if (!sidebar) {
      return;
    }
    // If we should only sync the pinned tabs, we should only edit the unpinned
    // tabs in the window data and keep the pinned tabs from the window data,
    // as they should be the same as the ones in the sidebar.
    if (lazy.gSyncOnlyPinnedTabs) {
      let pinnedTabs = (sidebar.tabs || []).filter((tab) => tab.pinned);
      let unpinedWindowTabs = (aWindowData.tabs || []).filter((tab) => !tab.pinned);
      aWindowData.tabs = [...pinnedTabs, ...unpinedWindowTabs];
    } else {
      aWindowData.tabs = sidebar.tabs || [];
    }

    aWindowData.splitViewData = sidebar.splitViewData;
    aWindowData.folders = sidebar.folders;
    aWindowData.groups = sidebar.groups;
    aWindowData.spaces = sidebar.spaces;
  }

  /**
   * Restores a new window with Zen session data. This should be called
   * not at startup, but when a new window is opened by the user.
   *
   * @param {Window} aWindow
   *        The window to restore.
   * @param {object} SessionStoreInternal
   *        The SessionStore module instance.
   * @param {boolean} fromClosedWindow
   *        Whether this new window is being restored from a closed window.
   */
  restoreNewWindow(aWindow, SessionStoreInternal, fromClosedWindow = false) {
    if (aWindow.gZenWorkspaces?.privateWindowOrDisabled) {
      return;
    }
    this.log("Restoring new window with Zen session data");
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
      this.log("Restoring sidebar data into new window");
      this.#restoreWindowData(newWindow);
    }
    newWindow.tabs = this.#filterUnusedTabs(newWindow.tabs || []);
    if (!lazy.gWindowSyncEnabled || lazy.gSyncOnlyPinnedTabs) {
      // Don't bring over any unpinned tabs if window sync is disabled or if syncing only pinned tabs.
      newWindow.tabs = newWindow.tabs.filter((tab) => tab.pinned);
    }

    // These are window-specific from the previous window state that
    // we don't want to restore into the new window. Otherwise, new
    // windows would appear overlapping the previous one, or with
    // the same size and position, which should be decided by the
    // window manager.
    if (!fromClosedWindow) {
      delete newWindow.selected;
      delete newWindow.screenX;
      delete newWindow.screenY;
      delete newWindow.width;
      delete newWindow.height;
      delete newWindow.sizemode;
      delete newWindow.sizemodeBeforeMinimized;
      delete newWindow.zIndex;
      delete newWindow.workspaceID;
    }

    const newState = { windows: [newWindow] };
    this.log(`Cloning window with ${newWindow.tabs.length} tabs`);

    SessionStoreInternal._deferredInitialState = newState;
    SessionStoreInternal.initializeWindow(aWindow, newState);
  }

  /**
   * Called when a new empty session is created. For example,
   * when creating a new profile or when the user installed it for
   * the first time.
   *
   * @param {Window} aWindow
   */
  onNewEmptySession(aWindow) {
    this.log("Restoring empty session with Zen session data");
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
