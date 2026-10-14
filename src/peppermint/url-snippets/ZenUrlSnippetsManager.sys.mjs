/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF = "zen.url-snippets.list";
const LEGACY_FILE = "zen-url-snippets.jsonlz4";

const DEFAULT_SNIPPET = Object.freeze({
  shortcut: "yt",
  url: "https://youtube.com",
});

/**
 * @returns {object}
 *   A new copy of the built-in YouTube snippet.
 */
function createDefaultSnippet() {
  return {
    // Stable id so seeding the same default does not churn the synced pref.
    id: "00000000-0000-4000-8000-000000000001",
    shortcut: DEFAULT_SNIPPET.shortcut,
    url: DEFAULT_SNIPPET.url,
  };
}

/**
 * Normalize stored data. A missing list is the first-run state and receives
 * the YouTube snippet. An existing list, including an empty one, is kept.
 *
 * @param {object} data
 * @returns {object}
 */
export function normalizeUrlSnippetsData(data) {
  if (!data || typeof data !== "object") {
    return { snippets: [createDefaultSnippet()] };
  }
  if (!Array.isArray(data.snippets)) {
    data.snippets = [createDefaultSnippet()];
  } else {
    data.snippets = data.snippets.filter(
      snippet =>
        snippet &&
        typeof snippet === "object" &&
        (!snippet.url || normalizeSnippetURL(snippet.url))
    );
  }
  return data;
}

/**
 * @param {string} value
 * @returns {string|null}
 *   The trimmed shortcut, or null when it is empty or contains whitespace.
 */
export function normalizeSnippetShortcut(value) {
  const shortcut = String(value ?? "").trim();
  if (!shortcut || /\s/.test(shortcut)) {
    return null;
  }
  return shortcut;
}

/**
 * @param {string} value
 * @returns {string|null}
 *   An absolute URL. Values without a scheme are treated as https.
 */
const ALLOWED_SNIPPET_PROTOCOLS = new Set(["http:", "https:", "mint:"]);

export function normalizeSnippetURL(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /\s/.test(raw)) {
    return null;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!ALLOWED_SNIPPET_PROTOCOLS.has(url.protocol)) {
      return null;
    }
    return url.href;
  } catch (ex) {
    return null;
  }
}

/**
 * Keep the first snippet for each shortcut. Blank shortcuts are not shortcuts,
 * so more than one of those can stay.
 *
 * @param {object[]} snippets
 * @returns {object[]}
 */
function dedupeSnippets(snippets) {
  const seen = new Set();
  const kept = [];
  for (const snippet of snippets) {
    const shortcut = normalizeSnippetShortcut(snippet.shortcut);
    const key = shortcut ? shortcut.toLowerCase() : "";
    if (key && seen.has(key)) {
      continue;
    }
    if (key) {
      seen.add(key);
    }
    kept.push(snippet);
  }
  return kept;
}

/**
 * @param {string} url
 * @returns {string}
 *   The stored URL when it is empty or allowed. Rejects every other scheme.
 */
function assertAllowedSnippetURL(url) {
  if (!url) {
    return "";
  }
  if (!normalizeSnippetURL(url)) {
    throw new Error("Unsupported snippet URL");
  }
  return url;
}

class nsZenUrlSnippetsManager {
  #snippets = [];
  #readyPromise = null;
  #writing = false;

  constructor() {
    Services.prefs.addObserver(PREF, this);
  }

  observe() {
    if (this.#writing) {
      return;
    }
    const raw = Services.prefs.getStringPref(PREF, "");
    if (!raw) {
      return;
    }
    if (this.#adopt(raw) === "changed") {
      this.#write();
    }
  }

  /**
   * @returns {Promise<void>}
   */
  ready() {
    if (!this.#readyPromise) {
      this.#readyPromise = this.#load();
    }
    return this.#readyPromise;
  }

