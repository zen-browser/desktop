/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Profile-local App Hub state (schema v2) — process singleton.
 * Owns persistence, migration, validation, and multi-window notifications.
 */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  JSONFile: "resource://gre/modules/JSONFile.sys.mjs",
});

export const STATE_SCHEMA_VERSION = 2;
export const STATE_FILE_NAME = "astra-app-hub-state.json";
export const STATE_CHANGED_TOPIC = "astra-app-hub-state-changed";

export const MAX_RECENT = 8;
export const MAX_FAVORITES = 64;
export const MAX_HIDDEN = 128;
export const MAX_CUSTOM_APPS = 100;
export const MAX_NAME_LENGTH = 80;
export const MAX_URL_LENGTH = 2048;
export const MAX_KEYWORD_LENGTH = 40;
export const MAX_KEYWORDS = 16;
export const MAX_ID_LENGTH = 80;
export const MAX_ICON_REF_LENGTH = 120;

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const FORBIDDEN_SCHEMES = new Set([
  "javascript",
  "data",
  "file",
  "chrome",
  "resource",
  "about",
  "moz-extension",
  "blob",
  "view-source",
  "ftp",
  "ws",
  "wss",
]);

function defaultSettings() {
  return {
    showRecent: true,
    showFavorites: true,
  };
}

export function defaultState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    favorites: [],
    hidden: [],
    categoryOrder: [],
    appOrder: {},
    collapsedCategories: [],
    recent: [],
    customApps: [],
    customCategoryData: {},
    settings: defaultSettings(),
  };
}

export function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function hasDangerousKey(obj) {
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

function deepHasDangerousKey(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(entry => deepHasDangerousKey(entry, depth + 1));
  }
  if (!isPlainObject(value) || hasDangerousKey(value)) {
    return !isPlainObject(value) ? false : hasDangerousKey(value);
  }
  return Object.values(value).some(entry =>
    deepHasDangerousKey(entry, depth + 1)
  );
}

export function sanitizeStringArray(value, { max = 256, maxLen = MAX_ID_LENGTH } = {}) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !entry) {
      continue;
    }
    const trimmed = entry.trim().slice(0, maxLen);
    if (!trimmed || seen.has(trimmed) || DANGEROUS_KEYS.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

function sanitizeAppOrder(value) {
  if (!isPlainObject(value) || hasDangerousKey(value)) {
    return {};
  }
  const out = {};
  for (const [categoryId, ids] of Object.entries(value)) {
    if (
      DANGEROUS_KEYS.has(categoryId) ||
      typeof categoryId !== "string" ||
      !categoryId
    ) {
      continue;
    }
    out[categoryId.slice(0, MAX_ID_LENGTH)] = sanitizeStringArray(ids, {
      max: 200,
    });
  }
  return out;
}

/**
 * Validate HTTPS app URLs for built-in and custom apps.
 * @returns {{ ok: true, href: string, hostname: string } | { ok: false, reason: string }}
 */
export function validateAppUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return { ok: false, reason: "empty" };
  }
  const trimmed = url.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, reason: "too-long" };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "unparseable" };
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme !== "https") {
    return { ok: false, reason: `scheme:${scheme}` };
  }
  if (FORBIDDEN_SCHEMES.has(scheme)) {
    return { ok: false, reason: `forbidden:${scheme}` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "credentials" };
  }
  const hostname = parsed.hostname;
  if (
    !hostname ||
    hostname.includes(" ") ||
    hostname.includes("/") ||
    hostname === "." ||
    hostname.startsWith(".")
  ) {
    return { ok: false, reason: "hostname" };
  }
  return { ok: true, href: parsed.href, hostname: hostname.toLowerCase() };
}

export function normalizeHostname(url) {
  const check = validateAppUrl(url);
  return check.ok ? check.hostname : "";
}

