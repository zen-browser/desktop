/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Search Hub shortcut storage and local-only icon resolution.
 *
 * Icon pipeline (no network on NTP paint):
 *   packaged chrome SVG → cached Places / stored data URI → monogram
 *
 * Remote favicon discovery (App Hub's fetchRemoteFaviconAsDataURI) is
 * intentionally not called here.
 */

import { ASTRA_APP_HUB_CATALOG } from "chrome://browser/content/zen-components/AstraAppHubCatalog.mjs";
import {
  getPackagedIconURL,
  resolveAppIcon,
  resolvePlacesFaviconURL,
  sanitizeDataImageURI,
} from "chrome://browser/content/zen-components/AstraAppHubIcons.mjs";

export const SHORTCUTS_PREF = "astra.newtab.search-hub.shortcuts";
export const MAX_SHORTCUTS = 12;
export const DEFAULT_SHORTCUT_IDS = Object.freeze([
  "gmail",
  "whatsapp",
  "youtube",
  "linkedin",
  "irctc",
  "digilocker",
]);

const catalogById = new Map(
  (ASTRA_APP_HUB_CATALOG.apps || []).map(app => [app.id, app])
);

function catalogShortcut(id) {
  const app = catalogById.get(id);
  if (!app?.url) {
    return null;
  }
  return {
    id: app.id,
    name: app.name,
    url: app.url,
    iconKey: app.iconKey || app.id,
    monogram: app.monogram || "",
  };
}

export function defaultShortcuts() {
  return DEFAULT_SHORTCUT_IDS.map(catalogShortcut).filter(Boolean);
}

function sanitizeHttpsUrl(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) {
    return "";
  }
  let uri;
  try {
    uri = Services.io.newURI(trimmed);
  } catch {
    try {
      uri = Services.io.newURI(`https://${trimmed}`);
    } catch {
      return "";
    }
  }
  if (uri.scheme !== "https") {
    return "";
  }
  if (!uri.host || uri.host.includes("..")) {
    return "";
  }
  return uri.spec;
}

function sanitizeName(value, fallback) {
  const text = String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  return text || fallback || "Shortcut";
}

function sanitizeId(value) {
  if (typeof value !== "string") {
    return "";
  }
  const id = value.trim().slice(0, 64);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id)) {
    return "";
  }
  return id;
}

function idFromUrl(url) {
  try {
    const host = Services.io.newURI(url).asciiHost.replace(/^www\./, "");
    const slug = host.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 48);
    return slug ? `custom-${slug}` : `custom-${Date.now()}`;
  } catch {
    return `custom-${Date.now()}`;
  }
}

export function normalizeShortcut(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const url = sanitizeHttpsUrl(raw.url);
  if (!url) {
    return null;
  }
  const catalog =
    catalogById.get(raw.id) ||
    catalogById.get(raw.iconKey) ||
    [...catalogById.values()].find(app => app.url === url);
  const iconKey =
    (typeof raw.iconKey === "string" && getPackagedIconURL(raw.iconKey)
      ? raw.iconKey
      : "") ||
    catalog?.iconKey ||
    catalog?.id ||
    "";
  const id =
    sanitizeId(raw.id) || catalog?.id || idFromUrl(url);
  return {
    id,
    name: sanitizeName(raw.name, catalog?.name || id),
    url,
    iconKey,
    monogram: sanitizeName(raw.monogram || catalog?.monogram || "", "").slice(
      0,
      3
    ),
  };
}

export function loadShortcuts() {
  try {
    const raw = Services.prefs.getStringPref(SHORTCUTS_PREF, "");
    if (raw && raw.trim()) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seen = new Set();
        const items = [];
        for (const entry of parsed) {
          const shortcut = normalizeShortcut(entry);
          if (!shortcut || seen.has(shortcut.id)) {
            continue;
          }
          seen.add(shortcut.id);
          items.push(shortcut);
          if (items.length >= MAX_SHORTCUTS) {
            break;
          }
        }
        if (items.length) {
          return items;
        }
      }
    }
  } catch (e) {
    console.warn("[AstraSearchHub] shortcut pref parse failed:", e);
  }
  return defaultShortcuts();
}

export function saveShortcuts(shortcuts) {
  const items = [];
  const seen = new Set();
  for (const entry of shortcuts || []) {
    const shortcut = normalizeShortcut(entry);
    if (!shortcut || seen.has(shortcut.id)) {
      continue;
    }
    seen.add(shortcut.id);
    items.push(shortcut);
    if (items.length >= MAX_SHORTCUTS) {
      break;
    }
  }
  Services.prefs.setStringPref(SHORTCUTS_PREF, JSON.stringify(items));
  return items;
}

export function addShortcut({ name, url }) {
  const shortcut = normalizeShortcut({ name, url });
  if (!shortcut) {
    throw new Error("invalid-url");
  }
  const items = loadShortcuts();
  const existing = items.findIndex(
    item => item.id === shortcut.id || item.url === shortcut.url
  );
  if (existing >= 0) {
    items[existing] = { ...items[existing], ...shortcut };
  } else {
    if (items.length >= MAX_SHORTCUTS) {
      throw new Error("limit");
    }
    items.push(shortcut);
  }
  return saveShortcuts(items);
}

export function removeShortcut(id) {
  const items = loadShortcuts().filter(item => item.id !== id);
  return saveShortcuts(items);
}

/**
 * Local-only icon: packaged SVG, then in-memory/Places data URI, then monogram.
 * Never issues a network request.
 */
export async function resolveShortcutIcon(shortcut) {
  const app = {
    id: shortcut.id,
    name: shortcut.name,
    url: shortcut.url,
    iconKey: shortcut.iconKey,
    monogram: shortcut.monogram,
    customIconData: sanitizeDataImageURI(shortcut.customIconData || ""),
    cachedFaviconData: "",
  };
  const packaged = resolveAppIcon(app);
  if (packaged.type === "image") {
    return packaged;
  }
  try {
    const places = await resolvePlacesFaviconURL(shortcut.url, {
      privateBrowsing: false,
    });
    if (places) {
      return {
        type: "image",
        src: places,
        monogram: packaged.monogram,
        accent: packaged.accent,
        iconSource: "places",
      };
    }
  } catch {
    // Places miss is expected for never-visited custom URLs.
  }
  return packaged;
}
