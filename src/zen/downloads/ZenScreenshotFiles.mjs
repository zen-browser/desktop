// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export const SCREENSHOT_FOLDER_PREF = "zen.downloads.screenshots.folder";
const IMAGE_NAME = /^[^.].*\.(?:png|jpe?g|webp|gif|heic|tiff?|bmp)$/i;
const MAX_CHILDREN = 2000;
const MAX_VISIBLE = 10;

function localFile(path) {
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(path);
  return file;
}

// Check every ancestor as well as the leaf: replacing the selected directory
// with a link must not grant access to a different directory on the next scan.
export function screenshotDirectory(path) {
  const directory = localFile(path);
  for (let ancestor = directory; ancestor; ancestor = ancestor.parent) {
    if (ancestor.isSymlink()) {
      throw new Error("Screenshot folder contains a symbolic link");
    }
  }
  if (!directory.isDirectory()) {
    throw new Error("Screenshot folder is not a directory");
  }
  return directory;
}

// Revalidate at the user gesture, not just when the row was first displayed.
// This returns only a native file for dragging/revealing; never a launch URL.
export function screenshotFile(folder, path) {
  const directory = screenshotDirectory(folder);
  const file = localFile(path);
  if (
    !file.parent?.equals(directory) ||
    !IMAGE_NAME.test(file.leafName) ||
    file.isSymlink() ||
    !file.isFile() ||
    file.fileSize <= 0 ||
    file.lastModifiedTime > Date.now() - 1000
  ) {
    throw new Error("Screenshot is unavailable");
  }
  return file;
}

export async function scanScreenshots(folder, isCurrent = () => true) {
  screenshotDirectory(folder);
  const children = await IOUtils.getChildren(folder);
  // A screenshots folder should be small. Avoid thousands of outstanding I/O
  // requests if a user accidentally selects a large general-purpose directory.
  if (children.length > MAX_CHILDREN) {
    throw new Error("Screenshot folder has too many entries");
  }
  const candidates = [];
  const cutoff = Date.now() - 1000;
  for (let offset = 0; offset < children.length; offset += 32) {
    if (!isCurrent()) {
      return [];
    }
    const batch = children
      .slice(offset, offset + 32)
      .filter((path) => IMAGE_NAME.test(PathUtils.filename(path)));
    const results = await Promise.allSettled(
      batch.map((path) => IOUtils.stat(path)),
    );
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (
        result.status === "fulfilled" &&
        result.value.type === "regular" &&
        result.value.size > 0 &&
        result.value.lastModified <= cutoff
      ) {
        candidates.push({ ...result.value, path: batch[index] });
      }
    }
  }
  candidates.sort(
    (a, b) => b.lastModified - a.lastModified || a.path.localeCompare(b.path),
  );
  const files = [];
  for (const candidate of candidates) {
    if (!isCurrent()) {
      return [];
    }
    try {
      screenshotFile(folder, candidate.path);
      files.push(candidate);
      if (files.length === MAX_VISIBLE) {
        break;
      }
    } catch {
      // A file can disappear or become a link between enumeration and stat.
    }
  }
  return files;
}
