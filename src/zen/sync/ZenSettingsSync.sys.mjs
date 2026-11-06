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
import {
  CUSTOM_KEYS_CHANGED_TOPIC,
  syncLog,
  ZenSettingsSyncModel,
} from "resource:///modules/zen/ZenSettingsSyncModel.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenSettingsSyncApplier:
    "resource:///modules/zen/ZenSettingsSyncApplier.sys.mjs",
});

const TRACKED_TOPICS = [CUSTOM_KEYS_CHANGED_TOPIC];

export class ZenSettingsSyncRecord extends CryptoWrapper {
  _logName = "Sync.Record.ZenSettings";
}

ZenSettingsSyncRecord.prototype.type = "zensettings";

/**
 * Store for the settings engine. Outgoing records are pure projections of the
 * model; incoming batches are handed to the applier.
 */
class ZenSettingsSyncStore extends Store {
  async getAllIDs() {
    return ZenSettingsSyncModel.getAllRecordIds();
  }

  async itemExists(id) {
    return ZenSettingsSyncModel.itemExists(id);
  }

  async createRecord(id, collection) {
    const record = new ZenSettingsSyncRecord(collection, id);
    const projected = ZenSettingsSyncModel.projectRecord(id);
    if (!projected) {
      record.deleted = true;
      return record;
    }
    record.cleartext = { id, kind: projected.kind, data: projected.data };
    return record;
  }

  async applyIncomingBatch(records, countTelemetry) {
    const failed = await lazy.ZenSettingsSyncApplier.applyBatch(records);
    for (const id of failed) {
      countTelemetry?.addIncomingFailedReason(`failed to apply ${id}`);
    }
    return failed;
  }

  async wipe() {
    // Never delete user data on an engine wipe.
  }

  async changeItemID() {}
}

/**
 * Tracker for the settings engine. CustomKeys fires a notification on every
 * customization change; the real changed set is computed from the snapshot
 * diff in getChangedIDs, so here we only bump the score to request a sync.
 */
class ZenSettingsSyncTracker extends Tracker {
  _ignoreAll = false;

  get ignoreAll() {
    return this._ignoreAll;
  }

  set ignoreAll(value) {
    this._ignoreAll = value;
  }

  onStart() {
    for (const topic of TRACKED_TOPICS) {
      Services.obs.addObserver(this, topic);
    }
  }

  onStop() {
    for (const topic of TRACKED_TOPICS) {
      Services.obs.removeObserver(this, topic);
    }
  }

  observe(subject, topic) {
    if (this.ignoreAll || !TRACKED_TOPICS.includes(topic)) {
      return;
    }
    ZenSettingsSyncModel.invalidate();
    try {
      if (ZenSettingsSyncModel.hasPendingChanges()) {
        syncLog(`tracker: pending changes after ${topic}, requesting sync`);
        this.score += SCORE_INCREMENT_XLARGE;
      }
    } catch (e) {
      console.error("ZenSettingsSync: change detection failed:", e);
    }
  }
}

export class ZenSettingsSyncEngine extends SyncEngine {
  constructor(service) {
    super("ZenSettings", service);
  }

  get _storeObj() {
    return ZenSettingsSyncStore;
  }

  get _trackerObj() {
    return ZenSettingsSyncTracker;
  }

  get _recordObj() {
    return ZenSettingsSyncRecord;
  }

  get version() {
    return 1;
  }

  get syncPriority() {
    return 10;
  }

  get allowSkippedRecord() {
    // A record that persistently fails to upload is skipped; the snapshot diff
    // retries it on every following sync anyway.
    return true;
  }

  async getChangedIDs() {
    return ZenSettingsSyncModel.computeChangedIDs();
  }

  async _reconcile(item) {
    // Incoming records always apply; any local divergence re-uploads on a later
    // sync through the snapshot diff. An id we accept must also leave the
    // outgoing set, or we'd overwrite the record we just accepted with the
    // pre-apply projection.
    this._modified.delete(item.id);
    return true;
  }

  async trackRemainingChanges() {}

  async _onRecordsWritten(succeeded) {
    ZenSettingsSyncModel.markUploaded(succeeded);
  }
}
