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
  SIDEBAR_COLLECTED_TOPIC,
  syncLog,
  ZenSpacesSyncModel,
} from "resource:///modules/zen/ZenSpacesSyncModel.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenSpacesSyncApplier: "resource:///modules/zen/ZenSpacesSyncApplier.sys.mjs",
});

const TRACKED_TOPICS = [
  SIDEBAR_COLLECTED_TOPIC,
  "contextual-identity-created",
  "contextual-identity-updated",
  "contextual-identity-deleted",
];

export class ZenSpacesSyncRecord extends CryptoWrapper {
  _logName = "Sync.Record.ZenSpaces";
}

ZenSpacesSyncRecord.prototype.type = "spaces";

/**
 * Store for the Spaces engine. Outgoing records are pure projections of
 * the session-store sidebar data; incoming batches are handed to the
 * applier, which reconciles them into the live browser.
 */
class ZenSpacesSyncStore extends Store {
  async getAllIDs() {
    return ZenSpacesSyncModel.getAllRecordIds();
  }

  async itemExists(id) {
    return ZenSpacesSyncModel.itemExists(id);
  }

  async createRecord(id, collection) {
    const record = new ZenSpacesSyncRecord(collection, id);
    const projected = ZenSpacesSyncModel.projectRecord(id);
    if (!projected) {
      record.deleted = true;
      return record;
    }
    record.cleartext = { id, kind: projected.kind, data: projected.data };
    return record;
  }

  async applyIncomingBatch(records, countTelemetry) {
    const failed = await lazy.ZenSpacesSyncApplier.applyBatch(records);
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
 * Tracker for the Spaces engine. There is no per-event bookkeeping: every
 * time fresh sidebar data is collected (or a container changes), the model
 * diffs the current projections against the last-uploaded snapshot; the
 * score is only bumped when something actually differs.
 */
class ZenSpacesSyncTracker extends Tracker {
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
    if (this.ignoreAll) {
      return;
    }
    if (topic !== SIDEBAR_COLLECTED_TOPIC) {
      ZenSpacesSyncModel.invalidate();
    }
    try {
      if (ZenSpacesSyncModel.hasPendingChanges()) {
        syncLog(`tracker: pending changes after ${topic}, requesting sync`);
        this.score += SCORE_INCREMENT_XLARGE;
      }
    } catch (e) {
      console.error("ZenSpacesSync: change detection failed:", e);
    }
  }
}

export class ZenSpacesSyncEngine extends SyncEngine {
  constructor(service) {
    super("Spaces", service);
  }

  get _storeObj() {
    return ZenSpacesSyncStore;
  }

  get _trackerObj() {
    return ZenSpacesSyncTracker;
  }

  get _recordObj() {
    return ZenSpacesSyncRecord;
  }

  get version() {
    return 3;
  }

  get syncPriority() {
    return 8;
  }

  get allowSkippedRecord() {
    // A record that persistently fails to upload is skipped; the snapshot
    // diff retries it on every following sync anyway.
    return true;
  }

  async getChangedIDs() {
    return ZenSpacesSyncModel.computeChangedIDs();
  }

  async _reconcile(item) {
    // Incoming records always apply, and any local divergence re-uploads afterwards
    // (see ZenSpacesSyncModel.noteApplied). The base reconciliation would
    // instead drop incoming changes whenever the id is also in the local
    // changed set, because the snapshot diff stamps its changes with "now"
    // and the local side would always win the age comparison.
    //
    // An id we accept must also leave the outgoing set. Projections only
    // reflect the applied state after the delayed session collection, so
    // uploading the id later in this same sync would overwrite the record
    // we just accepted with the stale pre-apply state (and the other
    // device would then apply that, endlessly trading states back and
    // forth). Divergence that survives the collection re-uploads on a
    // later sync through the snapshot diff.
    this._modified.delete(item.id);
    return true;
  }

  async trackRemainingChanges() {}

  async _onRecordsWritten(succeeded) {
    ZenSpacesSyncModel.markUploaded(succeeded);
  }
}
