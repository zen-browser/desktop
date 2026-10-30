// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenLiveFolderProvider } from "resource:///modules/zen/ZenLiveFolder.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

const MAX_RESPONSE_SIZE = 1024 * 1024; // 1 MB per spec
const DEFAULT_MAX_ITEMS = 100;
const DEFAULT_ICON = "chrome://browser/skin/zen-icons/selectable/code.svg";

/**
 * Resolves a dot-notation path in an object (e.g. "data.posts" -> obj.data.posts).
 * Empty path returns the object itself.
 *
 * @param {object} obj - The root object.
 * @param {string} path - Dot-separated path (e.g. "data.items", "" for root).
 * @returns {unknown} The value at the path, or undefined if not found.
 */
function getByPath(obj, path) {
  if (!path || typeof path !== "string") {
    return obj;
  }
  const parts = path.trim().split(".").filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * Builds the final URL from a template and params.
 * - Replaces {key} placeholders in the URL with params[key] (URL-encoded).
 * - Params not used in the path are appended as query string.
 *
 * @param {string} urlTemplate - URL with optional {paramName} placeholders.
 * @param {object} params - Key-value pairs for substitution and query params.
 * @returns {string} The resolved URL.
 */
function buildUrl(urlTemplate, params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return urlTemplate;
  }

  const used = new Set();
  let url = urlTemplate;

  for (const [key, value] of Object.entries(params)) {
    if (value == null || typeof value !== "string") {
      continue;
    }
    const placeholder = `{${key}}`;
    if (url.includes(placeholder)) {
      url = url.split(placeholder).join(encodeURIComponent(value));
      used.add(key);
    }
  }

  const queryParams = Object.entries(params)
    .filter(([k, v]) => !used.has(k) && v != null && typeof v === "string")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);

  if (queryParams.length > 0) {
    const sep = url.includes("?") ? "&" : "?";
    url += sep + queryParams.join("&");
  }

  return url;
}

/**
 * URI used for favicon lookup. API subdomains (e.g. api.github.com) often have no
 * favicon; use the registrable site (github.com) instead.
 *
 * @param {string} pageUrl - Resolved request URL.
 * @returns {nsIURI}
 */
function faviconLookupUri(pageUrl) {
  const uri = Services.io.newURI(pageUrl);
  if (uri.host.startsWith("api.")) {
    const siteHost = uri.host.slice(4);
    return Services.io.newURI(`${uri.scheme}://${siteHost}/`);
  }
  return uri;
}

export class nsRestAPILiveFolderProvider extends nsZenLiveFolderProvider {
  static type = "rest";

  constructor({ id, state, manager }) {
    super({ id, state, manager });

    this.state.url = state.url ?? "";
    this.state.params =
      state.params && typeof state.params === "object" && !Array.isArray(state.params)
        ? state.params
        : {};
    this.state.mapping = state.mapping ?? {
      items: "",
      id: "id",
      title: "title",
      url: "url",
    };
    this.state.label = state.label ?? "";
    this.state.icon = state.icon ?? "";
    this.state.maxItems = state.maxItems ?? DEFAULT_MAX_ITEMS;
    this.state.headers = state.headers && typeof state.headers === "object" ? state.headers : {};
  }

  async fetchItems() {
    try {
      const url = buildUrl(this.state.url, this.state.params);
      const { text } = await this.fetch(url, {
        maxContentLength: MAX_RESPONSE_SIZE,
        headers: this.state.headers,
      });

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return "zen-live-folder-failed-fetch";
      }

      const mapping = this.state.mapping;
      const itemsPath = mapping.items ?? "";
      let items = getByPath(data, itemsPath);

      if (!Array.isArray(items)) {
        if (itemsPath === "" && Array.isArray(data)) {
          items = data;
        } else {
          return "zen-live-folder-failed-fetch";
        }
      }

      const maxItems = this.state.maxItems ?? DEFAULT_MAX_ITEMS;
      const mapped = items
        .slice(0, maxItems)
        .map((item) => {
          const id = getByPath(item, mapping.id ?? "id");
          const title = getByPath(item, mapping.title ?? "title");
          const url = getByPath(item, mapping.url ?? "url");
          if (id == null || title == null || url == null) {
            return null;
          }
          const result = {
            id: String(id),
            title: String(title),
            url: String(url),
          };
          if (mapping.subtitle) {
            const subtitle = getByPath(item, mapping.subtitle);
            if (subtitle != null) {
              result.subtitle = String(subtitle);
            }
          }
          return result;
        })
        .filter(Boolean);

      return mapped;
    } catch (error) {
      console.error("Error fetching or parsing REST API:", error);
      return "zen-live-folder-failed-fetch";
    }
  }

  /**
   * Resolves the folder icon for display. When icon is "favicon", uses Places
   * (same as RSS) so the SVG folder icon gets a data: URI, not a remote .ico URL.
   *
   * @param {string} [icon] - Config icon value.
   * @param {string} [urlTemplate] - API URL template.
   * @param {object} [params] - URL params.
   * @returns {Promise<string>}
   */
  static async resolveFolderIcon(icon, urlTemplate, params = {}) {
    if (icon && icon !== "favicon") {
      return icon;
    }
    if (!urlTemplate) {
      return DEFAULT_ICON;
    }

    let pageUrl;
    try {
      pageUrl = buildUrl(urlTemplate, params);
    } catch {
      return DEFAULT_ICON;
    }

    try {
      const favicon = await lazy.PlacesUtils.favicons.getFaviconForPage(
        faviconLookupUri(pageUrl)
      );
      if (favicon?.dataURI?.spec) {
        return favicon.dataURI.spec;
      }
    } catch (error) {
      console.error("Failed to resolve favicon for REST live folder:", error);
    }

    return DEFAULT_ICON;
  }

  async getMetadata() {
    const icon = await nsRestAPILiveFolderProvider.resolveFolderIcon(
      this.state.icon,
      this.state.url,
      this.state.params
    );
    return {
      label: this.state.label || this.state.url || "REST API",
      icon,
    };
  }

  get options() {
    return [
      {
        label: "Edit configuration...",
        key: "editConfig",
      },
    ];
  }

  onOptionTrigger(option) {
    super.onOptionTrigger(option);
    const key = option.getAttribute("option-key");
    if (key === "editConfig") {
      this.#openEditConfigDialog();
    }
  }

  async #openEditConfigDialog() {
    const { openRestLiveFolderDialog } = ChromeUtils.importESModule(
      "resource:///modules/zen/RestLiveFolderDialog.sys.mjs",
      { global: "current" }
    );
    await openRestLiveFolderDialog(this.manager.window, { liveFolder: this });
  }

  serialize() {
    return {
      state: {
        ...this.state,
        url: this.state.url,
        params: this.state.params,
        mapping: this.state.mapping,
        label: this.state.label,
        icon: this.state.icon,
        maxItems: this.state.maxItems,
        headers: this.state.headers,
      },
    };
  }
}
