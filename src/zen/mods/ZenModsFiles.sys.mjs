// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { setTimeout } from "resource://gre/modules/Timer.sys.mjs";

/*
 * What every part of Zen Mods reads a mod's files with: the paths in
 * `theme.json`, `theme.json` itself, a folder's files and downloads.
 */

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_REMOTE_FILES = 1000;
const DOWNLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const STYLE_FILES = ["chrome.css", "userChrome.css"];
const DEFAULT_LOAD_ORDER = 10;
const SCRIPT_KINDS = [
  [".uc.mjs", "uc.mjs"],
  [".uc.js", "uc.js"],
  [".sys.mjs", "module"],
];

/**
 * Lists the files in a mod's folder, the hidden ones and `node_modules`
 * aside, sorted by path.
 *
 * @param {string} folder
 * @param {RegExp|null} match - Only the files whose name matches
 * @param {number} limit - More files than this is an error
 * @returns {Promise<{path: string, info: object}[]>} Each file and its
 * `IOUtils.stat`
 */
export async function listModFiles(folder, match, limit) {
  const files = [];
  const visit = async directory => {
    for (const child of await IOUtils.getChildren(directory)) {
      const name = PathUtils.filename(child);

      if (name.startsWith(".") || name === "node_modules") {
        continue;
      }

      const info = await IOUtils.stat(child);

      if (info.type === "directory") {
        await visit(child);
      } else if (!match || match.test(name)) {
        files.push({ path: child, info });
      }

      if (files.length > limit) {
        throw new Error(`[ZenMods]: More than ${limit} files in ${folder}.`);
      }
    }
  };

  await visit(folder);

  return files.sort((first, second) =>
    first.path < second.path ? -1 : Number(first.path > second.path)
  );
}

/**
 * Splits a path from `theme.json` into the folders and file it goes through,
 * as long as it stays inside the mod's folder.
 *
 * @param {*} path - A path like "src/main.mjs"
 * @returns {string[]|null} Its parts, or null if it's not a valid path
 */
export function pathParts(path) {
  if (typeof path !== "string" || !path) {
    return null;
  }

  const parts = path.split("/");
  const isValid = parts.every(
    part => part && part !== "." && part !== ".." && !/[\\:]/.test(part)
  );

  return isValid ? parts : null;
}

/**
 * @param {string} path - A valid relative path
 * @returns {string} The path, each part encoded for a URL
 */
export function encodePath(path) {
  return pathParts(path).map(encodeURIComponent).join("/");
}

/**
 * @param {*} value
 * @returns {string[]|null} The strings in a list, or null if it's no list
 */
function stringList(value) {
  return Array.isArray(value)
    ? value.filter(item => typeof item === "string")
    : null;
}

/**
 * Turns the `scripts` of a `theme.json` into one list. A list of paths is
 * Zen's own format: ES modules that export `init(window)` and
 * `uninit(window)`. A map of paths is the userChrome.js format other mod
 * managers use, where folders nest as keys ending in "/": `.uc.js` and
 * `.uc.mjs` files run in each document their `include` patterns match, and
 * `.sys.mjs` files run once.
 *
 * @param {*} scripts
 * @returns {{path: string, kind: "module"|"uc.js"|"uc.mjs", include?: string[], exclude?: string[], loadOrder?: number}[]}
 */
