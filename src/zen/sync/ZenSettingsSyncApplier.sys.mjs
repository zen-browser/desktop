/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  RECORD_KINDS,
  syncLog,
  ZenSettingsSyncModel,
} from "resource:///modules/zen/ZenSettingsSyncModel.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  CustomKeys: "moz-src:///browser/components/customkeys/CustomKeys.sys.mjs",
});

const SHORTCUT_PREFIX = "shortcut:";

/**
 * Reconciles incoming settings records into the live browser. Unknown kinds are
 * left unacknowledged (not applied, not failed) so a newer client's records
 * survive a round-trip through an older one.
 */
class nsZenSettingsSyncApplier {
  /**
   * @param {object[]} records decrypted incoming records.
   * @returns {Promise<string[]>} ids that failed to apply (redelivered later).
   */
  async applyBatch(records) {
    const failed = [];
    const applied = [];

    for (const record of records) {
      if (typeof record.id !== "string" || !record.id) {
        continue;
      }
      try {
        if (this.#applyRecord(record)) {
          applied.push(record);
        }
      } catch (e) {
        console.error(`ZenSettingsSync: failed to apply ${record.id}:`, e);
        failed.push(record.id);
      }
    }

    // Stamp applied records as already-uploaded so the outgoing diff in this
    // same sync doesn't treat them as local changes and echo them back.
    if (applied.length) {
      ZenSettingsSyncModel.noteApplied(applied);
    }
    syncLog(
      `incoming batch: ${applied.length} applied, ${failed.length} failed`
    );
    return failed;
  }

  /**
   * @param {object} record a decrypted incoming record.
   * @returns {boolean} true if the record was handled (applied or tombstoned),
   *   false if its kind is unknown and it should stay unacknowledged.
   */
  #applyRecord(record) {
    if (record.id.startsWith(SHORTCUT_PREFIX)) {
      this.#applyShortcut(record);
      return true;
    }
    // Unknown kind (e.g. a newer client's mod/custom-css record): ignore.
    return false;
  }

  #applyShortcut(record) {
    const keyId = record.id.slice(SHORTCUT_PREFIX.length);
    if (!keyId) {
      return;
    }
    if (record.deleted) {
      // The shortcut was reset to its default on another device.
      lazy.CustomKeys.resetKey(keyId);
      return;
    }
    const data = record.cleartext?.data;
    if (!data || record.cleartext?.kind !== RECORD_KINDS.SHORTCUT) {
      return;
    }
    // An empty binding means the shortcut was cleared (does nothing); changeKey
    // with {} preserves that state.
    lazy.CustomKeys.changeKey(keyId, {
      modifiers: data.modifiers,
      key: data.key,
      keycode: data.keycode,
    });
  }
}

export const ZenSettingsSyncApplier = new nsZenSettingsSyncApplier();