function sanitizeKeywords(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    if (typeof raw !== "string") {
      continue;
    }
    const kw = raw.trim().slice(0, MAX_KEYWORD_LENGTH);
    if (!kw) {
      continue;
    }
    const key = kw.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(kw);
    if (out.length >= MAX_KEYWORDS) {
      break;
    }
  }
  return out;
}

function sanitizeIconRef(value) {
  if (typeof value !== "string" || !value) {
    return "";
  }
  // Only allow safe relative icon filenames stored by the icon service.
  const name = value.replace(/\\/g, "/").split("/").pop() || "";
  if (!/^[a-zA-Z0-9._-]{1,100}\.(png|webp|ico)$/i.test(name)) {
    return "";
  }
  if (name.includes("..")) {
    return "";
  }
  return name.slice(0, MAX_ICON_REF_LENGTH);
}

function sanitizeCustomApp(raw, knownUrls = new Set()) {
  if (!isPlainObject(raw) || hasDangerousKey(raw)) {
    return null;
  }
  if (typeof raw.id !== "string" || !raw.id.startsWith("custom-")) {
    return null;
  }
  const id = raw.id.trim().slice(0, MAX_ID_LENGTH);
  if (!id || DANGEROUS_KEYS.has(id)) {
    return null;
  }
  const name =
    typeof raw.name === "string" ? raw.name.trim().slice(0, MAX_NAME_LENGTH) : "";
  if (!name) {
    return null;
  }
  const urlCheck = validateAppUrl(raw.url);
  if (!urlCheck.ok) {
    return null;
  }
  const urlKey = urlCheck.href.toLowerCase();
  if (knownUrls.has(urlKey)) {
    return null;
  }
  knownUrls.add(urlKey);
  const category =
    typeof raw.category === "string"
      ? raw.category.trim().slice(0, MAX_ID_LENGTH)
      : "productivity";
  if (!category || DANGEROUS_KEYS.has(category)) {
    return null;
  }
  return {
    id,
    name,
    url: urlCheck.href,
    category,
    keywords: sanitizeKeywords(raw.keywords),
    icon: sanitizeIconRef(raw.icon),
    builtin: false,
    createdAt:
      typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Date.now(),
    updatedAt:
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : Date.now(),
  };
}

function sanitizeCustomApps(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const out = [];
  const ids = new Set();
  const urls = new Set();
  for (const raw of value) {
    const app = sanitizeCustomApp(raw, urls);
    if (!app || ids.has(app.id)) {
      continue;
    }
    ids.add(app.id);
    out.push(app);
    if (out.length >= MAX_CUSTOM_APPS) {
      break;
    }
  }
  return out;
}

function sanitizeRecent(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    if (!isPlainObject(entry) || hasDangerousKey(entry)) {
      continue;
    }
    if (typeof entry.id !== "string" || !entry.id) {
      continue;
    }
    const id = entry.id.trim().slice(0, MAX_ID_LENGTH);
    if (!id || seen.has(id) || DANGEROUS_KEYS.has(id)) {
      continue;
    }
    const lastOpened =
      typeof entry.lastOpened === "number" && Number.isFinite(entry.lastOpened)
        ? entry.lastOpened
        : 0;
    const count =
      typeof entry.count === "number" && Number.isFinite(entry.count)
        ? Math.max(1, Math.min(100000, Math.floor(entry.count)))
        : 1;
    seen.add(id);
    out.push({ id, lastOpened, count });
    if (out.length >= MAX_RECENT) {
      break;
    }
  }
  out.sort(
    (a, b) => b.lastOpened - a.lastOpened || b.count - a.count || a.id.localeCompare(b.id)
  );
  return out.slice(0, MAX_RECENT);
}

function sanitizeSettings(value) {
  const defaults = defaultSettings();
  if (!isPlainObject(value) || hasDangerousKey(value)) {
    return defaults;
  }
  return {
    showRecent:
      typeof value.showRecent === "boolean"
        ? value.showRecent
        : defaults.showRecent,
    showFavorites:
      typeof value.showFavorites === "boolean"
        ? value.showFavorites
        : defaults.showFavorites,
  };
}

