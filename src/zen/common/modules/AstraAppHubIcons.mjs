/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Local-only App Hub icon helpers.
 * Packaged default icons: chrome allowlist only.
 * Custom icons stay in the profile directory.
 * Never fetches remote favicons for the default grid.
 */

export const ICON_DIR_NAME = "astra-app-hub-icons";
export const MAX_ICON_BYTES = 512 * 1024;

const ICON_BASE =
  "chrome://browser/content/zen-components/app-hub-icons/";

/**
 * Stable packaged icon map (iconKey → local chrome URL).
 * Unknown keys must not pass through arbitrary URLs.
 */
export const ASTRA_APP_HUB_ICONS = Object.freeze({
  gmail: `${ICON_BASE}gmail.svg`,
  outlook: `${ICON_BASE}outlook.svg`,
  "zoho-mail": `${ICON_BASE}zoho-mail.svg`,
  "yahoo-mail": `${ICON_BASE}yahoo-mail.svg`,
  protonmail: `${ICON_BASE}proton-mail.svg`,
  "google-meet": `${ICON_BASE}google-meet.svg`,
  zoom: `${ICON_BASE}zoom.svg`,
  "ms-teams": `${ICON_BASE}microsoft-teams.svg`,
  webex: `${ICON_BASE}webex.svg`,
  "google-drive": `${ICON_BASE}google-drive.svg`,
  onedrive: `${ICON_BASE}onedrive.svg`,
  dropbox: `${ICON_BASE}dropbox.svg`,
  "zoho-drive": `${ICON_BASE}zoho-drive.svg`,
  "google-docs": `${ICON_BASE}google-docs.svg`,
  "microsoft-365": `${ICON_BASE}microsoft-365.svg`,
  notion: `${ICON_BASE}notion.svg`,
  canva: `${ICON_BASE}canva.svg`,
  "zoho-docs": `${ICON_BASE}zoho-docs.svg`,
  classroom: `${ICON_BASE}classroom.svg`,
  "teams-edu": `${ICON_BASE}teams-edu.svg`,
  "zoom-edu": `${ICON_BASE}zoom-edu.svg`,
  swayam: `${ICON_BASE}swayam.svg`,
  youtube: `${ICON_BASE}youtube.svg`,
  spotify: `${ICON_BASE}spotify.svg`,
  jiosaavn: `${ICON_BASE}jiosaavn.svg`,
  jiohotstar: `${ICON_BASE}jiohotstar.svg`,
  netflix: `${ICON_BASE}netflix.svg`,
  amazon: `${ICON_BASE}amazon.svg`,
  flipkart: `${ICON_BASE}flipkart.svg`,
  meesho: `${ICON_BASE}meesho.svg`,
  myntra: `${ICON_BASE}myntra.svg`,
  irctc: `${ICON_BASE}irctc.svg`,
  "income-tax": `${ICON_BASE}income-tax.svg`,
  digilocker: `${ICON_BASE}digilocker.svg`,
  "gst-portal": `${ICON_BASE}gst-portal.svg`,
  epfo: `${ICON_BASE}epfo.svg`,
  inshorts: `${ICON_BASE}inshorts.svg`,
  ndtv: `${ICON_BASE}ndtv.svg`,
  toi: `${ICON_BASE}toi.svg`,
  "google-news": `${ICON_BASE}google-news.svg`,
  linkedin: `${ICON_BASE}linkedin.svg`,
  slack: `${ICON_BASE}slack.svg`,
  freshdesk: `${ICON_BASE}freshdesk.svg`,
  trello: `${ICON_BASE}trello.svg`,
});

