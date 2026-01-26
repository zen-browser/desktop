/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  Store,
  SyncEngine,
  Tracker,
} from "resource://services-sync/engines.sys.mjs";
import { CryptoWrapper } from "resource://services-sync/record.sys.mjs";
import { Svc, Utils } from "resource://services-sync/util.sys.mjs";
import { SCORE_INCREMENT_XLARGE } from "resource://services-sync/constants.sys.mjs";
import { CommonUtils } from "resource://services-common/utils.sys.mjs";

const lazy = {};
ChromeUtils.defineLazyGetter(lazy, "WORKSPACES_GUID", () =>
  CommonUtils.encodeBase64URL("zen-workspaces-v1")
);

// ============== LOGGING ==============

function log(level, ...args) {
  const prefix = `[ZenWorkspacesSync]`;
  const timestamp = new Date().toISOString();
  const message = `${prefix} [${timestamp}] ${args.join(" ")}`;

  switch (level) {
    case "error":
      console.error(message);
      break;
    case "warn":
      console.warn(message);
      break;
    case "debug":
      console.debug(message);
      break;
    default:
      console.log(message);
  }
}

// ============== RECORD ==============

export function WorkspacesRec(collection, id) {
  CryptoWrapper.call(this, collection, id);
}
WorkspacesRec.prototype = { _logName: "Sync.Record.Workspaces" };
Object.setPrototypeOf(WorkspacesRec.prototype, CryptoWrapper.prototype);
Utils.deferGetSet(WorkspacesRec, "cleartext", ["value"]);

// ============== ENGINE ==============

export function WorkspacesEngine(service) {
  SyncEngine.call(this, "Workspaces", service);
  log("info", "WorkspacesEngine initialized");
}

WorkspacesEngine.prototype = {
  _storeObj: WorkspacesStore,
  _trackerObj: WorkspacesTracker,
  _recordObj: WorkspacesRec,
  version: 2,
  syncPriority: 6,
  allowSkippedRecord: false,

  async getChangedIDs() {
    let changedIDs = {};
    if (this._tracker.modified) {
      changedIDs[lazy.WORKSPACES_GUID] = 0;
      log("info", "getChangedIDs: Local changes detected, will sync");
    } else {
      log("debug", "getChangedIDs: No local changes");
    }
    return changedIDs;
  },

  async _syncStartup() {
    log("info", "=== SYNC STARTED ===");
    log("info", `Engine version: ${this.version}, Priority: ${this.syncPriority}`);
    try {
      const result = await SyncEngine.prototype._syncStartup.call(this);
      log("info", "_syncStartup completed successfully");
      return result;
    } catch (e) {
      log("error", `_syncStartup FAILED: ${e.message}`);
      log("error", `Stack: ${e.stack}`);
      throw e;
    }
  },

  async _processIncoming() {
    log("info", "_processIncoming called");
    try {
      const result = await SyncEngine.prototype._processIncoming.call(this);
      log("info", "_processIncoming completed");
      return result;
    } catch (e) {
      log("error", `_processIncoming FAILED: ${e.message}`);
      log("error", `Stack: ${e.stack}`);
      throw e;
    }
  },

  async _uploadOutgoing() {
    log("info", "_uploadOutgoing called");
    try {
      const result = await SyncEngine.prototype._uploadOutgoing.call(this);
      log("info", "_uploadOutgoing completed");
      return result;
    } catch (e) {
      log("error", `_uploadOutgoing FAILED: ${e.message}`);
      log("error", `Stack: ${e.stack}`);
      throw e;
    }
  },

  async _syncFinish() {
    log("info", "=== SYNC FINISHED ===");
    try {
      const result = await SyncEngine.prototype._syncFinish.call(this);
      log("info", "_syncFinish completed");
      return result;
    } catch (e) {
      log("error", `_syncFinish FAILED: ${e.message}`);
      throw e;
    }
  },

  async _wipeClient() {
    log("warn", "Wipe client requested - clearing local workspace sync data");
    await SyncEngine.prototype._wipeClient.call(this);
    this.justWiped = true;
  },

  async _reconcile(item) {
    if (this.justWiped) {
      log("info", "Reconcile: Accepting all incoming data (post-wipe)");
      this.justWiped = false;
      return true;
    }
    log("debug", "Reconcile: Processing incoming record");
    return SyncEngine.prototype._reconcile.call(this, item);
  },

  async trackRemainingChanges() {
    if (this._modified.count() > 0) {
      log("info", `trackRemainingChanges: ${this._modified.count()} changes remaining, marking modified`);
      this._tracker.modified = true;
    }
  },
};
Object.setPrototypeOf(WorkspacesEngine.prototype, SyncEngine.prototype);