  /**
   * @returns {Array<object>}
   *   A copy of the saved snippets, in settings order.
   */
  getAll() {
    if (!Array.isArray(this.#snippets)) {
      return [];
    }
    return structuredClone(this.#snippets);
  }

  /**
   * @param {string} query
   *   Shortcut text without the leading ">" token.
   * @returns {Array<{ snippet: object, heuristic: boolean }>}
   *   Exact matches, then other prefix matches. The best match is heuristic
   *   when it is exact or the only prefix match.
   */
  match(query) {
    const needle = String(query ?? "").trim().toLowerCase();
    const snippets = this.getAll().filter(
      snippet => snippet.shortcut && snippet.url
    );
    if (!needle) {
      return snippets.map(snippet => ({ snippet, heuristic: false }));
    }

    const exact = [];
    const prefix = [];
    for (const snippet of snippets) {
      const shortcut = String(snippet.shortcut).toLowerCase();
      if (shortcut === needle) {
        exact.push(snippet);
      } else if (shortcut.startsWith(needle)) {
        prefix.push(snippet);
      }
    }

    const ranked = [...exact, ...prefix];
    let heuristicIndex = -1;
    if (exact.length || prefix.length === 1) {
      heuristicIndex = 0;
    }
    return ranked.map((snippet, index) => ({
      snippet,
      heuristic: index === heuristicIndex,
    }));
  }

  /**
   * @param {string} shortcut
   * @param {string} exceptId
   * @returns {boolean}
   */
  isShortcutTaken(shortcut, exceptId = "") {
    const normalized = normalizeSnippetShortcut(shortcut);
    if (!normalized) {
      return false;
    }
    const needle = normalized.toLowerCase();
    return this.getAll().some(
      snippet =>
        snippet.id !== exceptId &&
        String(snippet.shortcut).toLowerCase() === needle
    );
  }

  /**
   * @param {string} [shortcut]
   * @param {string} [url]
   * @returns {Promise<object>}
   */
  async create(shortcut = "", url = "") {
    await this.ready();
    const normalized = normalizeSnippetShortcut(shortcut) || "";
    if (normalized && this.isShortcutTaken(normalized)) {
      throw new Error("Snippet shortcut already exists");
    }
    const snippet = {
      id: crypto.randomUUID(),
      shortcut: normalized,
      url: assertAllowedSnippetURL(url),
    };
    this.#snippets.push(snippet);
    await this.#write();
    return structuredClone(snippet);
  }

  /**
   * @param {object} snippet
   * @returns {Promise<void>}
   */
  async update(snippet) {
    await this.ready();
    const idx = this.#snippets.findIndex(item => item.id === snippet.id);
    if (idx === -1) {
      return;
    }
    const next = structuredClone(snippet);
    const normalized = normalizeSnippetShortcut(next.shortcut) || "";
    if (normalized && this.isShortcutTaken(normalized, next.id)) {
      throw new Error("Snippet shortcut already exists");
    }
    next.shortcut = normalized;
    next.url = assertAllowedSnippetURL(next.url);
    this.#snippets[idx] = next;
    await this.#write();
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    await this.ready();
    const idx = this.#snippets.findIndex(item => item.id === id);
    if (idx === -1) {
      return;
    }
    this.#snippets.splice(idx, 1);
    await this.#write();
  }

  /**
   * Delete the store and load it again. Used by tests to exercise seeding.
   *
   * @returns {Promise<void>}
   */
  async resetStore() {
    await this.ready();
    await IOUtils.remove(this.#legacyPath, { ignoreAbsent: true });
    this.#writing = true;
    try {
      Services.prefs.clearUserPref(PREF);
    } catch {
      // The pref is already on its default.
    } finally {
      this.#writing = false;
    }
    await this.#load();
  }

  /**
   * Reload the store from the pref, or from the legacy file when that pref
   * has never been written.
   *
   * @returns {Promise<void>}
   */
  async reload() {
    await this.ready();
    await this.#load();
  }

  async #load() {
    const raw = Services.prefs.getStringPref(PREF, "");
    if (raw) {
      const adopted = this.#adopt(raw);
      if (adopted) {
        if (adopted === "changed") {
          await this.#write();
        }
        return;
      }
    }
    const legacy = await this.#readLegacy();
    if (legacy) {
      const normalized = normalizeUrlSnippetsData(legacy);
      this.#snippets = dedupeSnippets(normalized.snippets);
      await this.#write();
      await IOUtils.remove(this.#legacyPath, { ignoreAbsent: true });
      return;
    }
    this.#snippets = normalizeUrlSnippetsData(null).snippets;
    await this.#write();
  }

  /**
   * @param {string} raw
   * @returns {"same"|"changed"|false} Whether the pref held a list
   */
  #adopt(raw) {
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.error("Zen URL snippets pref is unreadable", error);
      return false;
    }
    if (!data || typeof data !== "object") {
      return false;
    }
    const normalized = normalizeUrlSnippetsData(data);
    const deduped = dedupeSnippets(normalized.snippets);
    this.#snippets = deduped;
    return deduped.length === normalized.snippets.length ? "same" : "changed";
  }

  async #readLegacy() {
    if (!(await IOUtils.exists(this.#legacyPath))) {
      return null;
    }
    try {
      const text = await IOUtils.readUTF8(this.#legacyPath, { decompress: true });
      return JSON.parse(text);
    } catch (error) {
      console.error("Zen URL snippets could not migrate", error);
      return null;
    }
  }

  async #write() {
    this.#writing = true;
    try {
      Services.prefs.setStringPref(
        PREF,
        JSON.stringify({ snippets: this.#snippets })
      );
    } finally {
      this.#writing = false;
    }
  }

  get #legacyPath() {
    return PathUtils.join(PathUtils.profileDir, LEGACY_FILE);
  }
}

export const gZenUrlSnippets = new nsZenUrlSnippetsManager();