function sanitizeCustomCategoryData(value) {
  if (!isPlainObject(value) || hasDangerousKey(value)) {
    return {};
  }
  // Reserved for future category metadata; keep empty-safe object only.
  return {};
}

/**
 * Migrate schema v1 (string recent IDs) → v2 (recent objects + settings).
 */
export function migrateStateV1ToV2(raw) {
  const base = defaultState();
  if (!isPlainObject(raw)) {
    return base;
  }
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    favorites: sanitizeStringArray(raw.favorites, { max: MAX_FAVORITES }),
    hidden: sanitizeStringArray(raw.hidden, { max: MAX_HIDDEN }),
    categoryOrder: sanitizeStringArray(raw.categoryOrder),
    appOrder: sanitizeAppOrder(raw.appOrder),
    collapsedCategories: sanitizeStringArray(raw.collapsedCategories),
    recent: Array.isArray(raw.recent)
      ? sanitizeRecent(
          raw.recent.map(entry =>
            typeof entry === "string"
              ? { id: entry, lastOpened: 0, count: 1 }
              : entry
          )
        )
      : [],
    customApps: sanitizeCustomApps(raw.customApps),
    customCategoryData: sanitizeCustomCategoryData(raw.customCategoryData),
    settings: sanitizeSettings(raw.settings),
  };
}

/**
 * Validate and normalize on-disk / in-memory / import state.
 */
