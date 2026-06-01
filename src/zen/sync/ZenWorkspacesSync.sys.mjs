/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  Store,
  SyncEngine,
  Tracker,
} from "resource://services-sync/engines.sys.mjs";
import { CryptoWrapper } from "resource://services-sync/record.sys.mjs";
import { SCORE_INCREMENT_XLARGE } from "resource://services-sync/constants.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenSyncStore: "resource:///modules/zen/ZenSyncManager.sys.mjs",
  ContextualIdentityService:
    "resource://gre/modules/ContextualIdentityService.sys.mjs",
});

const RECORD_ID_PREFIX_BY_TYPE = Object.freeze({
  space: "s",
  container: "c",
});

const RECORD_TYPE_BY_PREFIX = Object.freeze({
  s: "space",
  c: "container",
});

/**
 * Sync record wrapper for workspace and container items stored in the
 * Workspaces engine collection.
 */
export class ZenWorkspacesRecord extends CryptoWrapper {
  _logName = "Sync.Record.ZenWorkspaces";
}

ZenWorkspacesRecord.prototype.type = "workspaces";

function parseRecordId(id) {
  const sep = id.indexOf("~");
  if (sep === -1) {
    return null;
  }
  const prefix = id.slice(0, sep);
  const key = id.slice(sep + 1);
  return { type: RECORD_TYPE_BY_PREFIX[prefix] || prefix, key };
}

function createRecordId(type, id) {
  const prefix = RECORD_ID_PREFIX_BY_TYPE[type];
  if (!prefix) {
    throw new Error(`Unknown Workspaces Sync record type: ${type}`);
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
        ids[createRecordId("space", space.uuid)] = true;
      }
    }

    for (const c of lazy.ContextualIdentityService.getPublicIdentities()) {
      ids[createRecordId("container", c.userContextId)] = true;
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
      case "space":
        return (sidebar.spaces || []).some(s => s.uuid === parsed.key);
      case "container":
        return lazy.ContextualIdentityService.getPublicIdentities().some(
          c => String(c.userContextId) === parsed.key
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
      case "space": {
        const spaces = sidebar.spaces || [];
        const idx = spaces.findIndex(s => s.uuid === parsed.key);
        if (idx === -1) {
          record.deleted = true;
          return record;
        }
        const rest = { ...spaces[idx] };
        delete rest.syncStatus;
        record.cleartext = { id, type: "space", ...rest, position: idx };
        break;
      }

      case "container": {
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
          type: "container",
          userContextId: container.userContextId,
          name: container.name,
          icon: container.icon,
          color: container.color,
        };
        break;
      }

      default:
        record.deleted = true;
    }

    return record;
  }

  async applyIncomingBatch(records, _countTelemetry) {
    const pulled = { spaces: [], containers: [] };
    const removals = { spaces: [], containers: [] };

    for (const record of records) {
      if (record.deleted) {
        this._collectRemoval(record.id, removals);
        continue;
      }
      const data = record.cleartext;
      if (!data?.type) {
        continue;
      }
      const clean = stripSyncFields(data);
      switch (data.type) {
        case "space":
          pulled.spaces.push(clean);
          break;
        case "container":
          pulled.containers.push(clean);
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
      case "space":
        removals.spaces.push({ uuid: parsed.key });
        break;
      case "container": {
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
        const removals = { spaces: [], containers: [] };
        this._collectRemoval(record.id, removals);
        await lazy.ZenSyncStore.applyIncomingBatch(
          { spaces: [], containers: [] },
          removals
        );
        return;
      }
      const data = record.cleartext;
      if (!data?.type) {
        return;
      }
      const clean = stripSyncFields(data);
      const pulled = { spaces: [], containers: [] };
      switch (data.type) {
        case "space":
          pulled.spaces.push(clean);
          break;
        case "container":
          pulled.containers.push(clean);
          break;
      }
      await lazy.ZenSyncStore.applyIncomingBatch(pulled, {
        spaces: [],
        containers: [],
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
    Services.obs.addObserver(this, "zen-workspace-item-changed");
    Services.obs.addObserver(this, "contextual-identity-created");
    Services.obs.addObserver(this, "contextual-identity-updated");
    Services.obs.addObserver(this, "contextual-identity-deleted");
  }

  onStop() {
    Services.obs.removeObserver(this, "zen-workspace-item-changed");
    Services.obs.removeObserver(this, "contextual-identity-created");
    Services.obs.removeObserver(this, "contextual-identity-updated");
    Services.obs.removeObserver(this, "contextual-identity-deleted");
  }

  observe(subject, topic, _data) {
    if (this.#ignoreAll) {
      return;
    }
    if (topic === "zen-workspace-item-changed") {
      const type = subject?.wrappedJSObject?.type;
      const id = subject?.wrappedJSObject?.id;
      if (type && id) {
        this._trackChange({ type, id });
      }
    } else if (topic.startsWith("contextual-identity-")) {
      const id = subject?.wrappedJSObject?.userContextId;
      if (id && normalizeUserContextId(id) !== null) {
        this._trackChange({ type: "container", id });
      }
    }
  }

  _trackChange(data) {
    if (data.type && data.id) {
      const id = createRecordId(data.type, data.id);
      this.#changedIDs[id] = Date.now() / 1000;
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
    return "Workspaces";
  }

  constructor(service) {
    super("Workspaces", service);
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
    return 2;
  }

  get syncPriority() {
    return 8;
  }

  get allowSkippedRecord() {
    return false;
  }
}
