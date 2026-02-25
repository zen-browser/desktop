import { CryptoWrapper } from "resource://services-sync/record.sys.mjs";
import { Store, Tracker, SyncEngine } from "resource://services-sync/engines.sys.mjs";
import { ZenSessionStore } from "resource:///modules/zen/ZenSessionManager.sys.mjs";

export function ZenWorkspacesRecord(collection, id) {
  CryptoWrapper.call(this, collection, id);
}

ZenWorkspacesRecord.prototype = {
  _logName: "Sync.Record.ZenWorkspaces",
};
Object.setPrototypeOf(ZenWorkspacesRecord.prototype, CryptoWrapper.prototype);

export function ZenWorkspacesStore(name, engine) {
  Store.call(this, name, engine);
}

ZenWorkspacesStore.prototype = {
  _logName: "Sync.Store.ZenWorkspaces",

  async getAllIDs() {
    const ids = {};

    for (const space of ZenSessionStore.spaces) {
      ids[space.uuid] = true;
    }

    for (const folder of ZenSessionStore.folders) {
      ids[folder.id] = true;
    }

    for (const tab of ZenSessionStore.tabs) {
      if (tab.zenSyncId) {
        ids[tab.zenSyncId] = true;
      }
    }

    return ids;
  },

  async createRecord(id, collection) {
    const record = new ZenWorkspacesRecord(collection, id);

    const space = ZenSessionStore.spaces.find((s) => s.uuid === id);
    if (space) {
      record.cleartext = { ...space, type: "space" };
      this._log.debug("createRecord", record);
      return record;
    }

    const tab = ZenSessionStore.tabs.find((t) => t.zenSyncId === id);
    if (tab) {
      record.cleartext = { ...tab, type: "tab" };
      this._log.debug("createRecord", record);
      return record;
    }

    const folder = ZenSessionStore.folders.find((f) => f.id === id);
    if (folder) {
      record.cleartext = { ...folder, type: "folder" };
      this._log.debug("createRecord", record);
      return record;
    }

    record.deleted = true;
    this._log.debug("createRecord (tombstone)", record);
    return record;
  },

  async itemExists(id) {
    return id in (await this.getAllIDs());
  },

  _resolveType(record) {
    const type = record.cleartext?.type;
    if (type) {
      return type;
    }
    const id = record.id;
    if (ZenSessionStore.spaces.some((s) => s.uuid === id)) {
      return "space";
    }
    if (ZenSessionStore.tabs.some((t) => t.zenSyncId === id)) {
      return "tab";
    }
    if (ZenSessionStore.folders.some((f) => f.id === id)) {
      return "folder";
    }
    return null;
  },

  async _upsert(record) {
    const type = record.cleartext.type;
    this._log.debug("_upsert", type, record);

    switch (type) {
      case "space": {
        const spaces = ZenSessionStore.spaces;
        const existingIndex = spaces.findIndex((s) => s.uuid === record.cleartext.uuid);
        if (existingIndex !== -1) {
          spaces[existingIndex] = { ...spaces[existingIndex], ...record.cleartext };
        } else {
          spaces.push(record.cleartext);
        }

        this.engine._tracker.ignoreAll = true;
        try {
          await ZenSessionStore.updateSyncedSpaces(spaces, true);
        } finally {
          this.engine._tracker.ignoreAll = false;
        }
        return;
      }

      case "tab": {
        const tabs = ZenSessionStore.tabs;
        const existingIndex = tabs.findIndex((t) => t.zenSyncId === record.cleartext.zenSyncId);
        if (existingIndex !== -1) {
          tabs[existingIndex] = { ...tabs[existingIndex], ...record.cleartext };
        } else {
          tabs.push(record.cleartext);
        }

        this.engine._tracker.ignoreAll = true;
        try {
          await ZenSessionStore.updateSyncedTabs(tabs, true);
        } finally {
          this.engine._tracker.ignoreAll = false;
        }
        return;
      }

      case "folder": {
        const folders = ZenSessionStore.folders;
        const existingIndex = folders.findIndex((f) => f.id === record.cleartext.id);
        if (existingIndex !== -1) {
          folders[existingIndex] = { ...folders[existingIndex], ...record.cleartext };
        } else {
          folders.push(record.cleartext);
        }

        this.engine._tracker.ignoreAll = true;
        try {
          await ZenSessionStore.updateSyncedFolders(folders, true);
        } finally {
          this.engine._tracker.ignoreAll = false;
        }
      }
    }
  },

  async create(record) {
    return this._upsert(record);
  },

  async update(record) {
    return this._upsert(record);
  },

  async remove(record) {
    this._log.debug("remove", record);

    const type = this._resolveType(record);
    const id = record.id;

    switch (type) {
      case "space": {
        const spaces = ZenSessionStore.spaces.filter((s) => s.uuid !== id);
        this.engine._tracker.ignoreAll = true;
        try {
          await ZenSessionStore.updateSyncedSpaces(spaces, true);
        } finally {
          this.engine._tracker.ignoreAll = false;
        }
        break;
      }
      case "tab": {
        const tabs = ZenSessionStore.tabs.filter((t) => t.zenSyncId !== id);
        this.engine._tracker.ignoreAll = true;
        try {
          await ZenSessionStore.updateSyncedTabs(tabs, true);
        } finally {
          this.engine._tracker.ignoreAll = false;
        }
        break;
      }
      case "folder": {
        const folders = ZenSessionStore.folders.filter((f) => f.id !== id);
        this.engine._tracker.ignoreAll = true;
        try {
          await ZenSessionStore.updateSyncedFolders(folders, true);
        } finally {
          this.engine._tracker.ignoreAll = false;
        }
        break;
      }
      default:
        this._log.warn("remove: could not resolve type for id", id);
    }
  },

  async wipe() {
    this.engine._tracker.ignoreAll = true;
    try {
      await ZenSessionStore.updateSyncedData({ spaces: [], tabs: [], folders: [] }, true);
    } finally {
      this.engine._tracker.ignoreAll = false;
    }
  },

  async changeItemID(oldID, newID) {
    const tabs = ZenSessionStore.tabs.map((tab) => {
      if (tab.zenSyncId === oldID) {
        return { ...tab, zenSyncId: newID };
      }
      return tab;
    });

    const spaces = ZenSessionStore.spaces.map((space) => {
      if (space.uuid === oldID) {
        return { ...space, uuid: newID };
      }
      return space;
    });

    const folders = ZenSessionStore.folders.map((folder) => {
      if (folder.id === oldID) {
        return { ...folder, id: newID };
      }
      return folder;
    });

    this.engine._tracker.ignoreAll = true;
    try {
      await ZenSessionStore.updateSyncedData(
        {
          spaces,
          tabs,
          folders,
        },
        true
      );
    } finally {
      this.engine._tracker.ignoreAll = false;
    }
  },
};
Object.setPrototypeOf(ZenWorkspacesStore.prototype, Store.prototype);

