// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  JSONFile: "resource://gre/modules/JSONFile.sys.mjs",
  JsonSchema: "resource://gre/modules/JsonSchema.sys.mjs",
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gBaseUrl",
  "zen.share.base-url",
  "",
  null,
  value => value.trim().replace(/\/+$/, "")
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gSecretKey",
  "zen.share.secret-key",
  ""
);

const SCHEMA_URL = "resource:///modules/zen/share/share.schema.json";

const CACHE_FILE = "zen-share-cache.json";
const MAX_CACHE_ENTRIES = 200;

// The server rejects bigger bodies at 25 MiB.
const MAX_SHARE_BYTES = 25 * 1024 * 1024;
const MAX_NAME_LENGTH = 200;

// Uploads can be tens of MiB, reads are small JSON.
const CREATE_TIMEOUT_MS = 120000;
const READ_TIMEOUT_MS = 30000;

// Public share page paths: /{slug}/{XXXX-XXXX-XXXX-XXXX id}.
const SHARE_PATH_RE =
  /^\/(space|folder|split-view|split|boost)\/([0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4})\/?$/;

export class ZenShareError extends Error {
  /**
   * @param {string} code - One of "invalid-document", "auth", "too-large",
   *      "rate-limited", "not-found", "network", "server".
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "ZenShareError";
    this.code = code;
  }
}

class nsZenShareClient {
  #validatorPromise = null;
  #cacheFile = null;

  get #baseUrl() {
    return lazy.gBaseUrl;
  }

  #authHeaders() {
    // A secret key authorizes on its own and makes the share permanent. Never
    // send both keys.
    if (lazy.gSecretKey) {
      return { "x-secret-key": lazy.gSecretKey };
    }
    return { "x-api-key": AppConstants.MOZ_MOZILLA_API_KEY };
  }

  #getValidator() {
    if (!this.#validatorPromise) {
      this.#validatorPromise = fetch(SCHEMA_URL, { credentials: "omit" })
        .then(response => response.json())
        .then(schema => new lazy.JsonSchema.Validator(schema));
    }
    return this.#validatorPromise;
  }

  /**
   * Validates a share document against the schema.
   *
   * @param {object} doc
   * @returns {Promise<{valid: boolean, errors: object[]}>}
   */
  async validateDocument(doc) {
    const validator = await this.#getValidator();
    return validator.validate(doc);
  }