// ============== STORE ==============

function WorkspacesStore(name, engine) {
  Store.call(this, name, engine);
  log("info", "WorkspacesStore initialized");
}

WorkspacesStore.prototype = {
  _getWorkspacesData() {
    log("debug", "Collecting local workspace data...");
    try {
      const { ZenSessionStore } = ChromeUtils.importESModule(
        "resource:///modules/zen/ZenSessionManager.sys.mjs"
      );
      const workspaces = ZenSessionStore.getClonedSpaces() || [];
      log("info", `Found ${workspaces.length} local workspaces`);

      const folders = this._getFoldersData();
      log("info", `Found ${folders.length} folders`);

      const pinnedTabs = this._getPinnedTabsData();
      log("info", `Found ${pinnedTabs.length} pinned/essential tabs`);

      return {
        workspaces,
        folders,
        pinnedTabs,
        lastModified: Date.now(),
      };
    } catch (e) {
      log("error", "Failed to get workspaces data:", e.message);
      return { workspaces: [], folders: [], pinnedTabs: [], lastModified: 0 };
    }
  },

  _getFoldersData() {
    const folders = [];
    const win = Services.wm.getMostRecentWindow("navigator:browser");
    if (!win?.gZenFolders) return folders;

    // Get all zen-folder elements (excluding split-view-groups)
    const folderElements = win.document.querySelectorAll("zen-folder:not([split-view-group])");
    let position = 0;

    for (const folder of folderElements) {
      // Get parent folder by checking DOM hierarchy
      const parentFolder = folder.parentElement?.closest("zen-folder");
      const workspaceId = folder.getAttribute("zen-workspace-id");

      folders.push({
        id: folder.id,
        name: folder.label,
        workspaceId,
        parentId: parentFolder?.id || null,
        collapsed: folder.collapsed,
        isEssential: folder.hasAttribute("zen-essential"),
        userIcon: folder.querySelector(".tab-group-folder-icon use")?.getAttribute("href") || null,
        position: position++,
      });
      log("debug", `Collected folder: "${folder.label}" (${folder.id}), parent: ${parentFolder?.id || "none"}`);
    }

    return folders;
  },

  _getPinnedTabsData() {
    // Only sync pinned and essential tabs, NOT regular open tabs
    const tabs = [];
    let position = 0;
    let totalPinned = 0;
    let totalEssential = 0;

    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (!win.gBrowser || !win.gZenWorkspaces) continue;

      // Get ALL tabs from ALL workspaces by iterating over each zen-workspace element
      // gBrowser.tabContainer.allTabs only returns tabs from the ACTIVE workspace!
      const workspaceElements = win.document.querySelectorAll("zen-workspace");
      const allTabs = [];

      // Helper to recursively collect tabs from containers (including inside folders)
      const collectTabsFromContainer = (container, containerName) => {
        if (!container) {
          log("debug", `Container "${containerName}" is null`);
          return;
        }
        log("debug", `Scanning container "${containerName}" with ${container.children.length} children`);
        for (const child of container.children) {
          const tagName = child.tagName?.toLowerCase() || "unknown";
          if (win.gBrowser.isTab(child)) {
            allTabs.push(child);
            log("debug", `Found tab in "${containerName}": ${child.linkedBrowser?.currentURI?.spec || "(no url)"}`);
          } else if (child.isZenFolder) {
            // Use folder.tabs property to get tabs (inherited from MozTabbrowserTabGroup)
            const folderTabs = child.tabs || [];
            log("debug", `Found folder "${child.label}" with ${folderTabs.length} tabs`);
            for (const tab of folderTabs) {
              allTabs.push(tab);
              log("debug", `Found tab in folder "${child.label}": ${tab.linkedBrowser?.currentURI?.spec || "(no url)"}`);
            }
            // Also check for nested folders
            for (const folderChild of container.children) {
              if (folderChild.isZenFolder && folderChild !== child) {
                // This will be handled in the next iteration
              }
            }
          } else {
            log("debug", `Skipping non-tab element in "${containerName}": <${tagName}>`);
          }
        }
      };

      for (const workspace of workspaceElements) {
        log("debug", `Processing workspace: ${workspace.id}`);
        // Get pinned tabs from workspace's pinned container (including inside folders)
        collectTabsFromContainer(workspace.pinnedTabsContainer, `${workspace.id}/pinned`);
        // Get normal tabs from workspace's tabs container
        collectTabsFromContainer(workspace.tabsContainer, `${workspace.id}/normal`);
      }

      // Also get essential tabs from the essentials container
      const essentialsContainers = win.document.querySelectorAll(".zen-essentials-container");
      for (const container of essentialsContainers) {
        collectTabsFromContainer(container);
      }

      log("debug", `Scanning ${workspaceElements.length} workspaces with ${allTabs.length} total tabs`);

      for (const tab of allTabs) {
        // Skip non-pinned/non-essential tabs
        const isEssential = tab.hasAttribute("zen-essential");
        // Tabs in folders are pinned but tab.pinned might be false - check if in a zen-folder
        const isInFolder = tab.group?.isZenFolder;
        const isPinned = tab.pinned || isInFolder;
        const tabUrl = tab.linkedBrowser?.currentURI?.spec || "(no url)";
        const wsId = tab.getAttribute("zen-workspace-id");

        if (isPinned) totalPinned++;
        if (isEssential) totalEssential++;

        log("debug", `Tab check: url="${tabUrl}", wsId=${wsId}, pinned=${tab.pinned}, inFolder=${isInFolder}, essential=${isEssential}`);

        if (!isEssential && !isPinned) {
          continue;
        }

        // Skip empty placeholder tabs in folders
        if (tab.hasAttribute("zen-empty-tab")) {
          log("debug", `Skipping empty tab placeholder`);
          continue;
        }

        const workspaceId = tab.getAttribute("zen-workspace-id");
        const url = tab.linkedBrowser?.currentURI?.spec;

        log("debug", `Examining tab: pinned=${isPinned}, essential=${isEssential}, url="${url}", workspaceId=${workspaceId}`);

        if (!url) {
          log("debug", `Skipping tab with no URL (pinned: ${isPinned}, essential: ${isEssential})`);
          continue;
        }

        if (url.startsWith("about:")) {
          log("debug", `Skipping about: URL: ${url} (pinned: ${isPinned}, essential: ${isEssential})`);
          continue;
        }

        // Get folder ID if tab is inside a folder
        const folder = tab.group;
        const folderId = folder?.isZenFolder ? folder.id : null;

        // Get custom tab label if set (zenStaticLabel is the Zen Browser property for custom names)
        const label = tab.zenStaticLabel || null;

        tabs.push({
          url,
          workspaceId,
          folderId,
          isEssential,
          isPinned: tab.pinned || isInFolder,
          label,
          position: position++,
        });
        log("debug", `Collected tab: "${url}" (label: "${label}") in folder: ${folderId || "none"}`);
      }
    }

    log("debug", `Tab scan summary: ${totalPinned} pinned, ${totalEssential} essential, ${tabs.length} collected`);
    return tabs;
  },

  async _applyWorkspacesData(data) {
    log("info", "=== APPLYING INCOMING SYNC DATA ===");
    log("info", `Incoming data: ${data?.workspaces?.length || 0} workspaces, ${data?.folders?.length || 0} folders, ${data?.pinnedTabs?.length || 0} pinned tabs`);

    try {
      const win = Services.wm.getMostRecentWindow("navigator:browser");
      if (!win?.gZenWorkspaces || win.closed) {
        log("warn", "No valid browser window found, cannot apply sync data");
        return;
      }

      // 1. Apply workspaces first
      const local = this._getWorkspacesData();
      log("info", `Merging: ${local.workspaces.length} local + ${data.workspaces?.length || 0} remote workspaces`);
      const mergedWorkspaces = this._mergeWorkspaces(local.workspaces, data.workspaces || [], data.lastModified);
      log("info", `Merge result: ${mergedWorkspaces.length} total workspaces`);
      await win.gZenWorkspaces.propagateWorkspaces(mergedWorkspaces);
      log("info", "Workspaces propagated to all windows");

      // 2. Apply folders (with nesting order: parents first, then children)
      if (data.folders?.length) {
        log("info", `Applying ${data.folders.length} folders`);
        await this._applyFolders(data.folders, win);
      }

      // 3. Apply pinned/essential tabs (with ordering)
      if (data.pinnedTabs?.length) {
        log("info", `Applying ${data.pinnedTabs.length} pinned/essential tabs`);
        await this._applyPinnedTabs(data.pinnedTabs, win);
      }

      log("info", "=== SYNC DATA APPLIED SUCCESSFULLY ===");
    } catch (e) {
      log("error", `Failed to apply sync data: ${e.message}`);
      log("error", `Stack: ${e.stack}`);
    }
  },

  _mergeWorkspaces(local, remote, remoteTimestamp) {
    const merged = [];
    const seen = new Set();

    // Remote workspaces take priority (last-writer-wins)
    for (const ws of remote) {
      merged.push(ws);
      seen.add(ws.uuid);
      log("debug", `Merged remote workspace: "${ws.name}" (${ws.uuid})`);
    }

    // Preserve local-only workspaces
    for (const ws of local) {
      if (!seen.has(ws.uuid)) {
        merged.push(ws);
        log("debug", `Preserved local-only workspace: "${ws.name}" (${ws.uuid})`);
      }
    }

    return merged;
  },

  async _applyFolders(folders, win) {
    // Sort folders: parents first (parentId = null), then children by position
    const sortedFolders = [...folders].sort((a, b) => {
      // Top-level folders first
      if (!a.parentId && b.parentId) return -1;
      if (a.parentId && !b.parentId) return 1;
      // Then by position
      return a.position - b.position;
    });

    const folderMap = new Map(); // id -> folder element
    let created = 0;
    let updated = 0;

    for (const folderData of sortedFolders) {
      try {
        // Check if folder already exists
        let folder = win.document.getElementById(folderData.id);

        if (!folder && win.gZenFolders) {
          // Create new folder using _createFolderNode (internal API)
          folder = win.gZenFolders._createFolderNode({
            id: folderData.id,
            label: folderData.name,
            workspaceId: folderData.workspaceId,
            collapsed: folderData.collapsed,
          });

          // Determine where to insert the folder
          if (folderData.parentId) {
            // Nested folder - insert into parent folder
            const parentFolder = folderMap.get(folderData.parentId) || win.document.getElementById(folderData.parentId);
            if (parentFolder?.isZenFolder) {
              parentFolder.appendChild(folder);
              log("debug", `Nested folder "${folderData.name}" inside parent "${parentFolder.label}"`);
            } else {
              log("warn", `Parent folder ${folderData.parentId} not found for "${folderData.name}"`);
            }
          } else {
            // Top-level folder - insert into workspace's pinned container
            const workspaceElem = win.gZenWorkspaces.workspaceElement(folderData.workspaceId);
            const pinnedContainer = workspaceElem?.pinnedTabsContainer || win.gZenWorkspaces.pinnedTabsContainer;
            const separator = pinnedContainer.querySelector(".pinned-tabs-container-separator");
            if (separator) {
              separator.before(folder);
            } else {
              pinnedContainer.appendChild(folder);
            }
          }

          // Create empty tab for folder (folders need at least one tab)
          const emptyTab = win.gBrowser.addTab("about:blank", {
            skipAnimation: true,
            pinned: true,
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            _forZenEmptyTab: true,
            createLazyBrowser: true,
          });
          win.gBrowser.pinTab(emptyTab);
          emptyTab.setAttribute("zen-empty-tab", "true");
          if (folderData.workspaceId) {
            emptyTab.setAttribute("zen-workspace-id", folderData.workspaceId);
          }
          folder.addTabs([emptyTab]);

          created++;
          log("debug", `Created folder: "${folderData.name}" (${folderData.id})`);
        } else if (folder) {
          // Update existing folder properties
          folder.label = folderData.name;
          folder.collapsed = folderData.collapsed;
          if (folderData.workspaceId) {
            folder.setAttribute("zen-workspace-id", folderData.workspaceId);
          }
          updated++;
          log("debug", `Updated folder: "${folderData.name}" (${folderData.id})`);
        }

        if (folder) {
          folderMap.set(folderData.id, folder);
        }
      } catch (e) {
        log("error", `Failed to apply folder "${folderData.name}": ${e.message}`);
        log("error", `Stack: ${e.stack}`);
      }
    }

    log("info", `Folders: ${created} created, ${updated} updated`);
    return folderMap;
  },

  async _applyPinnedTabs(pinnedTabs, win) {
    // Sort tabs by position to maintain ordering
    const sortedTabs = [...pinnedTabs].sort((a, b) => a.position - b.position);

    let created = 0;
    let updated = 0;

    for (const tabData of sortedTabs) {
      try {
        // Find existing tab by URL
        let existingTab = null;
        for (const tab of win.gBrowser.tabs) {
          const url = tab.linkedBrowser?.currentURI?.spec;
          if (url === tabData.url) {
            existingTab = tab;
            break;
          }
        }

        if (!existingTab) {
          // Create new pinned tab (lazy - don't load immediately)
          log("debug", `Creating pinned tab for URL: "${tabData.url}"`);
          existingTab = win.gBrowser.addTab(tabData.url, {
            skipAnimation: true,
            pinned: true,
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            createLazyBrowser: true,  // Don't load tab immediately
          });
          win.gBrowser.pinTab(existingTab);
          created++;
          log("debug", `Created pinned tab (lazy): "${tabData.url}"`);
        }

        // Apply workspace
        if (tabData.workspaceId) {
          existingTab.setAttribute("zen-workspace-id", tabData.workspaceId);
        }

        // Apply essential state
        if (tabData.isEssential) {
          existingTab.setAttribute("zen-essential", "true");
        }

        // Apply custom tab label if set
        if (tabData.label) {
          // Use zenStaticLabel property and _setTabLabel like ZenUIManager does
          existingTab.zenStaticLabel = tabData.label;
          win.gBrowser._setTabLabel(existingTab, tabData.label);
          log("debug", `Applied custom label "${tabData.label}" to tab "${tabData.url}"`);
        }

        // Move to folder if specified
        if (tabData.folderId) {
          const folder = win.document.getElementById(tabData.folderId);
          if (folder?.isZenFolder) {
            folder.addTabs([existingTab]);
            log("debug", `Moved tab "${tabData.url}" to folder ${tabData.folderId}`);
          } else {
            log("warn", `Folder ${tabData.folderId} not found for tab "${tabData.url}"`);
          }
        }

        updated++;
      } catch (e) {
        log("error", `Failed to apply tab "${tabData.url}": ${e.message}`);
        log("error", `Stack: ${e.stack}`);
      }

      updated++;
    }

    log("info", `Pinned tabs: ${created} created, ${updated} updated`);
  },

  async getAllIDs() {
    log("info", "getAllIDs called");
    const result = { [lazy.WORKSPACES_GUID]: true };
    log("info", `getAllIDs returning: ${JSON.stringify(result)}`);
    return result;
  },

  async changeItemID() {
    log("debug", "changeItemID called (GUID is constant, ignoring)");
  },

  async itemExists(id) {
    const exists = id === lazy.WORKSPACES_GUID;
    log("info", `itemExists(${id}): ${exists}`);
    return exists;
  },

  async createRecord(id, collection) {
    log("info", `Creating sync record for upload (id: ${id})`);
    let record = new WorkspacesRec(collection, id);
    if (id === lazy.WORKSPACES_GUID) {
      record.value = this._getWorkspacesData();
      log("info", `Record created with ${record.value.workspaces.length} workspaces, ${record.value.folders.length} folders, ${record.value.pinnedTabs.length} pinned tabs`);
    } else {
      record.deleted = true;
      log("debug", "Created tombstone record");
    }
    return record;
  },

  async create(record) {
    log("info", `create() called with record id: ${record.id}`);
    // For single-record engine, treat create same as update if it has our data
    if (record.id === lazy.WORKSPACES_GUID && record.value) {
      log("info", "=== INCOMING CREATE (treating as update) ===");
      await this._applyWorkspacesData(record.value);
    }
  },

  async remove(record) {
    log("debug", `remove() called for record: ${record.id}`);
  },

  async update(record) {
    log("info", `update() called with record id: ${record.id}`);
    if (record.id !== lazy.WORKSPACES_GUID) {
      log("debug", `Ignoring update for unknown record: ${record.id}`);
      return;
    }
    if (!record.value) {
      log("warn", "update() called but record.value is empty");
      return;
    }
    log("info", "=== INCOMING UPDATE RECEIVED ===");
    log("info", `Record contains: ${record.value.workspaces?.length || 0} workspaces, ${record.value.folders?.length || 0} folders, ${record.value.pinnedTabs?.length || 0} pinned tabs`);
    await this._applyWorkspacesData(record.value);
  },

  async wipe() {
    log("warn", "wipe() called (ignoring - preserving local workspaces)");
  },
};
Object.setPrototypeOf(WorkspacesStore.prototype, Store.prototype);

