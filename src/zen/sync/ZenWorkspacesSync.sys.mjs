/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  Store,
  SyncEngine,
  Tracker,
} from "resource://services-sync/engines.sys.mjs";
import { CryptoWrapper } from "resource://services-sync/record.sys.mjs";
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import { SCORE_INCREMENT_XLARGE } from "resource://services-sync/constants.sys.mjs";
import {
  CONTEXTUAL_IDENTITY_TOPIC_PREFIX,
  OBSERVER_TOPICS,
  RECORD_ID_PREFIX_BY_TYPE,
  RECORD_TYPES,
  RECORD_TYPE_BY_PREFIX,
  SYNC_PREFS,
  WORKSPACES_ENGINE_NAME,
  WORKSPACES_RECORD_LOG_NAME,
  WORKSPACES_RECORD_TYPE,
} from "resource:///modules/zen/ZenSyncConstants.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenSyncStore: "resource:///modules/zen/ZenSyncManager.sys.mjs",
  ContextualIdentityService:
    "resource://gre/modules/ContextualIdentityService.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gSyncOnlyPinnedTabs",
  SYNC_PREFS.SYNC_ONLY_PINNED_TABS,
  true
);

/**
 * Sync record wrapper for workspace and container items stored in the
 * Workspaces engine collection.
 */
export class ZenWorkspacesRecord extends CryptoWrapper {
  _logName = WORKSPACES_RECORD_LOG_NAME;
}

ZenWorkspacesRecord.prototype.type = WORKSPACES_RECORD_TYPE;

function parseRecordId(id) {
  const sep = id.indexOf("~");
  if (sep <= 0 || sep === id.length - 1) {
    return null;
  }
  const prefix = id.slice(0, sep);
  const key = id.slice(sep + 1);
  return { type: RECORD_TYPE_BY_PREFIX[prefix] || prefix, key };
}

function createRecordId(type, id) {
  const prefix = RECORD_ID_PREFIX_BY_TYPE[type];
  if (!prefix) {
    throw new Error(`Unknown Spaces Sync record type: ${type}`);
  }
  return `${prefix}~${id}`;
}