const ALLOWED_MIME = new Set([
  "image/png",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const EXT_FOR_MIME = {
  "image/png": "png",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

function isSafeIconFileName(name) {
  return (
    typeof name === "string" &&
    /^[a-zA-Z0-9._-]{1,100}\.(png|webp|ico)$/i.test(name) &&
    !name.includes("..")
  );
}

/**
 * Allowlisted packaged chrome/resource URL for an iconKey, or null.
 */
export function getPackagedIconURL(iconKey) {
  if (typeof iconKey !== "string" || !iconKey) {
    return null;
  }
  const url = ASTRA_APP_HUB_ICONS[iconKey];
  if (typeof url !== "string" || !url) {
    return null;
  }
  if (!url.startsWith(ICON_BASE) || url.includes("..")) {
    return null;
  }
  return url;
}

export function getIconDirectory() {
  return PathUtils.join(PathUtils.profileDir, ICON_DIR_NAME);
}

export async function ensureIconDirectory() {
  const dir = getIconDirectory();
  await IOUtils.makeDirectory(dir, {
    ignoreExisting: true,
    createAncestors: true,
  });
  return dir;
}

export function resolveLocalIconPath(fileName) {
  if (!isSafeIconFileName(fileName)) {
    return null;
  }
  return PathUtils.join(getIconDirectory(), fileName);
}

export function localIconFileURI(fileName) {
  const path = resolveLocalIconPath(fileName);
  if (!path) {
    return "";
  }
  try {
    return PathUtils.toFileURI(path);
  } catch {
    return "";
  }
}

/**
 * Packaged chrome icons / local file / data-image URIs only (never http/https).
 * Places cache URIs that may network-fetch are intentionally excluded.
 */
export function isPackagedIconUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }
  return (
    url.startsWith("chrome://") ||
    url.startsWith("resource://") ||
    url.startsWith("moz-icon://") ||
    url.startsWith("file://") ||
    url.startsWith("data:image/")
  );
}

/**
 * Monogram text from app name (CSS-rendered; no network).
 */
export function monogramForName(name) {
  if (typeof name === "string" && name.trim()) {
    const cleaned = name
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .trim();
    if (!cleaned) {
      return name.trim().slice(0, 1).toUpperCase() || "?";
    }
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "?";
}

/**
 * Deterministic accent index for monogram background (0–7).
 */
export function monogramAccentIndex(idOrName) {
  const s = String(idOrName || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash % 8;
}

function normalizeMonogram(value, fallbackName) {
  if (typeof value === "string") {
    const trimmed = value.trim().slice(0, 3);
    if (trimmed.length >= 1) {
      return trimmed;
    }
  }
  return monogramForName(fallbackName);
}

/**
 * Resolve display icon for an app.
 * Priority: custom local file → packaged iconKey → safe local URI → monogram.
 * @returns {{ type: "image", src: string, monogram: string, accent: number } |
 *           { type: "monogram", text: string, accent: number }}
 */
export function resolveAppIcon(app) {
  const monogram = normalizeMonogram(
    app?.monogram,
    app?.name || app?.id || "?"
  );
  const accent = monogramAccentIndex(app?.id || app?.name || "");

  if (app?.icon && isSafeIconFileName(app.icon)) {
    const uri = localIconFileURI(app.icon);
    if (uri) {
      return { type: "image", src: uri, monogram, accent };
    }
  }

  const packaged = getPackagedIconURL(app?.iconKey || app?.id);
  if (packaged) {
    return { type: "image", src: packaged, monogram, accent };
  }

  // Optional already-resolved local URI (chrome/resource/file/data-image only).
  if (app?.icon && isPackagedIconUrl(app.icon)) {
    const safe = String(app.icon);
    if (
      !safe.startsWith("http:") &&
      !safe.startsWith("https:") &&
      !safe.startsWith("//")
    ) {
      return { type: "image", src: safe, monogram, accent };
    }
  }

  return {
    type: "monogram",
    text: monogram,
    accent,
  };
}

/**
 * Resolve a local Places favicon data: URI for a user-added app.
 * Uses getFaviconForPage (same pattern as ZenPinnedTabManager) and returns
 * only data:image/... — never http(s) and never network-fetching cache schemes.
 * Returns null when unavailable or in private windows.
 */
export async function resolvePlacesFaviconURL(
  pageUrl,
  { privateBrowsing = false } = {}
) {
  if (privateBrowsing || typeof pageUrl !== "string" || !pageUrl) {
    return null;
  }
  try {
    const uri = Services.io.newURI(pageUrl);
    if (uri.scheme !== "https" && uri.scheme !== "http") {
      return null;
    }
    const favicon = await PlacesUtils.favicons.getFaviconForPage(uri);
    const dataURI = favicon?.dataURI;
    const spec = typeof dataURI === "string" ? dataURI : dataURI?.spec;
    if (
      typeof spec !== "string" ||
      !spec.startsWith("data:image/") ||
      spec.length > MAX_ICON_BYTES * 2
    ) {
      return null;
    }
    return spec;
  } catch {
    return null;
  }
}

function sniffImageMime(bytes) {
  if (!bytes || bytes.length < 12) {
    return null;
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  ) {
    return "image/x-icon";
  }
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 64))
    .trimStart()
    .toLowerCase();
  if (
    head.startsWith("<svg") ||
    head.startsWith("<?xml") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.includes("<script")
  ) {
    return null;
  }
  return null;
}

/**
 * Copy a user-selected image into the App Hub icon directory.
 * Rejects SVG and unknown/polyglot content. Returns stored file name.
 */
export async function storeCustomIconFromFile(sourcePath) {
  if (typeof sourcePath !== "string" || !sourcePath) {
    throw new Error("no-path");
  }
  const bytes = await IOUtils.read(sourcePath);
  if (!bytes || bytes.byteLength === 0) {
    throw new Error("empty");
  }
  if (bytes.byteLength > MAX_ICON_BYTES) {
    throw new Error("too-large");
  }
  const mime = sniffImageMime(bytes);
  if (!mime || !ALLOWED_MIME.has(mime)) {
    throw new Error("unsupported-type");
  }
  const ext = EXT_FOR_MIME[mime];
  const fileName = `${crypto.randomUUID()}.${ext}`;
  await ensureIconDirectory();
  const dest = resolveLocalIconPath(fileName);
  if (!dest) {
    throw new Error("bad-name");
  }
  await IOUtils.write(dest, bytes, { tmpPath: `${dest}.tmp` });
  return fileName;
}

export async function deleteCustomIcons(fileNames) {
  if (!Array.isArray(fileNames) || !fileNames.length) {
    return;
  }
  for (const name of fileNames) {
    const path = resolveLocalIconPath(name);
    if (!path) {
      continue;
    }
    try {
      await IOUtils.remove(path, { ignoreAbsent: true });
    } catch {
      // ignore
    }
  }
}

/**
 * Pick an image file via nsIFilePicker. Returns stored file name or null.
 */
export async function pickAndStoreCustomIcon(win) {
  const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  fp.init(win.browsingContext, "Choose App Icon", Ci.nsIFilePicker.modeOpen);
  fp.appendFilter("Images", "*.png;*.webp;*.ico");
  fp.appendFilters(Ci.nsIFilePicker.filterImages);
  const result = await new Promise(resolve => fp.open(resolve));
  if (result !== Ci.nsIFilePicker.returnOK || !fp.file) {
    return null;
  }
  return storeCustomIconFromFile(fp.file.path);
}
