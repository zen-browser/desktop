/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Profile-local App Hub state foundation (shared across windows).
 * Writes only after an explicit mutation — never on bare load/startup.
 */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  JSONFile: "resource://gre/modules/JSONFile.sys.mjs",
});

const STATE_SCHEMA_VERSION = 1;
const STATE_FILE_NAME = "astra-app-hub-state.json";
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function defaultState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    favorites: [],
    hidden: [],
    categoryOrder: [],
    appOrder: {},
    collapsedCategories: [],
    recent: [],
    customApps: [],
  };
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasDangerousKey(obj) {
  if (!isPlainObject(obj)) {
    return false;
  }
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) {
      return true;
    }
  }
  return false;
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !entry || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    out.push(entry);
  }
  return out;
}

function sanitizeAppOrder(value) {
  if (!isPlainObject(value) || hasDangerousKey(value)) {
    return {};
  }
  const out = {};
  for (const [categoryId, ids] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(categoryId) || typeof categoryId !== "string") {
      continue;
    }
    out[categoryId] = sanitizeStringArray(ids);
  }
  return out;
}

/**
 * Validate and normalize on-disk / in-memory state.
 * Unknown keys are dropped. Invalid schema falls back to defaults.
 */
export function normalizeAppHubState(raw) {
  if (!isPlainObject(raw) || hasDangerousKey(raw)) {
    return defaultState();
  }
  if (raw.schemaVersion !== STATE_SCHEMA_VERSION) {
    return defaultState();
  }
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    favorites: sanitizeStringArray(raw.favorites),
    hidden: sanitizeStringArray(raw.hidden),
    categoryOrder: sanitizeStringArray(raw.categoryOrder),
    appOrder: sanitizeAppOrder(raw.appOrder),
    collapsedCategories: sanitizeStringArray(raw.collapsedCategories),
    recent: sanitizeStringArray(raw.recent),
    customApps: Array.isArray(raw.customApps) ? [] : [],
  };
}

class AstraAppHubStateStore {
  #file = null;
  #data = defaultState();
  #loadPromise = null;
  #loaded = false;
  #dirty = false;
  #warnedCorrupt = false;

  get path() {
    return PathUtils.join(PathUtils.profileDir, STATE_FILE_NAME);
  }

  get #backupPath() {
    return `${this.path}.bak`;
  }

  get data() {
    return this.#data;
  }

  /**
   * Load once. Missing file → in-memory defaults without writing.
   */
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

  #createFile() {
    return new lazy.JSONFile({
      path: this.path,
      // Real JSONFile option is backupTo (path string), not backup: true.
      backupTo: this.#backupPath,
    });
  }

  async #loadInternal() {
    try {
      const exists = await IOUtils.exists(this.path);
      if (!exists) {
        this.#data = defaultState();
        this.#loaded = true;
        this.#dirty = false;
        return this.#data;
      }

      this.#file = this.#createFile();
      await this.#file.load();
      const normalized = normalizeAppHubState(this.#file.data);
      if (
        !isPlainObject(this.#file.data) ||
        this.#file.data.schemaVersion !== STATE_SCHEMA_VERSION
      ) {
        this.#warnOnce(
          "invalid or unsupported App Hub state; using defaults"
        );
      }
      this.#data = normalized;
      this.#loaded = true;
      this.#dirty = false;
      return this.#data;
    } catch (error) {
      this.#warnOnce(`failed to load (${error?.message || error})`);
      this.#data = defaultState();
      this.#loaded = true;
      this.#dirty = false;
      this.#file = null;
      return this.#data;
    }
  }

  #warnOnce(message) {
    if (this.#warnedCorrupt) {
      return;
    }
    this.#warnedCorrupt = true;
    console.warn(`[AstraAppHubState] ${message}`);
  }

  /**
   * Replace state and persist. Shared process singleton — one JSONFile per profile.
   */
  async save(nextState) {
    const normalized = normalizeAppHubState(nextState);
    this.#data = normalized;
    this.#dirty = true;
    await this.#persist();
  }

  async reset() {
    this.#data = defaultState();
    this.#dirty = true;
    await this.#persist();
  }

  async #persist() {
    if (!this.#dirty) {
      return;
    }
    try {
      if (!this.#file) {
        this.#file = this.#createFile();
        // Mark dataReady without reading disk again.
        this.#file.data = {};
      }
      this.#file.data = JSON.parse(JSON.stringify(this.#data));
      // Explicit flush for intentional mutations (same pattern as live-folders).
      await this.#file._save();
      this.#dirty = false;
    } catch (error) {
      console.error("[AstraAppHubState] save failed:", error);
    }
  }
}

/** Process-wide singleton. */
export const gAstraAppHubState = new AstraAppHubStateStore();