function normalizeUserContextId(value) {
  const normalized = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

/**
 * Strips the sync-envelope fields (`id` and `type`) from incoming record data
 * and restores the item's real identity key where needed
 *
 * @param {object} data
 */
function stripSyncFields(data) {
  const rest = { ...data };
  delete rest.id;
  delete rest.type;
  return rest;
}

/**
 * Sync store implementation that serializes local workspace and container
 * state into records and applies incoming remote changes.
 */
class ZenWorkspacesStore extends Store {
  constructor(name, engine) {
    super(name, engine);
  }

  async getAllIDs() {
    const ids = {};
    const sidebar = lazy.ZenSyncStore.getSidebarData();

    for (const space of sidebar.spaces || []) {
      if (space.uuid) {
        ids[createRecordId(RECORD_TYPES.SPACE, space.uuid)] = true;
      }
    }

    for (const c of lazy.ContextualIdentityService.getPublicIdentities()) {
      ids[createRecordId(RECORD_TYPES.CONTAINER, c.userContextId)] = true;
    }
    const pinnedOnly = lazy.gSyncOnlyPinnedTabs;

    for (const tab of sidebar.tabs || []) {
      if (tab.zenSyncId && (!pinnedOnly || tab.pinned)) {
        ids[createRecordId(RECORD_TYPES.TAB, tab.zenSyncId)] = true;
      }
    }

    for (const folder of sidebar.folders || []) {
      if (folder.id) {
        ids[createRecordId(RECORD_TYPES.FOLDER, folder.id)] = true;
      }
    }

    for (const splitGroup of sidebar.splitViewData || []) {
      if (splitGroup.groupId) {
        ids[createRecordId(RECORD_TYPES.SPLIT, splitGroup.groupId)] = true;
      }
    }

    return ids;
  }

  async itemExists(id) {
    const parsed = parseRecordId(id);
    if (!parsed) {
      return false;
    }
    const sidebar = lazy.ZenSyncStore.getSidebarData();

    switch (parsed.type) {
      case RECORD_TYPES.SPACE:
        return (sidebar.spaces || []).some(s => s.uuid === parsed.key);
      case RECORD_TYPES.CONTAINER:
        return lazy.ContextualIdentityService.getPublicIdentities().some(
          c => String(c.userContextId) === parsed.key
        );
      case RECORD_TYPES.TAB:
        return (sidebar.tabs || []).some(t => t.zenSyncId === parsed.key);
      case RECORD_TYPES.FOLDER:
        return (sidebar.folders || []).some(f => String(f.id) === parsed.key);
      case RECORD_TYPES.SPLIT:
        return (sidebar.splitViewData || []).some(
          splitGroup => splitGroup.groupId === parsed.key
        );
      default:
        return false;
    }
  }

  async createRecord(id, collection) {
    const record = new ZenWorkspacesRecord(collection, id);
    const parsed = parseRecordId(id);
    if (!parsed) {
      record.deleted = true;
      return record;
    }

    const sidebar = lazy.ZenSyncStore.getSidebarData();

    switch (parsed.type) {
      case RECORD_TYPES.SPACE: {
        const spaces = sidebar.spaces || [];
        const idx = spaces.findIndex(s => s.uuid === parsed.key);
        if (idx === -1) {
          record.deleted = true;
          return record;
        }
        const rest = { ...spaces[idx] };
        delete rest.syncStatus;
        record.cleartext = {
          id,
          type: RECORD_TYPES.SPACE,
          ...rest,
          position: idx,
        };
        break;
      }

      case RECORD_TYPES.CONTAINER: {
        const container =
          lazy.ContextualIdentityService.getPublicIdentities().find(
            c => String(c.userContextId) === parsed.key
          );
        if (!container) {
          record.deleted = true;
          return record;
        }
        record.cleartext = {
          id,
          type: RECORD_TYPES.CONTAINER,
          userContextId: container.userContextId,
          name: container.name,
          icon: container.icon,
          color: container.color,
        };
        break;
      }
      case RECORD_TYPES.TAB: {
        const syncableTabData = lazy.ZenSyncStore.createSyncableTabData(
          parsed.key,
          {
            trimHistoryForUnpinned: true,
          }
        );
        if (!syncableTabData?.zenSyncId) {
          record.deleted = true;
          return record;
        }
        record.cleartext = { id, type: RECORD_TYPES.TAB, ...syncableTabData };
        break;
      }
      case RECORD_TYPES.FOLDER: {
        const folder = (sidebar.folders || []).find(
          f => String(f.id) === parsed.key
        );
        if (!folder) {
          record.deleted = true;
          return record;
        }
        const { id: folderId, ...rest } = folder;
        delete rest.syncStatus;
        record.cleartext = {
          id,
          type: RECORD_TYPES.FOLDER,
          folderId,
          ...rest,
        };
        break;
      }
      case RECORD_TYPES.SPLIT: {
        const splitGroup = (sidebar.splitViewData || []).find(
          group => group.groupId === parsed.key
        );
        if (!splitGroup) {
          record.deleted = true;
          return record;
        }
        record.cleartext = {
          id,
          type: RECORD_TYPES.SPLIT,
          groupId: splitGroup.groupId,
          gridType: splitGroup.gridType,
          layoutTree: splitGroup.layoutTree,
          tabs: Array.isArray(splitGroup.tabs) ? [...splitGroup.tabs] : [],
        };
        break;
      }
      default:
        record.deleted = true;
    }

    return record;
  }

  async applyIncomingBatch(records, _countTelemetry) {
    const pulled = {
      spaces: [],
      tabs: [],
      folders: [],
      containers: [],
      splits: [],
    };
    const removals = {
      spaces: [],
      tabs: [],
      folders: [],
      containers: [],
      splits: [],
    };
    for (const record of records) {
      if (record.deleted) {
        this._collectRemoval(record.id, removals);
        continue;
      }
      const data = record.cleartext;
      if (!data?.type) {
        continue;
      }
      const parsedRecordId = parseRecordId(record.id);
      const clean = stripSyncFields(data);
      switch (data.type) {
        case RECORD_TYPES.SPACE:
          pulled.spaces.push(clean);
          break;
        case RECORD_TYPES.CONTAINER:
          pulled.containers.push(clean);
          break;
        case RECORD_TYPES.TAB: {
          const recordTabId =
            parsedRecordId?.type === RECORD_TYPES.TAB
              ? parsedRecordId.key
              : null;
          const syncId =
            typeof recordTabId === "string" && recordTabId
              ? recordTabId
              : clean.zenSyncId;
          if (!syncId) {
            break;
          }
          clean.zenSyncId = syncId;
          pulled.tabs.push(clean);
          break;
        }
        case RECORD_TYPES.FOLDER:
          clean.id =
            clean.folderId ||
            (parsedRecordId?.type === RECORD_TYPES.FOLDER
              ? parsedRecordId.key
              : null);
          if (!clean.id) {
            break;
          }
          delete clean.folderId;
          pulled.folders.push(clean);
          break;
        case RECORD_TYPES.SPLIT:
          clean.groupId =
            clean.groupId ||
            (parsedRecordId?.type === RECORD_TYPES.SPLIT
              ? parsedRecordId.key
              : null);
          if (!clean.groupId) {
            break;
          }
          pulled.splits.push(clean);
          break;
      }
    }

    // Suppress change tracking while applying incoming data to prevent
    // feedback loops where applied items get re-uploaded immediately.
    this.engine._tracker.ignoreAll = true;
    try {
      await lazy.ZenSyncStore.applyIncomingBatch(pulled, removals);
    } finally {
      this.engine._tracker.ignoreAll = false;
    }
    return [];
  }

  _collectRemoval(id, removals) {
    const parsed = parseRecordId(id);
    if (!parsed) {
      return;
    }
    switch (parsed.type) {
      case RECORD_TYPES.SPACE:
        removals.spaces.push({ uuid: parsed.key });
        break;
      case RECORD_TYPES.CONTAINER: {
        const userContextId = normalizeUserContextId(parsed.key);
        if (userContextId === null) {
          console.warn(
            "ZenWorkspacesStore: Ignoring container removal with invalid userContextId",
            { id }
          );
          break;
        }
        removals.containers.push({ userContextId });
        break;
      }
      case RECORD_TYPES.TAB:
        removals.tabs.push({ zenSyncId: parsed.key });
        break;
      case RECORD_TYPES.FOLDER:
        removals.folders.push({ id: parsed.key });
        break;
      case RECORD_TYPES.SPLIT:
        removals.splits.push({ groupId: parsed.key });
        break;
    }
  }

  async create(record) {
    await this._applySingle(record);
  }

  async update(record) {
    await this._applySingle(record);
  }

  async _applySingle(record) {
    this.engine._tracker.ignoreAll = true;
    try {
      if (record.deleted) {
        const removals = {
          spaces: [],
          tabs: [],
          folders: [],
          containers: [],
          splits: [],
        };
        this._collectRemoval(record.id, removals);
        await lazy.ZenSyncStore.applyIncomingBatch(
          { spaces: [], tabs: [], folders: [], containers: [], splits: [] },
          removals
        );
        return;
      }
      const data = record.cleartext;
      if (!data?.type) {
        return;
      }
      const parsedRecordId = parseRecordId(record.id);
      const clean = stripSyncFields(data);
      const pulled = {
        spaces: [],
        tabs: [],
        folders: [],
        containers: [],
        splits: [],
      };
      switch (data.type) {
        case RECORD_TYPES.SPACE:
          pulled.spaces.push(clean);
          break;
        case RECORD_TYPES.CONTAINER:
          pulled.containers.push(clean);
          break;
        case RECORD_TYPES.TAB: {
          const recordTabId =
            parsedRecordId?.type === RECORD_TYPES.TAB
              ? parsedRecordId.key
              : null;
          const syncId =
            typeof recordTabId === "string" && recordTabId
              ? recordTabId
              : clean.zenSyncId;
          if (!syncId) {
            break;
          }
          clean.zenSyncId = syncId;
          pulled.tabs.push(clean);
          break;
        }
        case RECORD_TYPES.FOLDER:
          clean.id =
            clean.folderId ||
            (parsedRecordId?.type === RECORD_TYPES.FOLDER
              ? parsedRecordId.key
              : null);
          if (!clean.id) {
            break;
          }
          delete clean.folderId;
          pulled.folders.push(clean);
          break;
        case RECORD_TYPES.SPLIT:
          clean.groupId =
            clean.groupId ||
            (parsedRecordId?.type === RECORD_TYPES.SPLIT
              ? parsedRecordId.key
              : null);
          if (!clean.groupId) {
            break;
          }
          pulled.splits.push(clean);
          break;
      }
      await lazy.ZenSyncStore.applyIncomingBatch(pulled, {
        spaces: [],
        tabs: [],
        folders: [],
        containers: [],
        splits: [],
      });
    } finally {
      this.engine._tracker.ignoreAll = false;
    }
  }

  async remove() {
    // No-op: never delete user data on wipe
  }

  async wipe() {
    // No-op: never delete user data on wipe
  }

  changeItemID() {
    // No-op
  }
}

/**
 * Sync tracker that watches workspace and contextual identity observers and
 * marks the corresponding record IDs as changed.
 */
class ZenWorkspacesTracker extends Tracker {
  #changedIDs = {};
  #ignoreAll = false;

  get ignoreAll() {
    return this.#ignoreAll;
  }

  set ignoreAll(value) {
    this.#ignoreAll = value;
  }

  onStart() {
    Services.obs.addObserver(this, OBSERVER_TOPICS.ZEN_WORKSPACE_ITEM_CHANGED);
    Services.obs.addObserver(this, OBSERVER_TOPICS.CONTEXTUAL_IDENTITY_CREATED);
    Services.obs.addObserver(this, OBSERVER_TOPICS.CONTEXTUAL_IDENTITY_UPDATED);
    Services.obs.addObserver(this, OBSERVER_TOPICS.CONTEXTUAL_IDENTITY_DELETED);
  }

  onStop() {
    Services.obs.removeObserver(
      this,
      OBSERVER_TOPICS.ZEN_WORKSPACE_ITEM_CHANGED
    );
    Services.obs.removeObserver(
      this,
      OBSERVER_TOPICS.CONTEXTUAL_IDENTITY_CREATED
    );
    Services.obs.removeObserver(
      this,
      OBSERVER_TOPICS.CONTEXTUAL_IDENTITY_UPDATED
    );
    Services.obs.removeObserver(
      this,
      OBSERVER_TOPICS.CONTEXTUAL_IDENTITY_DELETED
    );
  }

  observe(subject, topic, _data) {
    if (this.#ignoreAll) {
      return;
    }
    if (topic === OBSERVER_TOPICS.ZEN_WORKSPACE_ITEM_CHANGED) {
      const type = subject?.wrappedJSObject?.type;
      const id = subject?.wrappedJSObject?.id;
      if (type && id) {
        this._trackChange({ type, id });
      }
    } else if (topic.startsWith(CONTEXTUAL_IDENTITY_TOPIC_PREFIX)) {
      const id = subject?.wrappedJSObject?.userContextId;
      if (id && normalizeUserContextId(id) !== null) {
        this._trackChange({ type: RECORD_TYPES.CONTAINER, id });
      }
    }
  }

  _trackChange(data) {
    if (data.type && data.id) {
      const id = createRecordId(data.type, data.id);
      this.#changedIDs[id] = Date.now() / 1000;
      // increment score with SCORE_INCREMENT_XLARGE - this will cause and immediate sync
      // if we want to do less often sync for tabs for example, we can change this to SCORE_INCREMENT_MEDIUM or other values
      this.score += SCORE_INCREMENT_XLARGE;
    }
  }

  async getChangedIDs() {
    return { ...this.#changedIDs };
  }

  async addChangedID(id, when) {
    this.#changedIDs[id] = when;
    return true;
  }

  async removeChangedID(...ids) {
    for (const id of ids) {
      delete this.#changedIDs[id];
    }
    return true;
  }

  clearChangedIDs() {
    this.#changedIDs = {};
  }
}

/**
 * Sync engine entrypoint that wires the Workspaces record, store, and tracker
 * implementations into Firefox Sync.
 */
export class ZenWorkspacesEngine extends SyncEngine {
  static get name() {
    return WORKSPACES_ENGINE_NAME;
  }

  constructor(service) {
    super(WORKSPACES_ENGINE_NAME, service);
  }

  get _storeObj() {
    return ZenWorkspacesStore;
  }

  get _trackerObj() {
    return ZenWorkspacesTracker;
  }

  get _recordObj() {
    return ZenWorkspacesRecord;
  }

  get version() {
    return 3;
  }

  get syncPriority() {
    return 8;
  }

  get allowSkippedRecord() {
    return false;
  }
}