export function ZenWorkspacesTracker(name, engine) {
  Tracker.call(this, name, engine);
}
ZenWorkspacesTracker.prototype = {
  _logName: "Sync.Tracker.ZenWorkspaces",

  onStart() {
    Services.obs.addObserver(this, "ZenWorkspaceDataChanged");
  },

  onStop() {
    Services.obs.removeObserver(this, "ZenWorkspaceDataChanged");
  },

  async observe(subject, topic, data) {
    this._log.debug("observe", topic, data);

    if (this.ignoreAll) {
      return;
    }

    switch (topic) {
      case "ZenWorkspaceDataChanged":
        this.score += 15;
        break;
    }
  },
};
Object.setPrototypeOf(ZenWorkspacesTracker.prototype, Tracker.prototype);

export function ZenWorkspacesEngine(service) {
  SyncEngine.call(this, "Zen-Workspaces", service);
}
ZenWorkspacesEngine.prototype = {
  _logName: "Sync.Engine.ZenWorkspaces",
  _storeObj: ZenWorkspacesStore,
  _trackerObj: ZenWorkspacesTracker,
  _recordObj: ZenWorkspacesRecord,
  version: 4,

  get prefName() {
    return "workspaces";
  },
};
Object.setPrototypeOf(ZenWorkspacesEngine.prototype, SyncEngine.prototype);

export const ZenWorkspacesSync = {
  init() {
    const { Weave } = ChromeUtils.importESModule("resource://services-sync/main.sys.mjs");
    Weave.Service.engineManager.register(ZenWorkspacesEngine);
  },
};
