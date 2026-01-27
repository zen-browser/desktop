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

      // Collect pinned items (tabs AND folders together) to preserve interleaved order
      const { folders, pinnedTabs } = this._getPinnedItemsData();
      log("info", `Found ${folders.length} folders, ${pinnedTabs.length} pinned/essential tabs`);

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

  // Collect tabs and folders together to maintain correct interleaved positions
  _getPinnedItemsData() {
    const folders = [];
    const tabs = [];
    const win = Services.wm.getMostRecentWindow("navigator:browser");
    if (!win?.gBrowser || !win?.gZenWorkspaces) {
      return { folders, pinnedTabs: tabs };
    }

    const seenTabs = new Set();
    const seenFolders = new Set();

    // Helper to collect a folder and its data
    const collectFolder = (folder, containerPosition, parentId = null) => {
      if (seenFolders.has(folder.id)) return;
      seenFolders.add(folder.id);

      const workspaceId = folder.getAttribute("zen-workspace-id");
      // Get the folder icon using the iconURL getter
      const userIcon = folder.iconURL || null;

      folders.push({
        id: folder.id,
        name: folder.label,
        workspaceId,
        parentId,
        collapsed: folder.collapsed,
        isEssential: folder.hasAttribute("zen-essential"),
        userIcon,
        position: containerPosition,  // Position within parent container
      });
      log("debug", `Collected folder: "${folder.label}" (${folder.id}), pos: ${containerPosition}, icon: "${userIcon || "none"}"`);
    };

    // Helper to collect a tab
    const collectTab = (tab, containerPosition, folderId = null) => {
      if (seenTabs.has(tab)) return;

      const isEssential = tab.hasAttribute("zen-essential");
      const isInFolder = tab.group?.isZenFolder;
      // If we're explicitly being told this tab is in a folder (folderId passed), treat it as pinned
      const isPinned = tab.pinned || isInFolder || folderId;

      const url = tab.linkedBrowser?.currentURI?.spec;
      const isEmpty = tab.hasAttribute("zen-empty-tab");

      log("debug", `collectTab checking: url="${url}", pinned=${tab.pinned}, isInFolder=${isInFolder}, folderId=${folderId}, isEmpty=${isEmpty}, essential=${isEssential}`);

      if (!isEssential && !isPinned) {
        log("debug", `  -> Skipped: not essential and not pinned`);
        return;
      }
      if (isEmpty) {
        log("debug", `  -> Skipped: empty tab placeholder`);
        return;
      }

      if (!url || url.startsWith("about:")) {
        log("debug", `  -> Skipped: no URL or about: URL`);
        return;
      }

      seenTabs.add(tab);
      const workspaceId = tab.getAttribute("zen-workspace-id");
      const label = tab.zenStaticLabel || null;
      const tabId = `${url}-${label || ""}-${folderId || "root"}-${containerPosition}`;

      tabs.push({
        id: tabId,
        url,
        workspaceId,
        folderId,
        isEssential,
        isPinned: !!isPinned,
        label,
        position: containerPosition,  // Position within parent container (folder or pinned container)
      });
      log("debug", `  -> Collected tab: "${url}" (label: "${label}", pos: ${containerPosition}) in ${folderId || "root"}`);
    };

    // Helper to collect items from a folder using folder.allItems (includes nested folders)
    const collectFolderContents = (folder) => {
      // Use allItems instead of tabs - allItems includes both tabs AND nested folders
      const folderItems = folder.allItems || [];
      log("debug", `collectFolderContents: folder "${folder.label}" has ${folderItems.length} items`);
      let folderPosition = 0;

      for (const item of folderItems) {
        const isFolder = item.isZenFolder;
        const isTab = win.gBrowser.isTab(item);
        const isEmptyTab = item.hasAttribute?.("zen-empty-tab");
        log("debug", `  - Item: isFolder=${isFolder}, isTab=${isTab}, isEmpty=${isEmptyTab}, tagName=${item.tagName}`);

        if (isFolder) {
          // Nested folder
          collectFolder(item, folderPosition++, folder.id);
          // Recursively collect nested folder contents
          collectFolderContents(item);
        } else if (isTab) {
          collectTab(item, folderPosition++, folder.id);
        }
      }
    };

    // Helper to collect items from a container in DOM order
    const collectFromContainer = (container, parentFolderId = null) => {
      if (!container) return;

      let position = 0;
      for (const child of container.children) {
        // Skip separators and other non-tab/non-folder elements
        if (child.classList?.contains("pinned-tabs-container-separator")) continue;

        if (child.isZenFolder) {
          // It's a folder - collect folder data with its position
          collectFolder(child, position++, parentFolderId);
          // Then collect items inside the folder using folder.tabs API
          collectFolderContents(child);
        } else if (win.gBrowser.isTab(child)) {
          // It's a tab at root level (not in a folder)
          collectTab(child, position++, parentFolderId);
        }
      }
    };

    // Process all workspaces
    const workspaceElements = win.document.querySelectorAll("zen-workspace");
    for (const workspace of workspaceElements) {
      log("debug", `Processing workspace: ${workspace.id}`);
      // Collect from pinned container - this maintains the interleaved order
      collectFromContainer(workspace.pinnedTabsContainer, null);
    }

    // Also process essentials container
    const essentialsContainers = win.document.querySelectorAll(".zen-essentials-container");
    for (const container of essentialsContainers) {
      collectFromContainer(container, null);
    }

    log("info", `Collected ${folders.length} folders, ${tabs.length} tabs with positions`);
    return { folders, pinnedTabs: tabs };
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

      // 2. Apply pinned items (folders + tabs) with correct interleaved ordering
      await this._applyPinnedItems(data.folders || [], data.pinnedTabs || [], win);

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

  // Apply folders and tabs together to maintain correct interleaved ordering
  async _applyPinnedItems(folders, pinnedTabs, win) {
    const folderMap = new Map(); // id -> folder element
    const tabMap = new Map(); // tabData.id -> tab element

    // Phase 1: Create/find all folders (parents first, then children)
    // Sort folders to ensure parents are created before children
    const sortedFolders = [...folders].sort((a, b) => {
      if (!a.parentId && b.parentId) return -1;
      if (a.parentId && !b.parentId) return 1;
      return 0;
    });

    let foldersCreated = 0;
    for (const folderData of sortedFolders) {
      try {
        let folder = win.document.getElementById(folderData.id);

        if (!folder && win.gZenFolders) {
          folder = win.gZenFolders._createFolderNode({
            id: folderData.id,
            label: folderData.name,
            workspaceId: folderData.workspaceId,
            collapsed: folderData.collapsed,
          });

          // Temporarily append to a workspace container (will be repositioned later)
          const workspaceElem = win.gZenWorkspaces.workspaceElement(folderData.workspaceId);
          const pinnedContainer = workspaceElem?.pinnedTabsContainer || win.gZenWorkspaces.pinnedTabsContainer;
          pinnedContainer.appendChild(folder);

          // Create empty tab for folder
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

          foldersCreated++;
          log("debug", `Created folder: "${folderData.name}" (${folderData.id})`);
        } else if (folder) {
          folder.label = folderData.name;
          folder.collapsed = folderData.collapsed;
          if (folderData.workspaceId) {
            folder.setAttribute("zen-workspace-id", folderData.workspaceId);
          }
        }

        // Apply folder icon
        if (folder && folderData.userIcon && win.gZenFolders) {
          win.gZenFolders.setFolderUserIcon(folder, folderData.userIcon);
          log("debug", `Applied icon "${folderData.userIcon}" to folder "${folderData.name}"`);
        }

        if (folder) {
          folderMap.set(folderData.id, { element: folder, data: folderData });
        }
      } catch (e) {
        log("error", `Failed to create folder "${folderData.name}": ${e.message}`);
      }
    }

    // Phase 2: Create/find all tabs
    let tabsCreated = 0;
    for (const tabData of pinnedTabs) {
      try {
        let existingTab = null;
        for (const tab of win.gBrowser.tabs) {
          const url = tab.linkedBrowser?.currentURI?.spec;
          if (url === tabData.url) {
            existingTab = tab;
            break;
          }
        }

        if (!existingTab) {
          existingTab = win.gBrowser.addTab(tabData.url, {
            skipAnimation: true,
            pinned: true,
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            createLazyBrowser: true,
          });
          win.gBrowser.pinTab(existingTab);
          tabsCreated++;
          log("debug", `Created tab: "${tabData.url}"`);
        }

        // Apply workspace
        if (tabData.workspaceId) {
          existingTab.setAttribute("zen-workspace-id", tabData.workspaceId);
        }

        // Apply essential state
        if (tabData.isEssential) {
          existingTab.setAttribute("zen-essential", "true");
        }

        // Apply label
        if (tabData.label) {
          existingTab._zenChangeLabelFlag = true;
          existingTab.zenStaticLabel = tabData.label;
          win.gBrowser._setTabLabel(existingTab, tabData.label);
          delete existingTab._zenChangeLabelFlag;
        } else {
          try {
            const url = new URL(tabData.url);
            const defaultLabel = url.hostname || tabData.url;
            existingTab._zenChangeLabelFlag = true;
            win.gBrowser._setTabLabel(existingTab, defaultLabel);
            delete existingTab._zenChangeLabelFlag;
          } catch (e) {}
        }

        tabMap.set(tabData.id, { element: existingTab, data: tabData });
      } catch (e) {
        log("error", `Failed to create tab "${tabData.url}": ${e.message}`);
      }
    }

    // Phase 3: Position items correctly
    // Group items by their container (workspace for root items, folder for nested items)
    const itemsByContainer = new Map(); // containerId -> array of {type, data, element}

    // Add root-level folders (parentId is null)
    for (const [id, { element, data }] of folderMap) {
      if (!data.parentId) {
        const containerId = data.workspaceId || "default";
        if (!itemsByContainer.has(containerId)) {
          itemsByContainer.set(containerId, []);
        }
        itemsByContainer.get(containerId).push({
          type: "folder",
          data,
          element,
          position: data.position,
        });
      }
    }

    // Add root-level tabs (folderId is null)
    for (const [id, { element, data }] of tabMap) {
      if (!data.folderId) {
        const containerId = data.workspaceId || "default";
        if (!itemsByContainer.has(containerId)) {
          itemsByContainer.set(containerId, []);
        }
        itemsByContainer.get(containerId).push({
          type: "tab",
          data,
          element,
          position: data.position,
        });
      }
    }

    // Sort and position root-level items in each workspace
    for (const [workspaceId, items] of itemsByContainer) {
      // Sort by position to get correct interleaved order
      items.sort((a, b) => a.position - b.position);

      const workspaceElem = win.gZenWorkspaces.workspaceElement(workspaceId);
      const pinnedContainer = workspaceElem?.pinnedTabsContainer || win.gZenWorkspaces.pinnedTabsContainer;
      const separator = pinnedContainer?.querySelector(".pinned-tabs-container-separator");

      log("debug", `Positioning ${items.length} items in workspace ${workspaceId}`);

      // Insert items in order before the separator
      for (const item of items) {
        if (separator) {
          separator.before(item.element);
        } else {
          pinnedContainer.appendChild(item.element);
        }
        log("debug", `Positioned ${item.type} "${item.data.name || item.data.url}" at position ${item.position}`);
      }
    }

    // Phase 4: Handle nested items (tabs AND nested folders inside folders)
    // Process folders to add their children in correct interleaved order
    for (const [folderId, { element: folder, data: folderData }] of folderMap) {
      // Collect ALL items that belong in this folder (tabs + nested folders)
      const folderItems = [];

      // Get tabs that belong to this folder
      for (const [tabId, { element: tab, data: tabData }] of tabMap) {
        if (tabData.folderId === folderId) {
          folderItems.push({ type: "tab", element: tab, data: tabData, position: tabData.position });
        }
      }

      // Get nested folders that belong to this folder
      for (const [nestedId, { element: nestedFolder, data: nestedData }] of folderMap) {
        if (nestedData.parentId === folderId) {
          folderItems.push({ type: "folder", element: nestedFolder, data: nestedData, position: nestedData.position });
        }
      }

      // Sort ALL items by position to get correct interleaved order
      folderItems.sort((a, b) => a.position - b.position);

      log("debug", `Adding ${folderItems.length} items to folder "${folderData.name}" in order`);

      // Add items to folder in position order
      for (const item of folderItems) {
        if (item.type === "tab") {
          folder.addTabs([item.element]);
          log("debug", `  Added tab "${item.data.url}" at position ${item.position}`);
        } else {
          folder.appendChild(item.element);
          log("debug", `  Added nested folder "${item.data.name}" at position ${item.position}`);
        }
      }
    }

    log("info", `Applied ${foldersCreated} new folders, ${tabsCreated} new tabs`);
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

  _onTabMove(event) {
    // Only trigger sync for pinned tabs or tabs in folders
    const tab = event.target;
    if (tab.pinned || tab.group?.isZenFolder) {
      if (this.ignoreAll) {
        log("debug", "TabMove detected but ignoreAll=true, skipping");
        return;
      }
      this.score += SCORE_INCREMENT_XLARGE;
      this.modified = true;
      log("info", `LOCAL CHANGE DETECTED (TabMove) - Score: ${this.score}, sync scheduled`);
    }
  },

  _onTabGroupMoved(event) {
    if (this.ignoreAll) {
      log("debug", "TabGroupMoved detected but ignoreAll=true, skipping");
      return;
    }
    this.score += SCORE_INCREMENT_XLARGE;
    this.modified = true;
    log("info", `LOCAL CHANGE DETECTED (TabGroupMoved) - Score: ${this.score}, sync scheduled`);
  },

  _onTabGroupUpdate(event) {
    // Triggered when folder properties change (icon, name, etc.)
    log("debug", `TabGroupUpdate event received, target: ${event.target?.tagName}, isZenFolder: ${event.target?.isZenFolder}`);
    const group = event.target;
    if (group?.isZenFolder) {
      if (this.ignoreAll) {
        log("debug", "TabGroupUpdate detected but ignoreAll=true, skipping");
        return;
      }
      this.score += SCORE_INCREMENT_XLARGE;
      this.modified = true;
      log("info", `LOCAL CHANGE DETECTED (TabGroupUpdate - folder icon/properties) - Score: ${this.score}, sync scheduled`);
    } else {
      log("debug", `TabGroupUpdate ignored - target is not a zen folder`);
    }
  },

  _addWindowListeners(win) {
    if (!win.gBrowser || win._zenWorkspacesSyncListenersAdded) return;
    win._zenWorkspacesSyncListenersAdded = true;
    win.addEventListener("TabMove", this._boundOnTabMove, true);
    win.addEventListener("TabGroupMoved", this._boundOnTabGroupMoved, true);
    win.addEventListener("TabGroupUpdate", this._boundOnTabGroupUpdate, true);
    log("debug", `Added DOM event listeners to window`);
  },

  _removeWindowListeners(win) {
    if (!win._zenWorkspacesSyncListenersAdded) return;
    delete win._zenWorkspacesSyncListenersAdded;
    win.removeEventListener("TabMove", this._boundOnTabMove, true);
    win.removeEventListener("TabGroupMoved", this._boundOnTabGroupMoved, true);
    win.removeEventListener("TabGroupUpdate", this._boundOnTabGroupUpdate, true);
    log("debug", `Removed DOM event listeners from window`);
  },

  onStart() {
    log("info", "Tracker STARTED - now observing workspace/folder/tab changes");
    Svc.Obs.add("zen-workspaces-changed", this.asyncObserver);
    Svc.Obs.add("zen-folders-changed", this.asyncObserver);
    Svc.Obs.add("zen-pinned-tabs-changed", this.asyncObserver);

    // Bind event handlers once
    this._boundOnTabMove = this._onTabMove.bind(this);
    this._boundOnTabGroupMoved = this._onTabGroupMoved.bind(this);
    this._boundOnTabGroupUpdate = this._onTabGroupUpdate.bind(this);

    // Add listeners to existing windows
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      this._addWindowListeners(win);
    }

    // Watch for new windows
    this._windowObserver = {
      tracker: this,
      observe(subject, topic) {
        if (topic === "domwindowopened") {
          const win = subject;
          // Wait for window to be ready
          win.addEventListener("load", () => {
            if (win.document.documentElement.getAttribute("windowtype") === "navigator:browser") {
              this.tracker._addWindowListeners(win);
            }
          }, { once: true });
        }
      }
    };
    Services.ww.registerNotification(this._windowObserver);
    log("info", "Registered window observer for new browser windows");
  },

  onStop() {
    log("info", "Tracker STOPPED - no longer observing changes");
    Svc.Obs.remove("zen-workspaces-changed", this.asyncObserver);
    Svc.Obs.remove("zen-folders-changed", this.asyncObserver);
    Svc.Obs.remove("zen-pinned-tabs-changed", this.asyncObserver);

    // Unregister window observer
    if (this._windowObserver) {
      Services.ww.unregisterNotification(this._windowObserver);
      this._windowObserver = null;
    }

    // Remove DOM event listeners from all windows
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      this._removeWindowListeners(win);
    }
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