// ============== TRACKER ==============

function WorkspacesTracker(name, engine) {
  Tracker.call(this, name, engine);
  this._ignoreAll = false;
  Svc.Obs.add("profile-before-change", this.asyncObserver);
  log("info", "WorkspacesTracker initialized");
}

WorkspacesTracker.prototype = {
  get ignoreAll() {
    return this._ignoreAll;
  },
  set ignoreAll(value) {
    log("debug", `Tracker ignoreAll set to: ${value}`);
    this._ignoreAll = value;
  },

  get modified() {
    return Svc.PrefBranch.getBoolPref("engine.workspaces.modified", false);
  },
  set modified(value) {
    log("debug", `Tracker modified flag set to: ${value}`);
    Svc.PrefBranch.setBoolPref("engine.workspaces.modified", value);
  },

  clearChangedIDs() {
    log("debug", "Clearing changed IDs (modified = false)");
    this.modified = false;
  },

  onStart() {
    log("info", "Tracker STARTED - now observing workspace/folder/tab changes");
    Svc.Obs.add("zen-workspaces-changed", this.asyncObserver);
    Svc.Obs.add("zen-folders-changed", this.asyncObserver);
    Svc.Obs.add("zen-pinned-tabs-changed", this.asyncObserver);
  },

  onStop() {
    log("info", "Tracker STOPPED - no longer observing changes");
    Svc.Obs.remove("zen-workspaces-changed", this.asyncObserver);
    Svc.Obs.remove("zen-folders-changed", this.asyncObserver);
    Svc.Obs.remove("zen-pinned-tabs-changed", this.asyncObserver);
  },

  async observe(subject, topic) {
    switch (topic) {
      case "profile-before-change":
        log("info", "Profile change detected, stopping tracker");
        await this.stop();
        break;
      case "zen-workspaces-changed":
      case "zen-folders-changed":
      case "zen-pinned-tabs-changed":
        if (this.ignoreAll) {
          log("debug", `${topic} detected but ignoreAll=true, skipping`);
          break;
        }
        this.score += SCORE_INCREMENT_XLARGE;
        this.modified = true;
        log("info", `LOCAL CHANGE DETECTED (${topic}) - Score: ${this.score}, sync scheduled`);
        break;
    }
  },
};
Object.setPrototypeOf(WorkspacesTracker.prototype, Tracker.prototype);
