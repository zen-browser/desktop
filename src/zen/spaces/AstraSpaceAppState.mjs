/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Profile-local Space ↔ App Hub pin mapping (schema v1).
 * Stores references only — never duplicates app records or favicon payloads.
 */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  JSONFile: "resource://gre/modules/JSONFile.sys.mjs",
});

import {
  isValidSpaceUuid,
  sanitizeSpacePins,
} from "resource:///modules/zen/AstraSpaceIntegrity.mjs";

export const SPACE_APP_STATE_VERSION = 1;
export const SPACE_APP_STATE_FILE = "astra-space-app-state.json";
export const SPACE_APP_STATE_CHANGED = "astra-space-app-state-changed";
export const MAX_PINS_PER_SPACE = 24;

/** Suggested App Hub ids for Space presets (pin suggestions only). */
export const PRESET_PIN_SUGGESTIONS = Object.freeze({
  study: ["classroom", "google-drive", "google-docs", "google-meet", "swayam"],
  work: ["gmail", "outlook", "ms-teams", "slack", "google-drive", "notion"],
  personal: ["gmail", "google-drive", "youtube", "spotify"],
  fun: ["youtube", "spotify", "netflix", "jiosaavn"],
  banking: ["digilocker", "income-tax", "gst-portal", "epfo"],
});

function defaultState() {
  return {
    schemaVersion: SPACE_APP_STATE_VERSION,
    spacePins: {},
  };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, state: defaultState(), reason: "invalid" };
  }
  const version = raw.schemaVersion;
  if (version !== SPACE_APP_STATE_VERSION && version !== undefined && version !== null) {
    if (version === 0 || version === 1) {
      // accept
    } else {
      return { ok: false, state: defaultState(), reason: "unsupported-schema" };
    }
  }
  return {
    ok: true,
    migrated: version !== SPACE_APP_STATE_VERSION,
    state: {
      schemaVersion: SPACE_APP_STATE_VERSION,
      spacePins: sanitizeSpacePins(raw.spacePins || {}, {
        maxPinsPerSpace: MAX_PINS_PER_SPACE,
      }),
    },
  };
}

class AstraSpaceAppStateStore {
  #file = null;
  #data = defaultState();
  #loaded = false;
  #loadPromise = null;
  #dirty = false;
  #revision = 0;
  #writeQueue = Promise.resolve();

  get path() {
    return PathUtils.join(PathUtils.profileDir, SPACE_APP_STATE_FILE);
  }

  get revision() {
    return this.#revision;
  }

  get data() {
    return this.#data;
  }

  async load() {
    if (this.#loaded) {
      return this.#data;
    }
    if (this.#loadPromise) {
      return this.#loadPromise;
    }
    this.#loadPromise = this.#loadInternal();
    try {
      return await this.#loadPromise;
    } finally {
      this.#loadPromise = null;
    }
  }