function normalizeScripts(scripts) {
  if (scripts === undefined || scripts === null) {
    return [];
  }

  if (Array.isArray(scripts)) {
    return scripts.map(path => {
      if (!pathParts(path) || !path.endsWith(".mjs")) {
        throw new Error(`[ZenMods]: Invalid script path: ${path}`);
      }

      return { path, kind: "module" };
    });
  }

  if (typeof scripts !== "object") {
    throw new Error(
      '[ZenMods]: "scripts" in theme.json must be a list or a map.'
    );
  }

  const normalized = [];
  const visit = (entries, prefix) => {
    for (const [key, options] of Object.entries(entries)) {
      const path = `${prefix}${key}`;

      if (key.endsWith("/") && options && typeof options === "object") {
        visit(options, path);
        continue;
      }

      const kind = SCRIPT_KINDS.find(([extension]) =>
        path.endsWith(extension)
      )?.[1];

      if (!kind || !pathParts(path)) {
        console.warn(`[ZenMods]: Unsupported script ${path}, skipping.`);
        continue;
      }

      normalized.push({
        path,
        kind,
        include: stringList(options?.include) ?? ["main"],
        exclude: stringList(options?.exclude) ?? [],
        loadOrder: Number.isInteger(options?.loadOrder)
          ? options.loadOrder
          : DEFAULT_LOAD_ORDER,
      });
    }
  };

  visit(scripts, "");

  return normalized;
}

/**
 * Reads what a `theme.json` declares, in Zen's format or in the one other
 * mod managers use, where `style` is `{chrome, content}` and `scripts` is a
 * map.
 *
 * @param {*} manifest
 * @returns {object}
 */
export function parseManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("[ZenMods]: theme.json is not an object.");
  }

  const text = key => (typeof manifest[key] === "string" ? manifest[key] : "");
  const isStyleObject =
    Boolean(manifest.style) && typeof manifest.style === "object";
  const style = isStyleObject ? manifest.style.chrome : manifest.style;
  const contentStyle = isStyleObject ? manifest.style.content : null;

  return {
    name: text("name"),
    version: text("version"),
    author: text("author"),
    description: text("description"),
    homepage: text("homepage"),
    stylePath: pathParts(style) ? style : null,
    contentStylePath: pathParts(contentStyle) ? contentStyle : null,
    preferencesPath: pathParts(manifest.preferences)
      ? manifest.preferences
      : "preferences.json",
    scripts: normalizeScripts(manifest.scripts),
  };
}

/**
 * @param {string|null} declared - The style a `theme.json` names, if any
 * @param {(path: string) => Promise<boolean>} exists
 * @returns {Promise<string|null>} The mod's style file, if it has one
 */
export async function findStyle(declared, exists) {
  for (const candidate of declared ? [declared] : STYLE_FILES) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Mod files only come over HTTPS from where they're expected, also after
 * redirects.
 *
 * @param {string} url
 * @param {(string|RegExp)[]} allowed - URL prefixes, or patterns
 */
export function assertAllowedUrl(url, allowed) {
  const parsed = URL.parse(url);

  if (parsed?.protocol !== "https:") {
    throw new Error(`[ZenMods]: Refusing a non-HTTPS mod URL: ${url}`);
  }

  const isAllowed = allowed.some(prefix =>
    prefix instanceof RegExp
      ? prefix.test(parsed.href)
      : parsed.href.startsWith(prefix)
  );

  if (!isAllowed) {
    throw new Error(`[ZenMods]: Refusing a mod URL from elsewhere: ${url}`);
  }
}

/**
 * @param {string} url
 * @param {(string|RegExp)[]} allowed - URL prefixes, or patterns, it may
 * come from
 * @param {Record<string, string>} [headers]
 * @returns {Promise<Uint8Array>}
 */
export async function download(url, allowed, headers = {}) {
  assertAllowedUrl(url, allowed);

  let lastError;

  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      assertAllowedUrl(response.url, allowed);

      if (Number(response.headers.get("content-length")) > MAX_FILE_BYTES) {
        throw new Error(`${url} is larger than ${MAX_FILE_BYTES} bytes`);
      }

      const buffer = await response.arrayBuffer();

      if (buffer.byteLength > MAX_FILE_BYTES) {
        throw new Error(`${url} is larger than ${MAX_FILE_BYTES} bytes`);
      }

      return new Uint8Array(buffer);
    } catch (error) {
      lastError = error;

      if (attempt < DOWNLOAD_ATTEMPTS) {
        console.warn(
          `[ZenMods]: Download failed (attempt ${attempt} of ${DOWNLOAD_ATTEMPTS}), retrying in ${RETRY_DELAY_MS}ms.`,
          url,
          error
        );

        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
}