  async #assertValidDocument(doc) {
    const result = await this.validateDocument(doc);
    if (!result.valid) {
      console.error("ZenShare: document fails the schema", result.errors);
      throw new ZenShareError(
        "invalid-document",
        "share document fails the schema"
      );
    }
  }

  async #request(url, options, timeoutMs = READ_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = lazy.setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        credentials: "omit",
        signal: controller.signal,
        ...options,
      });
    } catch (e) {
      throw new ZenShareError(
        "network",
        `could not reach ${url}: ${e.message}`
      );
    } finally {
      lazy.clearTimeout(timer);
    }
    if (response.ok) {
      return response;
    }
    let message = `${response.status}`;
    try {
      message = (await response.json()).error || message;
    } catch (e) {}
    switch (response.status) {
      case 401:
      case 403:
        throw new ZenShareError("auth", message);
      case 404:
        throw new ZenShareError("not-found", message);
      case 413:
        throw new ZenShareError("too-large", message);
      case 429:
        throw new ZenShareError("rate-limited", message);
      case 400:
      case 422:
        throw new ZenShareError("invalid-document", message);
      default:
        throw new ZenShareError("server", message);
    }
  }

  /**
   * Uploads a share document.
   *
   * @param {object} doc - A document conforming to share.schema.json.
   * @param {{name?: string}} options - Optional sharer display name, shown on
   *   the share page as "A Space from {name}".
   * @returns {Promise<object>} The create response, plus `link`: the absolute
   *   public page URL to hand to the user.
   */
  async createShare(doc, { name } = {}) {
    const base = this.#baseUrl;
    const headers = this.#authHeaders();
    await this.#assertValidDocument(doc);
    const body = JSON.stringify(doc);
    if (new TextEncoder().encode(body).length > MAX_SHARE_BYTES) {
      throw new ZenShareError("too-large", "share document is over 25 MiB");
    }
    let url = `${base}/api/shares`;
    if (name) {
      url += `?name=${encodeURIComponent(name.slice(0, MAX_NAME_LENGTH))}`;
    }
    const response = await this.#request(
      url,
      {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body,
      },
      CREATE_TIMEOUT_MS
    );
    const created = await response.json();
    return { ...created, link: base + created.webUrl };
  }

  /**
   * Shares a document, reusing the link of an earlier identical share when
   * the server still has it.
   *
   * @param {object} doc - A document conforming to share.schema.json.
   * @param {{name?: string}} options - Optional sharer display name.
   * @returns {Promise<object>} As createShare, plus `reused`: whether an
   *   existing link was handed back.
   */
  async findOrCreateShare(doc, { name } = {}) {
    const hash = await this.hashDocument(doc, { name });
    const cache = await this.#cache();
    const cached = cache.data.shares[hash];
    if (
      cached?.link &&
      (!cached.expiresAt || Date.parse(cached.expiresAt) > Date.now())
    ) {
      try {
        await this.getShare(cached.id);
        return { ...cached, reused: true };
      } catch (e) {
        delete cache.data.shares[hash];
      }
    }
    const created = await this.createShare(doc, { name });
    const entry = {
      id: created.id ?? this.parseShareUrl(created.link)?.id,
      link: created.link,
      expiresAt: created.expiresAt ?? null,
      createdAt: Date.now(),
    };
    cache.data.shares[hash] = entry;
    this.#pruneCache(cache.data.shares);
    cache.saveSoon();
    return { ...created, ...entry, reused: false };
  }

  /**
   * @param {object} doc - A share document.
   * @param {{name?: string}} options - The sharer name, part of the identity.
   * @returns {Promise<string>} A SHA-256 hex digest of the document with its
   *   keys sorted, so the same content always hashes the same.
   */
  async hashDocument(doc, { name } = {}) {
    const canonical = JSON.stringify(
      { ...doc, name: name || "" },
      (key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1))
            )
          : value
    );
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical)
    );
    return Array.from(new Uint8Array(digest), byte =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  }

  async #cache() {
    if (!this.#cacheFile) {
      this.#cacheFile = new lazy.JSONFile({
        path: PathUtils.join(PathUtils.profileDir, CACHE_FILE),
      });
      await this.#cacheFile.load();
      this.#cacheFile.data.shares ??= {};
    }
    return this.#cacheFile;
  }

  // Drops expired links and keeps only the newest entries.
  #pruneCache(shares) {
    const now = Date.now();
    const entries = Object.entries(shares)
      .filter(
        ([, entry]) => !entry.expiresAt || Date.parse(entry.expiresAt) > now
      )
      .sort(([, a], [, b]) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    for (const key of Object.keys(shares)) {
      delete shares[key];
    }
    for (const [key, entry] of entries.slice(0, MAX_CACHE_ENTRIES)) {
      shares[key] = entry;
    }
  }

  /**
   * Recognizes public share page URLs on the configured server.
   *
   * @param {string} spec
   * @returns {?{type: string, id: string}} null when the URL is not a share
   *   page (or no server is configured).
   */
  parseShareUrl(spec) {
    let uri;
    let baseUri;
    try {
      uri = Services.io.newURI(spec);
      baseUri = Services.io.newURI(this.#baseUrl);
    } catch (e) {
      return null;
    }
    if (uri.prePath !== baseUri.prePath) {
      return null;
    }
    const match = uri.filePath.match(SHARE_PATH_RE);
    if (!match) {
      return null;
    }
    const slug = match[1];
    const type = slug === "split" ? "split-view" : slug;
    return { type, id: match[2].toUpperCase() };
  }

  /**
   * Fetches everything needed to preview and import a share: the validated
   * document, plus the sharer's display name.
   *
   * @param {{id: string}} share - As returned by parseShareUrl.
   * @returns {Promise<{doc: object, name: ?string}>}
   */
  async fetchSharePreview(share) {
    const meta = await this.getShare(share.id);
    await this.#assertValidDocument(meta.data);
    return { doc: meta.data, name: meta.name || null };
  }

  /**
   * Fetches a share with its metadata (authed):
   * { id, name, createdAt, expiresAt, size, data }.
   *
   * @param {string} id
   */
  async getShare(id) {
    const response = await this.#request(`${this.#baseUrl}/api/shares/${id}`, {
      headers: this.#authHeaders(),
    });
    return response.json();
  }
}

export const ZenShareClient = new nsZenShareClient();
