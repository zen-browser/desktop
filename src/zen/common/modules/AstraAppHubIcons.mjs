/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Local-only App Hub icon helpers.
 * Never fetches remote favicons. Custom icons stay in the profile directory.
 */

export const ICON_DIR_NAME = "astra-app-hub-icons";
export const MAX_ICON_BYTES = 512 * 1024;

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
 * Packaged chrome icons only (never http/https).
 */
export function isPackagedIconUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }
  return (
    url.startsWith("chrome://") ||
    url.startsWith("resource://") ||
    url.startsWith("moz-icon://")
  );
}

/**
 * Monogram text from app name (CSS-rendered; no network).
 */
export function monogramForName(name) {
  if (typeof name !== "string" || !name.trim()) {
    return "?";
  }
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

/**
 * Resolve display icon for an app.
 * @returns {{ type: "image", src: string } | { type: "monogram", text: string, accent: number }}
 */
export function resolveAppIcon(app) {
  if (app?.icon && isPackagedIconUrl(app.icon)) {
    return { type: "image", src: app.icon };
  }
  if (app?.icon && isSafeIconFileName(app.icon)) {
    const uri = localIconFileURI(app.icon);
    if (uri) {
      return { type: "image", src: uri };
    }
  }
  return {
    type: "monogram",
    text: monogramForName(app?.name || app?.id || "?"),
    accent: monogramAccentIndex(app?.id || app?.name || ""),
  };
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
