// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var { Tracker, Store, SyncEngine } = ChromeUtils.importESModule(
  'resource://services-sync/engines.sys.mjs'
);
var { CryptoWrapper } = ChromeUtils.importESModule('resource://services-sync/record.sys.mjs');
var { Utils } = ChromeUtils.importESModule('resource://services-sync/util.sys.mjs');
var { SCORE_INCREMENT_XLARGE } = ChromeUtils.importESModule(
  'resource://services-sync/constants.sys.mjs'
);

// Define ZenPinnedTabRecord
function ZenPinnedTabRecord(collection, id) {
  CryptoWrapper.call(this, collection, id);
}

ZenPinnedTabRecord.prototype = Object.create(CryptoWrapper.prototype);
ZenPinnedTabRecord.prototype.constructor = ZenPinnedTabRecord;

ZenPinnedTabRecord.prototype._logName = 'Sync.Record.ZenPinnedTab';

Utils.deferGetSet(ZenPinnedTabRecord, 'cleartext', [
  'title',
  'url',
  'containerTabId',
  'workspaceUuid',
  'position',
  'isEssential',
  'isGroup',
  'parentUuid',
  'editedTitle',
  'folderIcon',
  'isFolderCollapsed',
]);

// Define ZenPinnedTabsStore
function ZenPinnedTabsStore(name, engine) {
  Store.call(this, name, engine);
}

ZenPinnedTabsStore.prototype = Object.create(Store.prototype);
ZenPinnedTabsStore.prototype.constructor = ZenPinnedTabsStore;

/**
 * Initializes the store by loading the current changeset.
 */
ZenPinnedTabsStore.prototype.initialize = async function () {
  await Store.prototype.initialize.call(this);
  // Additional initialization if needed
};

/**
 * Retrieves all pinned tab IDs from the storage.
 * @returns {Object} An object mapping pinned tab UUIDs to true.
 */
ZenPinnedTabsStore.prototype.getAllIDs = async function () {
  try {
    const pins = await ZenPinnedTabsStorage.getPins();
    const ids = {};
    for (const pin of pins) {
      ids[pin.uuid] = true;
    }
    return ids;
  } catch (error) {
    this._log.error('Error fetching all pinned tab IDs', error);
    throw error;
  }
};

/**
 * Handles changing the ID of a pinned tab.
 * @param {String} oldID - The old UUID.
 * @param {String} newID - The new UUID.
 */
ZenPinnedTabsStore.prototype.changeItemID = async function (oldID, newID) {
  try {
    const pins = await ZenPinnedTabsStorage.getPins();
    const pin = pins.find((p) => p.uuid === oldID);
    if (pin) {
      pin.uuid = newID;
      await ZenPinnedTabsStorage.savePin(pin, false);
      // Mark the new ID as changed for sync
      await ZenPinnedTabsStorage.markChanged(newID);
    }
  } catch (error) {
    this._log.error(`Error changing pinned tab ID from ${oldID} to ${newID}`, error);
    throw error;
  }
};

/**
 * Checks if a pinned tab exists.
 * @param {String} id - The UUID of the pinned tab.
 * @returns {Boolean} True if the pinned tab exists, false otherwise.
 */
ZenPinnedTabsStore.prototype.itemExists = async function (id) {
  try {
    const pins = await ZenPinnedTabsStorage.getPins();
    return pins.some((p) => p.uuid === id);
  } catch (error) {
    this._log.error(`Error checking if pinned tab exists with ID ${id}`, error);
    throw error;
  }
};

/**
 * Creates a record for a pinned tab.
 * @param {String} id - The UUID of the pinned tab.
 * @param {String} collection - The collection name.
 * @returns {ZenPinnedTabRecord} The pinned tab record.
 */
ZenPinnedTabsStore.prototype.createRecord = async function (id, collection) {
  try {
    const pins = await ZenPinnedTabsStorage.getPins();
    const pin = pins.find((p) => p.uuid === id);
    const record = new ZenPinnedTabRecord(collection, id);

    if (pin) {
      record.title = pin.title;
      record.url = pin.url || '';
      record.containerTabId = pin.containerTabId || 0;
      record.workspaceUuid = pin.workspaceUuid || null;
      record.position = pin.position;
      record.isEssential = pin.isEssential || false;
      record.isGroup = pin.isGroup || false;
      record.parentUuid = pin.parentUuid || null;
      record.editedTitle = pin.editedTitle || false;
      record.folderIcon = pin.folderIcon || null;
      record.isFolderCollapsed = pin.isFolderCollapsed || false;
      record.deleted = false;
    } else {
      record.deleted = true;
    }

    return record;
  } catch (error) {
    this._log.error(`Error creating record for pinned tab ID ${id}`, error);
    throw error;
  }
};

/**
 * Creates a new pinned tab.
 * @param {ZenPinnedTabRecord} record - The pinned tab record to create.
 */
