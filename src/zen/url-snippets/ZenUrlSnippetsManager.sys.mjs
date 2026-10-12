/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";

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
    id: crypto.randomUUID(),
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
export function normalizeSnippetURL(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /\s/.test(raw)) {
    return null;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).href;
  } catch (ex) {
    return null;
  }
}

class nsZenUrlSnippetsManager {
  #file = null;
  #saveFilename = "zen-url-snippets.jsonlz4";
  #readyPromise = null;

  constructor() {
    this.#readyPromise = this.#readFromDisk();
  }

  /**
   * @returns {Promise<void>}
   */
  ready() {
    return this.#readyPromise;
  }

  /**
   * @returns {Array<object>}
   *   A copy of the saved snippets, in settings order.
   */
  getAll() {
    if (!Array.isArray(this.#file?.data?.snippets)) {
      return [];
    }
    return structuredClone(this.#file.data.snippets);
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
    const snippet = {
      id: crypto.randomUUID(),
      shortcut,
      url,
    };
    this.#file.data.snippets.push(snippet);
    await this.#write();
    return structuredClone(snippet);
  }

  /**
   * @param {object} snippet
   * @returns {Promise<void>}
   */
  async update(snippet) {
    await this.ready();
    const idx = this.#file.data.snippets.findIndex(item => item.id === snippet.id);
    if (idx === -1) {
      return;
    }
    this.#file.data.snippets[idx] = structuredClone(snippet);
    await this.#write();
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    await this.ready();
    const idx = this.#file.data.snippets.findIndex(item => item.id === id);
    if (idx === -1) {
      return;
    }
    this.#file.data.snippets.splice(idx, 1);
    await this.#write();
  }

  /**
   * Delete the store and load it again. Used by tests to exercise seeding.
   *
   * @returns {Promise<void>}
   */
  async resetStore() {
    await this.ready();
    await this.#file.saveSoon();
    await IOUtils.remove(this.#storePath, { ignoreAbsent: true });
    await this.#readFromDisk();
    await this.#file.saveSoon();
  }

  /**
   * Reload the store from disk.
   *
   * @returns {Promise<void>}
   */
  async reload() {
    await this.ready();
    await this.#file.saveSoon();
    await this.#readFromDisk();
  }

  async #write() {
    await this.#file.saveSoon();
  }

  async #readFromDisk() {
    let needsPersist = false;
    this.#file = new JSONFile({
      path: this.#storePath,
      compression: "lz4",
      dataPostProcessor: data => {
        needsPersist = !data || typeof data !== "object" || !Array.isArray(data.snippets);
        return normalizeUrlSnippetsData(data);
      },
    });
    await this.#file.load();
    if (needsPersist) {
      await this.#file.saveSoon();
    }
  }

  get #storePath() {
    return PathUtils.join(PathUtils.profileDir, this.#saveFilename);
  }
}

export const gZenUrlSnippets = new nsZenUrlSnippetsManager();