  async #loadInternal() {
    try {
      if (!(await IOUtils.exists(this.path))) {
        this.#data = defaultState();
        this.#loaded = true;
        return this.#data;
      }
      this.#file = new lazy.JSONFile({
        path: this.path,
        backupTo: `${this.path}.bak`,
      });
      await this.#file.load();
      const result = normalizeState(this.#file.data);
      this.#data = result.state;
      this.#loaded = true;
      if (result.migrated || !result.ok) {
        this.#dirty = true;
        await this.#persist({ notify: false });
      }
      return this.#data;
    } catch (error) {
      console.warn("[AstraSpaceAppState] load failed; using defaults");
      this.#data = defaultState();
      this.#loaded = true;
      return this.#data;
    }
  }

  getSnapshot() {
    return JSON.parse(JSON.stringify(this.#data));
  }

  async #enqueue(task) {
    const run = this.#writeQueue.then(task, task);
    this.#writeQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async #persist({ notify = true } = {}) {
    if (!this.#dirty) {
      return;
    }
    try {
      if (!this.#file) {
        this.#file = new lazy.JSONFile({
          path: this.path,
          backupTo: `${this.path}.bak`,
        });
        this.#file.data = {};
      }
      this.#file.data = this.getSnapshot();
      await this.#file._save();
      this.#dirty = false;
      this.#revision += 1;
      if (notify) {
        try {
          Services.obs.notifyObservers(
            null,
            SPACE_APP_STATE_CHANGED,
            String(this.#revision)
          );
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error("[AstraSpaceAppState] save failed");
    }
  }

  async update(mutator, { privateWindow = false } = {}) {
    if (privateWindow) {
      return this.#data;
    }
    await this.load();
    return this.#enqueue(async () => {
      const next = this.getSnapshot();
      const maybe = await mutator(next);
      const candidate = maybe && typeof maybe === "object" ? maybe : next;
      const result = normalizeState(candidate);
      if (!result.ok) {
        throw new Error(result.reason || "invalid");
      }
      if (JSON.stringify(this.#data) === JSON.stringify(result.state)) {
        return this.#data;
      }
      this.#data = result.state;
      this.#dirty = true;
      await this.#persist({ notify: true });
      return this.#data;
    });
  }

  async getPinsForSpace(spaceId) {
    await this.load();
    if (!isValidSpaceUuid(spaceId)) {
      return [];
    }
    return [...(this.#data.spacePins[spaceId] || [])];
  }

  async pinApp(spaceId, appId, { privateWindow = false } = {}) {
    if (!isValidSpaceUuid(spaceId) || typeof appId !== "string" || !appId) {
      return this.#data;
    }
    return this.update(
      state => {
        const list = [...(state.spacePins[spaceId] || [])];
        if (!list.includes(appId) && list.length < MAX_PINS_PER_SPACE) {
          list.push(appId);
        }
        state.spacePins[spaceId] = list;
        return state;
      },
      { privateWindow }
    );
  }

  async unpinApp(spaceId, appId, { privateWindow = false } = {}) {
    if (!isValidSpaceUuid(spaceId) || typeof appId !== "string") {
      return this.#data;
    }
    return this.update(
      state => {
        const list = (state.spacePins[spaceId] || []).filter(id => id !== appId);
        if (list.length) {
          state.spacePins[spaceId] = list;
        } else {
          delete state.spacePins[spaceId];
        }
        return state;
      },
      { privateWindow }
    );
  }

  async removeSpacePins(spaceId, { privateWindow = false } = {}) {
    if (!isValidSpaceUuid(spaceId)) {
      return this.#data;
    }
    return this.update(
      state => {
        delete state.spacePins[spaceId];
        return state;
      },
      { privateWindow }
    );
  }

  async removeAppFromAllSpaces(appId, { privateWindow = false } = {}) {
    if (typeof appId !== "string" || !appId) {
      return this.#data;
    }
    return this.update(
      state => {
        for (const spaceId of Object.keys(state.spacePins)) {
          state.spacePins[spaceId] = state.spacePins[spaceId].filter(
            id => id !== appId
          );
          if (!state.spacePins[spaceId].length) {
            delete state.spacePins[spaceId];
          }
        }
        return state;
      },
      { privateWindow }
    );
  }

  async pruneInvalidSpaces(validSpaceIds, { privateWindow = false } = {}) {
    // Cross-compartment-safe: Object.prototype.toString, not instanceof Set.
    const valid =
      validSpaceIds != null &&
      typeof validSpaceIds === "object" &&
      Object.prototype.toString.call(validSpaceIds) === "[object Set]"
        ? validSpaceIds
        : new Set(validSpaceIds || []);
    return this.update(
      state => {
        state.spacePins = sanitizeSpacePins(state.spacePins, {
          validSpaceIds: valid,
          maxPinsPerSpace: MAX_PINS_PER_SPACE,
        });
        return state;
      },
      { privateWindow }
    );
  }

  /** Export omits nothing sensitive — pins are ids only. Import merges conservatively. */
  buildExportPayload() {
    return {
      schemaVersion: SPACE_APP_STATE_VERSION,
      spacePins: this.getSnapshot().spacePins,
    };
  }
}

export const gAstraSpaceAppState = new AstraSpaceAppStateStore();