ZenPinnedTabsStore.prototype.create = async function (record) {
  try {
    this._validateRecord(record);
    const pin = {
      uuid: record.id,
      title: record.title,
      url: record.url,
      containerTabId: record.containerTabId,
      workspaceUuid: record.workspaceUuid,
      position: record.position,
      isEssential: record.isEssential,
      isGroup: record.isGroup,
      parentUuid: record.parentUuid,
      editedTitle: record.editedTitle,
      folderIcon: record.folderIcon,
      isFolderCollapsed: record.isFolderCollapsed,
    };
    await ZenPinnedTabsStorage.savePin(pin, false);
  } catch (error) {
    this._log.error(`Error creating pinned tab with ID ${record.id}`, error);
    throw error;
  }
};

/**
 * Updates an existing pinned tab.
 * @param {ZenPinnedTabRecord} record - The pinned tab record to update.
 */
ZenPinnedTabsStore.prototype.update = async function (record) {
  try {
    this._validateRecord(record);
    await this.create(record); // Reuse create for update
  } catch (error) {
    this._log.error(`Error updating pinned tab with ID ${record.id}`, error);
    throw error;
  }
};

/**
 * Removes a pinned tab.
 * @param {ZenPinnedTabRecord} record - The pinned tab record to remove.
 */
ZenPinnedTabsStore.prototype.remove = async function (record) {
  try {
    await ZenPinnedTabsStorage.removePin(record.id, false);
  } catch (error) {
    this._log.error(`Error removing pinned tab with ID ${record.id}`, error);
    throw error;
  }
};

/**
 * Wipes all pinned tabs from the storage.
 */
ZenPinnedTabsStore.prototype.wipe = async function () {
  try {
    await ZenPinnedTabsStorage.wipeAllPins();
  } catch (error) {
    this._log.error('Error wiping all pinned tabs', error);
    throw error;
  }
};

/**
 * Validates a pinned tab record.
 * @param {ZenPinnedTabRecord} record - The pinned tab record to validate.
 */
ZenPinnedTabsStore.prototype._validateRecord = function (record) {
  if (!record.id || typeof record.id !== 'string') {
    throw new Error('Invalid pinned tab ID');
  }
  if (!record.title || typeof record.title !== 'string') {
    throw new Error(`Invalid pinned tab title for ID ${record.id}`);
  }
  if (record.url != null && typeof record.url !== 'string') {
    throw new Error(`Invalid URL for pinned tab ID ${record.id}`);
  }
  if (record.containerTabId != null && typeof record.containerTabId !== 'number') {
    throw new Error(`Invalid containerTabId for pinned tab ID ${record.id}`);
  }
  if (record.workspaceUuid != null && typeof record.workspaceUuid !== 'string') {
    throw new Error(`Invalid workspaceUuid for pinned tab ID ${record.id}`);
  }
  if (record.position != null && typeof record.position !== 'number') {
    throw new Error(`Invalid position for pinned tab ID ${record.id}`);
  }
  if (typeof record.isEssential !== 'boolean') {
    record.isEssential = false;
  }
  if (typeof record.isGroup !== 'boolean') {
    record.isGroup = false;
  }
  if (record.parentUuid != null && typeof record.parentUuid !== 'string') {
    throw new Error(`Invalid parentUuid for pinned tab ID ${record.id}`);
  }
  if (typeof record.editedTitle !== 'boolean') {
    record.editedTitle = false;
  }
  if (record.folderIcon != null && typeof record.folderIcon !== 'string') {
    throw new Error(`Invalid folderIcon for pinned tab ID ${record.id}`);
  }
  if (typeof record.isFolderCollapsed !== 'boolean') {
    record.isFolderCollapsed = false;
  }
};

/**
 * Retrieves changed pinned tab IDs since the last sync.
 * @returns {Object} An object mapping pinned tab UUIDs to their change timestamps.
 */
ZenPinnedTabsStore.prototype.getChangedIDs = async function () {
  try {
    return await ZenPinnedTabsStorage.getChangedIDs();
  } catch (error) {
    this._log.error('Error retrieving changed IDs from storage', error);
    throw error;
  }
};

/**
 * Clears all recorded changes after a successful sync.
 */
ZenPinnedTabsStore.prototype.clearChangedIDs = async function () {
  try {
    await ZenPinnedTabsStorage.clearChangedIDs();
  } catch (error) {
    this._log.error('Error clearing changed IDs in storage', error);
    throw error;
  }
};

/**
 * Marks a pinned tab as changed.
 * @param {String} uuid - The UUID of the pinned tab that changed.
 */
ZenPinnedTabsStore.prototype.markChanged = async function (uuid) {
  try {
    await ZenPinnedTabsStorage.markChanged(uuid);
  } catch (error) {
    this._log.error(`Error marking pinned tab ${uuid} as changed`, error);
    throw error;
  }
};

/**
 * Finalizes the store by ensuring all pending operations are completed.
 */
ZenPinnedTabsStore.prototype.finalize = async function () {
  await Store.prototype.finalize.call(this);
};

