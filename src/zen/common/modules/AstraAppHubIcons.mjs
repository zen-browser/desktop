/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Local-only App Hub icon helpers.
 * Packaged default icons: chrome allowlist only.
 * Custom icons: bounded data:image/png|webp only (never filesystem URLs or remote).
 * Never fetches remote favicons for the default grid.
 */

export const ICON_DIR_NAME = "astra-app-hub-icons";
/** Max user-picked source file size before decode. */
export const MAX_PICKER_BYTES = 1024 * 1024;
/** Max decoded/stored raster bytes after resize. */
export const MAX_STORED_ICON_BYTES = 96 * 1024;
/** Absolute max persisted data:image URI character length. */
export const MAX_DATA_ICON_CHARS = 256 * 1024;
/** Preferred encoded output edge length. */
export const MAX_ICON_EDGE = 128;
/** Reject decoded bitmaps larger than this on either edge (decompression bomb). */
export const MAX_DECODE_EDGE = 8192;
/** Soft total budget for all custom icon data URIs in state. */
export const MAX_TOTAL_CUSTOM_ICON_CHARS = 4 * 1024 * 1024;

/** @deprecated use MAX_STORED_ICON_BYTES */
export const MAX_ICON_BYTES = MAX_STORED_ICON_BYTES;

const ICON_BASE =
  "chrome://browser/content/zen-components/app-hub-icons/";

/** Persisted / Places-accepted MIME types (no SVG, no ICO storage). */
const ALLOWED_DATA_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Source picker MIME types (ICO accepted as input only; output is PNG). */
const ALLOWED_SOURCE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/**
 * Stable packaged icon map (iconKey → local chrome URL).
 * Unknown keys must not pass through arbitrary URLs.
 */
