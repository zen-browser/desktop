/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  CustomKeys: "moz-src:///browser/components/customkeys/CustomKeys.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "syncDebug",
  "zen.settings-sync.debug",
  false
);

/**
 * Debug logging for the whole settings-sync pipeline.
 *
 * @param {string} message
 * @param {...any} args
 */
export function syncLog(message, ...args) {
  if (lazy.syncDebug) {
    // eslint-disable-next-line no-console
    console.debug(`ZenSettingsSync: ${message}`, ...args);
  }
}

// Notification CustomKeys fires when a shortcut customization changes. The
// tracker listens for it to request a sync.
export const CUSTOM_KEYS_CHANGED_TOPIC = "zen-custom-keys-changed";

export const RECORD_KINDS = Object.freeze({
  SHORTCUT: "shortcut",
});

// Record ids are "<kind-prefix><native-id>" so one engine can carry several
// kinds without collisions (mods/custom-css follow in later work).
const SHORTCUT_PREFIX = "shortcut:";

const STORE_FILE_NAME = "zen-settings-sync.json";
const STORE_VERSION = 1;

function sortedClone(value) {
  if (Array.isArray(value)) {
    return value.map(sortedClone);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortedClone(value[key]);
    }
    return out;
  }
  return value === undefined ? null : value;
}

/**
 * Deterministic JSON serialization (recursively sorted keys), so that two
 * structurally equal payloads always stringify identically.
 *
 * @param {object} value
 */
export function canonicalJSON(value) {
  return JSON.stringify(sortedClone(value));
}

const textEncoder = new TextEncoder();

/**
 * Base64 SHA-256 digest of a record's canonical form. The uploaded-state
 * snapshot stores these digests instead of full payloads so change detection
 * is a cheap equality check.
 *
 * @param {string} kind
 * @param {object} data
 * @returns {string}
 */
export function recordDigest(kind, data) {
  const hasher = Cc["@mozilla.org/security/hash;1"].createInstance(
    Ci.nsICryptoHash
  );
  hasher.init(Ci.nsICryptoHash.SHA256);
  const bytes = textEncoder.encode(canonicalJSON({ kind, data }));
  hasher.update(bytes, bytes.length);
  return hasher.finish(/* base64 = */ true);
}

/**
 * Normalize a CustomKeys binding to the subset of fields we sync. Only one of
 * `key`/`keycode` is ever present; an empty object means "default cleared",
 * which is itself a customization worth syncing.
 *
 * @param {?object} binding
 * @returns {object}
 */
function normalizeBinding(binding) {
  const data = {};
  if (binding && typeof binding === "object") {
    if (binding.modifiers) {
      data.modifiers = binding.modifiers;
    }
    if (binding.key) {
      data.key = binding.key;
    }
    if (binding.keycode) {
      data.keycode = binding.keycode;
    }
  }
  return data;
}

/**
 * Owns the synced-settings model. Outgoing records are pure projections of the
 * live CustomKeys customizations; the uploaded-state snapshot (digests) drives
 * change detection, so only genuinely changed shortcuts are uploaded.
 */
class nsZenSettingsSyncModel {
  #store = null;
  #cache = null;

  #data() {
    if (!this.#store) {
      this.#store = new JSONFile({
        path: PathUtils.join(PathUtils.profileDir, STORE_FILE_NAME),
        dataPostProcessor: data => {
          if (data.version !== STORE_VERSION) {
            // Drop the uploaded snapshot so everything re-diffs against the
            // (also wiped) server.
            data.uploaded = {};
          }
          data.version = STORE_VERSION;
          data.uploaded ||= {};
          return data;
        },
      });
      this.#store.ensureDataReady();
    }
    return this.#store.data;
  }

  /**
   * Project the live CustomKeys state into a Map of recordId -> {kind, data}.
   * Reads from CustomKeys' in-memory snapshot (updated synchronously on every
   * change), so a record we just applied is immediately reflected here and is
   * never re-uploaded as a spurious local change.
   */
  #projection() {
    if (this.#cache) {
      return this.#cache;
    }
    const map = new Map();
    let shortcuts = {};
    try {
      shortcuts = lazy.CustomKeys.getAll() || {};
    } catch (e) {
      syncLog("failed to read CustomKeys state", e);
    }
    for (const [keyId, binding] of Object.entries(shortcuts)) {
      map.set(SHORTCUT_PREFIX + keyId, {
        kind: RECORD_KINDS.SHORTCUT,
        data: normalizeBinding(binding),
      });
    }
    this.#cache = map;
    return map;
  }

  invalidate() {
    this.#cache = null;
  }

  getAllRecordIds() {
    const ids = {};
    for (const id of this.#projection().keys()) {
      ids[id] = true;
    }
    // Ids we have uploaded before must still be enumerable so the engine can
    // generate tombstones once they disappear locally.
    for (const id of Object.keys(this.#data().uploaded)) {
      ids[id] = true;
    }
    return ids;
  }

  itemExists(id) {
    return this.#projection().has(id);
  }

  /**
   * @param {string} id
   * @returns {?{kind: string, data: object}} null for a deleted record.
   */
  projectRecord(id) {
    return this.#projection().get(id) || null;
  }

  /**
   * Ids whose current projection digest differs from the uploaded snapshot,
   * including tombstones for ids present in the snapshot but gone locally.
   *
   * @returns {{[key: string]: number}} recordId -> modified timestamp (seconds).
   */
  computeChangedIDs() {
    const projection = this.#projection();
    const uploaded = this.#data().uploaded;
    const changed = {};
    const now = Math.floor(Date.now() / 1000);
    for (const [id, { kind, data }] of projection) {
      if (uploaded[id] !== recordDigest(kind, data)) {
        changed[id] = now;
      }
    }
    for (const id of Object.keys(uploaded)) {
      if (!projection.has(id)) {
        changed[id] = now;
      }
    }
    return changed;
  }

  hasPendingChanges() {
    return !!Object.keys(this.computeChangedIDs()).length;
  }

  /**
   * Refresh the uploaded-state snapshot after records were written to the
   * server. A succeeded id that no longer projects is a tombstone we uploaded.
   *
   * @param {string[]} ids
   */
  markUploaded(ids) {
    if (!ids?.length) {
      return;
    }
    const data = this.#data();
    const projection = this.#projection();
    for (const id of ids) {
      const record = projection.get(id);
      if (record) {
        data.uploaded[id] = recordDigest(record.kind, record.data);
      } else {
        delete data.uploaded[id];
      }
    }
    this.#store.saveSoon();
  }

  /**
   * Record the digests of just-applied incoming records so the following
   * outgoing diff treats them as already-uploaded rather than local changes.
   *
   * @param {object[]} records decrypted incoming records (with .cleartext).
   */
  noteApplied(records) {
    const data = this.#data();
    for (const record of records) {
      if (record.deleted) {
        delete data.uploaded[record.id];
      } else {
        const ct = record.cleartext || {};
        data.uploaded[record.id] = recordDigest(ct.kind, ct.data);
      }
    }
    this.#store.saveSoon();
    this.invalidate();
  }
}

export const ZenSettingsSyncModel = new nsZenSettingsSyncModel();