export function normalizeAppHubState(raw, { allowMigration = true } = {}) {
  if (!isPlainObject(raw) || hasDangerousKey(raw) || deepHasDangerousKey(raw)) {
    return { ok: false, state: defaultState(), reason: "unsafe-or-invalid" };
  }

  let version = raw.schemaVersion;
  if (version === 1 && allowMigration) {
    return { ok: true, state: migrateStateV1ToV2(raw), migrated: true };
  }
  if (version !== STATE_SCHEMA_VERSION) {
    if (allowMigration && (version === undefined || version === null)) {
      // Treat missing version with recognizable fields as v1-like.
      if (
        Array.isArray(raw.favorites) ||
        Array.isArray(raw.hidden) ||
        Array.isArray(raw.recent)
      ) {
        return { ok: true, state: migrateStateV1ToV2(raw), migrated: true };
      }
    }
    return { ok: false, state: defaultState(), reason: "unsupported-schema" };
  }

  return {
    ok: true,
    migrated: false,
    state: {
      schemaVersion: STATE_SCHEMA_VERSION,
      favorites: sanitizeStringArray(raw.favorites, { max: MAX_FAVORITES }),
      hidden: sanitizeStringArray(raw.hidden, { max: MAX_HIDDEN }),
      categoryOrder: sanitizeStringArray(raw.categoryOrder),
      appOrder: sanitizeAppOrder(raw.appOrder),
      collapsedCategories: sanitizeStringArray(raw.collapsedCategories),
      recent: sanitizeRecent(raw.recent),
      customApps: sanitizeCustomApps(raw.customApps),
      customCategoryData: sanitizeCustomCategoryData(raw.customCategoryData),
      settings: sanitizeSettings(raw.settings),
    },
  };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function statesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

class AstraAppHubStateStore {
  #file = null;
  #data = defaultState();
  #loadPromise = null;
  #loaded = false;
  #dirty = false;
  #warnedCorrupt = false;
  #revision = 0;
  #writeQueue = Promise.resolve();
  #iconCleanup = null;

  get path() {
    return PathUtils.join(PathUtils.profileDir, STATE_FILE_NAME);
  }

  get #backupPath() {
    return `${this.path}.bak`;
  }

  get data() {
    return this.#data;
  }

  get revision() {
    return this.#revision;
  }

  /**
   * Optional hook: (removedIconNames: string[]) => Promise<void>
   */
  setIconCleanupHandler(handler) {
    this.#iconCleanup = typeof handler === "function" ? handler : null;
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

  #createFile() {
    return new lazy.JSONFile({
      path: this.path,
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
      const result = normalizeAppHubState(this.#file.data, {
        allowMigration: true,
      });
      if (!result.ok) {
        this.#warnOnce(
          `invalid App Hub state (${result.reason}); using defaults`
        );
        // Preserve corrupt file via JSONFile backupTo on next write.
        await this.#backupCorruptFile();
      } else if (result.migrated) {
        this.#warnOnce("migrated App Hub state to schema v2");
        this.#data = result.state;
        this.#loaded = true;
        this.#dirty = true;
        await this.#persist({ notify: false });
        return this.#data;
      }
      this.#data = result.state;
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

  async #backupCorruptFile() {
    try {
      if (await IOUtils.exists(this.path)) {
        await IOUtils.copy(this.path, `${this.path}.corrupt-${Date.now()}`, {
          noOverwrite: false,
        });
      }
    } catch {
      // ignore
    }
  }

  #warnOnce(message) {
    if (this.#warnedCorrupt) {
      return;
    }
    this.#warnedCorrupt = true;
    console.warn(`[AstraAppHubState] ${message}`);
  }

  getSnapshot() {
    return cloneState(this.#data);
  }

  /**
   * Apply a mutator to cloned state, persist if changed, notify windows.
   */
  async update(mutator, { silent = false } = {}) {
    await this.load();
    return this.#enqueue(async () => {
      const next = cloneState(this.#data);
      const maybe = await mutator(next);
      const candidate = maybe && isPlainObject(maybe) ? maybe : next;
      const result = normalizeAppHubState(candidate, { allowMigration: false });
      if (!result.ok) {
        throw new Error(`App Hub state update rejected: ${result.reason}`);
      }
      if (statesEqual(this.#data, result.state)) {
        return this.#data;
      }
      const removedIcons = this.#diffRemovedIcons(this.#data, result.state);
      this.#data = result.state;
      this.#dirty = true;
      await this.#persist({ notify: !silent });
      if (removedIcons.length && this.#iconCleanup) {
        try {
          await this.#iconCleanup(removedIcons);
        } catch (error) {
          console.warn("[AstraAppHubState] icon cleanup failed:", error);
        }
      }
      return this.#data;
    });
  }

  #diffRemovedIcons(prev, next) {
    const nextIcons = new Set(
      (next.customApps || []).map(app => app.icon).filter(Boolean)
    );
    const removed = [];
    for (const app of prev.customApps || []) {
      if (app.icon && !nextIcons.has(app.icon)) {
        removed.push(app.icon);
      }
    }
    return removed;
  }

  #enqueue(task) {
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
        this.#file = this.#createFile();
        this.#file.data = {};
      }
      this.#file.data = cloneState(this.#data);
      await this.#file._save();
      this.#dirty = false;
      this.#revision += 1;
      if (notify) {
        this.#notify();
      }
    } catch (error) {
      console.error("[AstraAppHubState] save failed:", error);
    }
  }

  #notify() {
    try {
      Services.obs.notifyObservers(
        null,
        STATE_CHANGED_TOPIC,
        String(this.#revision)
      );
    } catch (error) {
      console.warn("[AstraAppHubState] notify failed:", error);
    }
  }

  // —— High-level APIs ——

  async setFavorites(ids) {
    return this.update(state => {
      state.favorites = sanitizeStringArray(ids, { max: MAX_FAVORITES });
      return state;
    });
  }

  async toggleFavorite(appId) {
    if (typeof appId !== "string" || !appId) {
      return this.#data;
    }
    return this.update(state => {
      const idx = state.favorites.indexOf(appId);
      if (idx >= 0) {
        state.favorites.splice(idx, 1);
      } else if (state.favorites.length < MAX_FAVORITES) {
        state.favorites.push(appId);
      }
      return state;
    });
  }

  async hideApp(appId) {
    if (typeof appId !== "string" || !appId) {
      return this.#data;
    }
    return this.update(state => {
      if (!state.hidden.includes(appId) && state.hidden.length < MAX_HIDDEN) {
        state.hidden.push(appId);
      }
      state.favorites = state.favorites.filter(id => id !== appId);
      state.recent = state.recent.filter(entry => entry.id !== appId);
      return state;
    });
  }

  async restoreHidden(appIds = null) {
    return this.update(state => {
      if (appIds == null) {
        state.hidden = [];
      } else {
        const restore = new Set(
          sanitizeStringArray(Array.isArray(appIds) ? appIds : [appIds])
        );
        state.hidden = state.hidden.filter(id => !restore.has(id));
      }
      return state;
    });
  }

  async setCategoryOrder(order) {
    return this.update(state => {
      state.categoryOrder = sanitizeStringArray(order);
      return state;
    });
  }

  async setAppOrder(categoryId, order) {
    if (typeof categoryId !== "string" || !categoryId) {
      return this.#data;
    }
    return this.update(state => {
      state.appOrder[categoryId] = sanitizeStringArray(order, { max: 200 });
      return state;
    });
  }

  async setCollapsed(categoryId, collapsed) {
    if (typeof categoryId !== "string" || !categoryId) {
      return this.#data;
    }
    return this.update(state => {
      const set = new Set(state.collapsedCategories);
      if (collapsed) {
        set.add(categoryId);
      } else {
        set.delete(categoryId);
      }
      state.collapsedCategories = [...set];
      return state;
    });
  }

  async recordRecent(appId, { privateWindow = false } = {}) {
    if (privateWindow || typeof appId !== "string" || !appId) {
      return this.#data;
    }
    return this.update(state => {
      if (state.hidden.includes(appId)) {
        return state;
      }
      const now = Date.now();
      const existing = state.recent.find(entry => entry.id === appId);
      if (existing) {
        existing.lastOpened = now;
        existing.count = Math.min(100000, (existing.count || 0) + 1);
      } else {
        state.recent.push({ id: appId, lastOpened: now, count: 1 });
      }
      state.recent.sort(
        (a, b) =>
          b.lastOpened - a.lastOpened ||
          b.count - a.count ||
          a.id.localeCompare(b.id)
      );
      state.recent = state.recent.slice(0, MAX_RECENT);
      return state;
    });
  }

  async clearRecent() {
    return this.update(state => {
      state.recent = [];
      return state;
    });
  }

  async clearFavorites() {
    return this.update(state => {
      state.favorites = [];
      return state;
    });
  }

  async addCustomApp(input) {
    const prepared = this.#prepareCustomAppInput(input);
    if (!prepared.ok) {
      throw new Error(prepared.reason);
    }
    return this.update(state => {
      if (state.customApps.length >= MAX_CUSTOM_APPS) {
        throw new Error("custom-limit");
      }
      const urls = new Set(
        state.customApps.map(app => app.url.toLowerCase())
      );
      if (urls.has(prepared.app.url.toLowerCase())) {
        throw new Error("duplicate-url");
      }
      state.customApps.push(prepared.app);
      return state;
    });
  }

  async updateCustomApp(appId, input) {
    if (typeof appId !== "string" || !appId.startsWith("custom-")) {
      throw new Error("invalid-id");
    }
    return this.update(state => {
      const idx = state.customApps.findIndex(app => app.id === appId);
      if (idx < 0) {
        throw new Error("not-found");
      }
      const existing = state.customApps[idx];
      const prepared = this.#prepareCustomAppInput({
        ...existing,
        ...input,
        id: existing.id,
      });
      if (!prepared.ok) {
        throw new Error(prepared.reason);
      }
      const urls = new Set(
        state.customApps
          .filter(app => app.id !== appId)
          .map(app => app.url.toLowerCase())
      );
      if (urls.has(prepared.app.url.toLowerCase())) {
        throw new Error("duplicate-url");
      }
      state.customApps[idx] = {
        ...prepared.app,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      };
      return state;
    });
  }

  async deleteCustomApp(appId) {
    if (typeof appId !== "string" || !appId.startsWith("custom-")) {
      return this.#data;
    }
    return this.update(state => {
      state.customApps = state.customApps.filter(app => app.id !== appId);
      state.favorites = state.favorites.filter(id => id !== appId);
      state.recent = state.recent.filter(entry => entry.id !== appId);
      for (const key of Object.keys(state.appOrder)) {
        state.appOrder[key] = state.appOrder[key].filter(id => id !== appId);
      }
      return state;
    });
  }

  #prepareCustomAppInput(input) {
    if (!isPlainObject(input) || hasDangerousKey(input)) {
      return { ok: false, reason: "invalid" };
    }
    // Never accept caller-supplied IDs for create; updates keep existing.
    let id = input.id;
    if (typeof id !== "string" || !id.startsWith("custom-")) {
      id = `custom-${crypto.randomUUID()}`;
    }
    const name =
      typeof input.name === "string"
        ? input.name.trim().slice(0, MAX_NAME_LENGTH)
        : "";
    if (!name) {
      return { ok: false, reason: "empty-name" };
    }
    const urlCheck = validateAppUrl(input.url);
    if (!urlCheck.ok) {
      return { ok: false, reason: urlCheck.reason };
    }
    const category =
      typeof input.category === "string" && input.category.trim()
        ? input.category.trim().slice(0, MAX_ID_LENGTH)
        : "productivity";
    const now = Date.now();
    return {
      ok: true,
      app: {
        id,
        name,
        url: urlCheck.href,
        category,
        keywords: sanitizeKeywords(input.keywords),
        icon: sanitizeIconRef(input.icon),
        builtin: false,
        createdAt:
          typeof input.createdAt === "number" ? input.createdAt : now,
        updatedAt: now,
      },
    };
  }

  /**
   * Prune unknown IDs using known built-in + custom app id sets.
   */
  async pruneUnknownIds(knownAppIds, knownCategoryIds) {
    const apps = new Set(knownAppIds || []);
    const cats = new Set(knownCategoryIds || []);
    return this.update(state => {
      state.favorites = state.favorites.filter(id => apps.has(id));
      state.hidden = state.hidden.filter(id => apps.has(id));
      state.recent = state.recent.filter(entry => apps.has(entry.id));
      state.categoryOrder = state.categoryOrder.filter(id => cats.has(id));
      state.collapsedCategories = state.collapsedCategories.filter(id =>
        cats.has(id)
      );
      const nextOrder = {};
      for (const [cat, ids] of Object.entries(state.appOrder)) {
        if (!cats.has(cat)) {
          continue;
        }
        nextOrder[cat] = ids.filter(id => apps.has(id));
      }
      state.appOrder = nextOrder;
      return state;
    });
  }

  buildExportPayload() {
    const data = this.getSnapshot();
    return {
      schemaVersion: STATE_SCHEMA_VERSION,
      favorites: data.favorites,
      hidden: data.hidden,
      categoryOrder: data.categoryOrder,
      appOrder: data.appOrder,
      collapsedCategories: data.collapsedCategories,
      customApps: data.customApps.map(app => ({
        id: app.id,
        name: app.name,
        url: app.url,
        category: app.category,
        keywords: app.keywords,
        // Profile-local icon files are not portable — omit from export.
      })),
      settings: data.settings,
      // recent intentionally omitted
    };
  }

  /**
   * Replace current configuration after validation. Remaps colliding custom IDs
   * and rewrites favorites / hidden / appOrder references to the new IDs.
   */
  async importReplace(rawPayload) {
    if (!isPlainObject(rawPayload) || deepHasDangerousKey(rawPayload)) {
      throw new Error("malformed");
    }
    // Import may be schema 2 export (no recent) — normalize via migration path.
    const asState = {
      schemaVersion:
        rawPayload.schemaVersion === 1 ? 1 : STATE_SCHEMA_VERSION,
      favorites: rawPayload.favorites,
      hidden: rawPayload.hidden,
      categoryOrder: rawPayload.categoryOrder,
      appOrder: rawPayload.appOrder,
      collapsedCategories: rawPayload.collapsedCategories,
      recent: [],
      customApps: Array.isArray(rawPayload.customApps)
        ? rawPayload.customApps
        : [],
      customCategoryData: {},
      settings: rawPayload.settings,
    };

    // Remap custom IDs before sanitize; rewrite references only when an
    // original ID is fully abandoned (not retained by another custom app).
    if (Array.isArray(asState.customApps)) {
      const used = new Set();
      const prepared = [];
      for (const app of asState.customApps) {
        if (!isPlainObject(app)) {
          continue;
        }
        const originalId =
          typeof app.id === "string" && app.id ? app.id : null;
        let id =
          typeof app.id === "string" && app.id.startsWith("custom-")
            ? app.id
            : `custom-${crypto.randomUUID()}`;
        if (used.has(id)) {
          id = `custom-${crypto.randomUUID()}`;
        }
        used.add(id);
        // Drop non-portable icon refs on import.
        const { icon: _dropIcon, ...rest } = app;
        prepared.push({
          ...rest,
          id,
          icon: "",
          _originalId: originalId,
        });
      }

      const liveIds = new Set(prepared.map(app => app.id));
      const idRemap = new Map();
      for (const app of prepared) {
        if (
          app._originalId &&
          app._originalId !== app.id &&
          !liveIds.has(app._originalId)
        ) {
          idRemap.set(app._originalId, app.id);
        }
        delete app._originalId;
      }
      asState.customApps = prepared;

      if (idRemap.size) {
        const rewriteId = id => idRemap.get(id) || id;
        if (Array.isArray(asState.favorites)) {
          asState.favorites = asState.favorites.map(rewriteId);
        }
        if (Array.isArray(asState.hidden)) {
          asState.hidden = asState.hidden.map(rewriteId);
        }
        if (isPlainObject(asState.appOrder)) {
          const nextOrder = {};
          for (const [cat, ids] of Object.entries(asState.appOrder)) {
            nextOrder[cat] = Array.isArray(ids) ? ids.map(rewriteId) : ids;
          }
          asState.appOrder = nextOrder;
        }
      }
    }

    const result = normalizeAppHubState(asState, { allowMigration: true });
    if (!result.ok) {
      throw new Error(result.reason || "invalid");
    }

    // Backup current before replace.
    try {
      if (await IOUtils.exists(this.path)) {
        await IOUtils.copy(
          this.path,
          `${this.path}.pre-import-${Date.now()}`,
          { noOverwrite: false }
        );
      }
    } catch {
      // continue — JSONFile also keeps .bak
    }

    return this.update(() => result.state);
  }

  async resetLayout() {
    return this.update(state => {
      state.categoryOrder = [];
      state.appOrder = {};
      state.collapsedCategories = [];
      return state;
    });
  }

  async resetComplete() {
    const removedIcons = (this.#data.customApps || [])
      .map(app => app.icon)
      .filter(Boolean);
    await this.update(() => defaultState());
    if (removedIcons.length && this.#iconCleanup) {
      try {
        await this.#iconCleanup(removedIcons);
      } catch {
        // ignore
      }
    }
    return this.#data;
  }

  async reset() {
    return this.resetComplete();
  }
}

/** Process-wide singleton. */
export const gAstraAppHubState = new AstraAppHubStateStore();