export const ASTRA_APP_HUB_ICONS = Object.freeze({
  gmail: `${ICON_BASE}gmail.svg`,
  whatsapp: `${ICON_BASE}whatsapp.svg`,
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

export function isSafeIconFileName(name) {
  return (
    typeof name === "string" &&
    /^[a-zA-Z0-9._-]{1,100}\.(png|jpe?g|webp|ico)$/i.test(name) &&
    !name.includes("..")
  );
}

function decodeBase64Payload(payload) {
  try {
    const binary = atob(payload);
    if (!binary.length || binary.length > MAX_STORED_ICON_BYTES) {
      return null;
    }
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Validate a stored data:image URI. Rejects remote/script/privilege schemes,
 * SVG, ICO storage, malformed/oversized base64.
 * @returns {string} sanitized URI or ""
 */
export function sanitizeDataImageURI(value) {
  if (typeof value !== "string" || !value) {
    return "";
  }
  if (value.length > MAX_DATA_ICON_CHARS) {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length < 22 || trimmed.length > MAX_DATA_ICON_CHARS) {
    return "";
  }
  if (!/^data:image\//i.test(trimmed)) {
    return "";
  }
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("javascript:") ||
    lower.startsWith("http:") ||
    lower.startsWith("https:") ||
    lower.startsWith("//") ||
    lower.startsWith("chrome:") ||
    lower.startsWith("resource:") ||
    lower.startsWith("file:") ||
    lower.startsWith("moz-extension:") ||
    /^page-icon:/i.test(trimmed) ||
    lower.includes("image/svg") ||
    lower.includes("text/html") ||
    trimmed.includes("..")
  ) {
    return "";
  }
  const comma = trimmed.indexOf(",");
  if (comma < 0) {
    return "";
  }
  const header = trimmed.slice(5, comma).toLowerCase();
  const mime = header.split(";")[0];
  if (!ALLOWED_DATA_MIME.has(mime)) {
    return "";
  }
  if (!header.includes("base64")) {
    return "";
  }
  const payload = trimmed.slice(comma + 1).replace(/\s+/g, "");
  if (!payload || payload.length > MAX_DATA_ICON_CHARS || /[^A-Za-z0-9+/=]/.test(payload)) {
    return "";
  }
  const decoded = decodeBase64Payload(payload);
  if (!decoded || !decoded.byteLength) {
    return "";
  }
  // Rebuild canonical form (trimmed, no whitespace in payload).
  return `data:${mime};base64,${payload}`;
}

/**
 * Allowlisted packaged chrome URL for an iconKey, or null.
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

/**
 * Resolve a legacy filename only inside the Astra-controlled icon directory.
 * Never returns a path outside that directory.
 */
export function resolveLocalIconPath(fileName) {
  if (!isSafeIconFileName(fileName)) {
    return null;
  }
  const dir = getIconDirectory();
  const path = PathUtils.join(dir, fileName);
  // Containment: joined path must start with icon directory.
  if (!path.startsWith(dir)) {
    return null;
  }
  return path;
}

/**
 * Packaged chrome / data-image only. Filesystem URLs intentionally excluded from render.
 */
export function isPackagedIconUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }
  return (
    url.startsWith("chrome://") ||
    url.startsWith("resource://") ||
    url.startsWith("data:image/")
  );
}

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
 * Derive iconSource from valid payloads only (never trust stored iconSource).
 * @returns {"custom"|"places"|"monogram"}
 */
export function resolveIconSource(app) {
  if (sanitizeDataImageURI(app?.customIconData)) {
    return "custom";
  }
  if (sanitizeDataImageURI(app?.cachedFaviconData)) {
    return "places";
  }
  if (getPackagedIconURL(app?.iconKey || app?.id)) {
    return "custom";
  }
  return "monogram";
}

/**
 * Resolve display icon.
 * Priority: customIconData → cachedFaviconData → packaged → monogram.
 * Legacy filenames are never rendered as filesystem URLs — migrate separately.
 */
export function resolveAppIcon(app) {
  const monogram = normalizeMonogram(
    app?.monogram,
    app?.name || app?.id || "?"
  );
  const accent = monogramAccentIndex(app?.id || app?.name || "");

  const customData = sanitizeDataImageURI(app?.customIconData);
  if (customData) {
    return {
      type: "image",
      src: customData,
      monogram,
      accent,
      iconSource: "custom",
    };
  }

  const cached = sanitizeDataImageURI(app?.cachedFaviconData);
  if (cached) {
    return {
      type: "image",
      src: cached,
      monogram,
      accent,
      iconSource: "places",
    };
  }

  const packaged = getPackagedIconURL(app?.iconKey || app?.id);
  if (packaged) {
    return {
      type: "image",
      src: packaged,
      monogram,
      accent,
      iconSource: "custom",
    };
  }

  return {
    type: "monogram",
    text: monogram,
    monogram,
    accent,
    iconSource: "monogram",
  };
}

/**
 * Local Places favicon → sanitized PNG/JPEG/WebP data:image only.
 * ICO and other engine-decoded formats are resized/normalized to PNG.
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
    if (typeof spec !== "string" || !spec) {
      return null;
    }
    // Never accept remote/privilege schemes from Places wrappers.
    if (
      !/^data:image\//i.test(spec) ||
      /^page-icon:/i.test(spec) ||
      /^https?:/i.test(spec) ||
      /^file:/i.test(spec)
    ) {
      return null;
    }
    const direct = sanitizeDataImageURI(spec);
    if (direct) {
      return direct;
    }
    // Normalize ICO / oversized / non-allowlisted raster via decode+PNG resize.
    const comma = spec.indexOf(",");
    if (comma < 0 || !/base64/i.test(spec.slice(0, comma))) {
      return null;
    }
    const header = spec.slice(5, comma).toLowerCase();
    const mime = header.split(";")[0];
    if (!ALLOWED_SOURCE_MIME.has(mime) || mime.includes("svg")) {
      return null;
    }
    const payload = spec.slice(comma + 1).replace(/\s+/g, "");
    if (!payload || payload.length > MAX_DATA_ICON_CHARS) {
      return null;
    }
    let bytes;
    try {
      const binary = atob(payload);
      if (!binary.length || binary.length > MAX_PICKER_BYTES) {
        return null;
      }
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    } catch {
      return null;
    }
    try {
      return await rasterBytesToSafeDataURI(bytes, mime);
    } catch {
      return null;
    }
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
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
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

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunk, bytes.length))
    );
  }
  return btoa(binary);
}

/**
 * Decode + resize to <=128px PNG data URI. Always normalizes output.
 */
export async function rasterBytesToSafeDataURI(bytes, mime) {
  if (!bytes?.byteLength) {
    throw new Error("empty");
  }
  if (bytes.byteLength > MAX_PICKER_BYTES) {
    throw new Error("too-large");
  }
  if (!mime || !ALLOWED_SOURCE_MIME.has(mime)) {
    throw new Error("unsupported-type");
  }
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
    throw new Error("unsupported-type");
  }

  const blob = new Blob([bytes], { type: mime });
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error("unsupported-type");
  }
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width > MAX_DECODE_EDGE ||
      bitmap.height > MAX_DECODE_EDGE
    ) {
      throw new Error("too-large");
    }
    const scale = Math.min(
      1,
      MAX_ICON_EDGE / Math.max(bitmap.width, bitmap.height, 1)
    );
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("no-canvas");
    }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const outBlob = await canvas.convertToBlob({ type: "image/png" });
    const outBytes = new Uint8Array(await outBlob.arrayBuffer());
    if (!outBytes.byteLength || outBytes.byteLength > MAX_STORED_ICON_BYTES) {
      throw new Error("too-large");
    }
    const uri = `data:image/png;base64,${bytesToBase64(outBytes)}`;
    if (uri.length > MAX_DATA_ICON_CHARS) {
      throw new Error("too-large");
    }
    const safe = sanitizeDataImageURI(uri);
    if (!safe) {
      throw new Error("unsupported-type");
    }
    return safe;
  } finally {
    try {
      bitmap.close();
    } catch {
      // ignore
    }
  }
}