// Define ZenPinnedTabsTracker
function ZenPinnedTabsTracker(name, engine) {
  Tracker.call(this, name, engine);
  this._ignoreAll = false;

  // Observe profile-before-change to stop the tracker gracefully
  Services.obs.addObserver(this.asyncObserver, 'profile-before-change');
}

ZenPinnedTabsTracker.prototype = Object.create(Tracker.prototype);
ZenPinnedTabsTracker.prototype.constructor = ZenPinnedTabsTracker;

/**
 * Retrieves changed pinned tab IDs by delegating to the store.
 * @returns {Object} An object mapping pinned tab UUIDs to their change timestamps.
 */
ZenPinnedTabsTracker.prototype.getChangedIDs = async function () {
  try {
    return await this.engine._store.getChangedIDs();
  } catch (error) {
    this._log.error('Error retrieving changed IDs from store', error);
    throw error;
  }
};

/**
 * Clears all recorded changes after a successful sync.
 */
ZenPinnedTabsTracker.prototype.clearChangedIDs = async function () {
  try {
    await this.engine._store.clearChangedIDs();
  } catch (error) {
    this._log.error('Error clearing changed IDs in store', error);
    throw error;
  }
};

/**
 * Called when the tracker starts. Registers observers to listen for pinned tab changes.
 */
ZenPinnedTabsTracker.prototype.onStart = function () {
  if (this._started) {
    return;
  }
  this._log.trace('Starting tracker');
  // Register observers for pinned tab changes
  Services.obs.addObserver(this.asyncObserver, 'zen-pin-added');
  Services.obs.addObserver(this.asyncObserver, 'zen-pin-removed');
  Services.obs.addObserver(this.asyncObserver, 'zen-pin-updated');
  this._started = true;
};

/**
 * Called when the tracker stops. Unregisters observers.
 */
ZenPinnedTabsTracker.prototype.onStop = function () {
  if (!this._started) {
    return;
  }
  this._log.trace('Stopping tracker');
  // Unregister observers for pinned tab changes
  Services.obs.removeObserver(this.asyncObserver, 'zen-pin-added');
  Services.obs.removeObserver(this.asyncObserver, 'zen-pin-removed');
  Services.obs.removeObserver(this.asyncObserver, 'zen-pin-updated');
  this._started = false;
};

/**
 * Handles observed events and marks pinned tabs as changed accordingly.
 * @param {nsISupports} subject - The subject of the notification.
 * @param {String} topic - The topic of the notification.
 * @param {String} data - Additional data (JSON stringified array of UUIDs).
 */
ZenPinnedTabsTracker.prototype.observe = async function (subject, topic, data) {
  if (this.ignoreAll) {
    return;
  }

  try {
    switch (topic) {
      case 'profile-before-change':
        await this.stop();
        break;
      case 'zen-pin-removed':
      case 'zen-pin-updated':
      case 'zen-pin-added': {
        let pinIDs;
        if (data) {
          try {
            pinIDs = JSON.parse(data);
            if (!Array.isArray(pinIDs)) {
              throw new Error('Parsed data is not an array');
            }
          } catch (parseError) {
            this._log.error(`Failed to parse pinned tab UUIDs from data: ${data}`, parseError);
            return;
          }
        } else {
          this._log.error(`No data received for event ${topic}`);
          return;
        }

        this._log.trace(`Observed ${topic} for UUIDs: ${pinIDs.join(', ')}`);

        // Process each UUID
        for (const pinID of pinIDs) {
          if (typeof pinID === 'string') {
            // Inform the store about the change
            await this.engine._store.markChanged(pinID);
          } else {
            this._log.warn(`Invalid pinned tab ID encountered: ${pinID}`);
          }
        }

        // Bump the score once after processing all changes
        if (pinIDs.length > 0) {
          this.score += SCORE_INCREMENT_XLARGE;
        }
        break;
      }
    }
  } catch (error) {
    this._log.error(`Error handling ${topic} in observe method`, error);
  }
};

/**
 * Finalizes the tracker by ensuring all pending operations are completed.
 */
ZenPinnedTabsTracker.prototype.finalize = async function () {
  await Tracker.prototype.finalize.call(this);
};

// Define ZenPinnedTabsEngine
function ZenPinnedTabsEngine(service) {
  SyncEngine.call(this, 'PinnedTabs', service);
}

ZenPinnedTabsEngine.prototype = Object.create(SyncEngine.prototype);
ZenPinnedTabsEngine.prototype.constructor = ZenPinnedTabsEngine;

ZenPinnedTabsEngine.prototype._storeObj = ZenPinnedTabsStore;
ZenPinnedTabsEngine.prototype._trackerObj = ZenPinnedTabsTracker;
ZenPinnedTabsEngine.prototype._recordObj = ZenPinnedTabRecord;
ZenPinnedTabsEngine.prototype.version = 1;

ZenPinnedTabsEngine.prototype.syncPriority = 11; // Sync after workspaces (priority 10)
ZenPinnedTabsEngine.prototype.allowSkippedRecord = false;

Object.setPrototypeOf(ZenPinnedTabsEngine.prototype, SyncEngine.prototype);
