/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "mimeService", () =>
  Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService)
);

/**
 * Groups the browser cannot name on its own. Pictures, video and sound come
 * from the content type instead, so they are not listed here.
 */
const GROUP_EXTENSIONS = {
  documents:
    "pdf doc docx xls xlsx ppt pptx txt md rtf odt ods odp csv epub pages numbers key",
  archives: "zip rar 7z tar gz bz2 xz tgz zst",
  apps: "dmg pkg exe msi app deb rpm appimage apk jar",
};

/**
 * The few the browser has no type for, or types differently from how these
 * lists read them. Matroska is unknown to it, and Ogg is reported as a
 * container rather than as sound.
 */
const EXTRA_KINDS = new Map([
  ["mkv", "video"],
  ["ogg", "audio"],
]);

const GROUP_BY_EXTENSION = new Map();
for (const [group, extensions] of Object.entries(GROUP_EXTENSIONS)) {
  for (const extension of extensions.split(" ")) {
    GROUP_BY_EXTENSION.set(extension, group);
  }
}

/** The groups a file can be filtered by, in the order they are offered. */
export const FILE_GROUPS = [
  "images",
  "video",
  "audio",
  ...Object.keys(GROUP_EXTENSIONS),
];

/**
 * A picture the platform renders as a document rather than a bitmap. It is
 * left out of thumbnails, which are drawn inside the browser's own chrome.
 */
const NOT_DRAWN = "image/svg+xml";

/**
 * @param {string} fileName - A file's name, with or without its path
 * @returns {string} Its extension, lowercased, or "" when it has none
 */
export function extensionOf(fileName) {
  const name = fileName?.split(/[/\\]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * @param {string} fileName - A file's name
 * @returns {string} What the browser believes the file holds, or "" when it
 *   has no idea
 */
export function contentTypeOf(fileName) {
  const extension = extensionOf(fileName);
  if (!extension) {
    return "";
  }
  try {
    return lazy.mimeService.getTypeFromExtension(extension);
  } catch {
    return "";
  }
}

/**
 * @param {string} fileName - A file's name
 * @returns {string|null} "image", "video" or "audio", or null for anything
 *   that is none of those
 */
export function mediaKindOf(fileName) {
  const type = contentTypeOf(fileName);
  for (const kind of ["image", "video", "audio"]) {
    if (type.startsWith(`${kind}/`)) {
      return kind;
    }
  }
  return EXTRA_KINDS.get(extensionOf(fileName)) ?? null;
}

/**
 * @param {string} fileName - A file's name
 * @returns {string|null} The group it belongs to, of {@link FILE_GROUPS}
 */
export function fileGroupOf(fileName) {
  const kind = mediaKindOf(fileName);
  if (kind) {
    return kind === "image" ? "images" : kind;
  }
  return GROUP_BY_EXTENSION.get(extensionOf(fileName)) ?? null;
}

/**
 * @param {string} fileName - A file's name
 * @returns {boolean} Whether the file itself can stand in for its icon
 */
export function canDrawThumbnail(fileName) {
  const type = contentTypeOf(fileName);
  return type.startsWith("image/") && type !== NOT_DRAWN;
}