/**
 * One-shot migration: legacy profile filename → bounded PNG data URI.
 * Only reads from ICON_DIR_NAME. Returns "" on any failure.
 */
export async function migrateLegacyIconFileName(fileName) {
  const path = resolveLocalIconPath(fileName);
  if (!path) {
    return "";
  }
  try {
    const exists = await IOUtils.exists(path);
    if (!exists) {
      return "";
    }
    const bytes = await IOUtils.read(path);
    if (!bytes?.byteLength || bytes.byteLength > MAX_PICKER_BYTES) {
      return "";
    }
    const mime = sniffImageMime(bytes);
    if (!mime || !ALLOWED_SOURCE_MIME.has(mime)) {
      return "";
    }
    return await rasterBytesToSafeDataURI(bytes, mime);
  } catch {
    return "";
  }
}

/**
 * Pick an image via nsIFilePicker → safe PNG data URI (no path persistence).
 */
export async function pickCustomIconAsDataURI(win) {
  const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  fp.init(win.browsingContext, "Choose App Icon", Ci.nsIFilePicker.modeOpen);
  fp.appendFilter("Images", "*.png;*.jpg;*.jpeg;*.webp;*.ico");
  fp.appendFilters(Ci.nsIFilePicker.filterImages);
  const result = await new Promise(resolve => fp.open(resolve));
  if (result !== Ci.nsIFilePicker.returnOK || !fp.file) {
    return null;
  }
  const bytes = await IOUtils.read(fp.file.path);
  if (!bytes?.byteLength) {
    throw new Error("empty");
  }
  if (bytes.byteLength > MAX_PICKER_BYTES) {
    throw new Error("too-large");
  }
  const mime = sniffImageMime(bytes);
  if (!mime || !ALLOWED_SOURCE_MIME.has(mime)) {
    throw new Error("unsupported-type");
  }
  return rasterBytesToSafeDataURI(bytes, mime);
}

/** @deprecated */
export async function pickAndStoreCustomIcon(win) {
  return pickCustomIconAsDataURI(win);
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
 * Estimate total custom icon URI chars across apps (for soft budget).
 */
export function totalCustomIconChars(apps) {
  if (!Array.isArray(apps)) {
    return 0;
  }
  let total = 0;
  for (const app of apps) {
    if (typeof app?.customIconData === "string") {
      total += app.customIconData.length;
    }
    if (typeof app?.cachedFaviconData === "string") {
      total += app.cachedFaviconData.length;
    }
  }
  return total;
}
