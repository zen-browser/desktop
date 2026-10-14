/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The filesystem engine of Peppermint Janitor. It only ever deletes inside the
 * "units" it is handed, and it is deliberately paranoid:
 *
 * - Links are never followed. Every entry is classified with
 *   nsIFile.isSymlink() first (IOUtils.stat follows links, so it is not
 *   used). A link is only ever unlinked itself. On Windows isSymlink() is
 *   always false, but reparse points and junctions are reported as neither a
 *   file nor a directory, so they classify as "special" there.
 * - A unit holding a special entry (socket, FIFO, device, system file,
 *   unreadable entry) is left alone: something live may be around it.
 * - A unit is cleaned only if nothing inside it was modified or accessed since
 *   the cutoff. One fresh file keeps the whole unit, so a running app never
 *   loses part of its cache. Directory timestamps are ignored: reading a
 *   directory can refresh its access time, and that would keep it fresh
 *   forever.
 * - Deletion is bottom-up with non-recursive remove() only, every file is
 *   re-checked right before it goes, and a directory that is not empty simply
 *   stays.
 * - Every deleted path must be strictly inside the unit's root, and units
 *   that equal, contain or sit inside a protected path are refused.
 * - Work is cut into short slices on idle time and capped per run.
 */

export const MAX_AGE_MS = 72 * 60 * 60 * 1000;

const SLICE_MS = 8;
const MAX_ENTRIES_PER_RUN = 600000;
const MAX_DEPTH = 64;

const IS_WINDOWS = Services.appinfo.OS === "WINNT";
// Windows and macOS file systems are case-insensitive by default.
const FOLD_CASE = Services.appinfo.OS !== "Linux";
const SEP = IS_WINDOWS ? "\\" : "/";

/** Statuses a unit can end with. */
export const UnitStatus = Object.freeze({
  CLEANED: "cleaned",
  DRY_RUN: "dry-run",
  EMPTY: "empty",
  ACTIVE: "skipped-active",
  PROTECTED: "skipped-protected",
  INVALID: "skipped-invalid",
  ERROR: "skipped-error",
});

class TruncatedError extends Error {}

function fold(path) {
  return FOLD_CASE ? path.toLowerCase() : path;
}

function trimSeparator(path) {
  return path.length > 1 && path.endsWith(SEP) ? path.slice(0, -1) : path;
}

/**
 * @param {string} path
 * @param {string} base
 * @returns {boolean} Whether path is base or something below it.
 */
export function isSameOrInside(path, base) {
  const p = fold(trimSeparator(path));
  const b = fold(trimSeparator(base));
  return p === b || p.startsWith(b.endsWith(SEP) ? b : b + SEP);
}

function isStrictlyInside(path, base) {
  return (
    fold(trimSeparator(path)) !== fold(trimSeparator(base)) &&
    isSameOrInside(path, base)
  );
}

/**
 * @param {string} path
 * @returns {nsIFile}
 */
export function toFile(path) {
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(path);
  return file;
}

/**
 * @param {nsIFile} file
 * @returns {{kind: string, size?: number, activity?: number}} kind is one of
 *   "file", "dir", "symlink" or "special". activity is the newest of the
 *   modification and access time in ms (links use their own times).
 */
export function classify(file) {
  try {
    if (file.isSymlink()) {
      return {
        kind: "symlink",
        size: Math.max(0, file.fileSizeOfLink),
        activity: Math.max(
          file.lastModifiedTimeOfLink,
          file.lastAccessedTimeOfLink
        ),
      };
    }
    if (file.isSpecial()) {
      return { kind: "special" };
    }
    if (file.isDirectory()) {
      return { kind: "dir" };
    }
    if (file.isFile()) {
      return {
        kind: "file",
        size: Math.max(0, file.fileSize),
        activity: Math.max(file.lastModifiedTime, file.lastAccessedTime),
      };
    }
  } catch (e) {
    // Gone, locked or unreadable: treat as something we must not touch.
  }
  return { kind: "special" };
}

/**
 * @param {nsIFile} dir
 * @returns {nsIFile[]|null} The entries, or null when it cannot be read.
 */
export function listChildren(dir) {
  let entries;
  try {
    entries = dir.directoryEntries;
  } catch (e) {
    return null;
  }
  const children = [];
  try {
    let child;
    while ((child = entries.nextFile)) {
      children.push(child);
    }
  } catch (e) {
    return null;
  } finally {
    try {
      entries.close();
    } catch (e) {
      // Already closed.
    }
  }
  return children;
}

function tryRemove(file) {
  try {
    // Never recursive: a directory that still has something in it must stay.
    file.remove(false);
    return true;
  } catch (e) {
    return false;
  }
}

function yieldToIdle() {
  return new Promise(resolve =>
    ChromeUtils.idleDispatch(() => resolve(), { timeout: 100 })
  );
}

/**
 * @typedef {object} Unit
 * @property {string} group - Location group id, used for the report.
 * @property {string} path - Absolute path of the unit.
 * @property {string} root - Absolute path the unit has to stay inside.
 * @property {"self"|"contents"} mode - "self" removes the unit itself,
 *   "contents" empties it and keeps the directory.
 * @property {boolean} [ageGated=true] - False for lists whose point is to be
 *   cleared at any age (recent items).
 */

/**
 * @typedef {object} UnitResult
 * @property {Unit} unit - The unit this is the result of.
 * @property {string} status - One of UnitStatus.
 * @property {number} bytes - Bytes freed (or that would be, in a dry run).
 * @property {number} files - Files removed (or that would be).
 */

export class JanitorCleaner {
  #home;
  #tree;
  #inside;
  #dryRun;
  #now;
  #maxAge;
  #entries = 0;
  #sliceStart = ChromeUtils.now();

  /**
   * @param {object} options
   * @param {string} options.home - The user's home directory.
   * @param {string[]} [options.protectedTrees] - Paths a unit may never
   *   equal, contain or sit inside (profile, app and update directories).
   * @param {string[]} [options.protectedInside] - Paths a unit may never
   *   equal or sit inside (Desktop, Documents, Downloads, ...).
   * @param {boolean} [options.dryRun] - Scan only.
   * @param {number} [options.now] - Current time in ms.
   * @param {number} [options.maxAgeMs]
   */
  constructor({
    home,
    protectedTrees = [],
    protectedInside = [],
    dryRun = false,
    now = Date.now(),
    maxAgeMs = MAX_AGE_MS,
  }) {
    this.#home = home;
    this.#tree = protectedTrees.filter(Boolean);
    this.#inside = protectedInside.filter(Boolean);
    this.#dryRun = dryRun;
    this.#now = now;
    this.#maxAge = maxAgeMs;
  }

  /** @returns {boolean} Whether the per-run entry budget is used up. */
  get exhausted() {
    return this.#entries >= MAX_ENTRIES_PER_RUN;
  }

  /**
   * @param {Unit[]} units
   * @returns {Promise<UnitResult[]>}
   */
  async run(units) {
    const results = [];
    for (const unit of units) {
      if (this.exhausted) {
        break;
      }
      try {
        results.push(await this.#cleanUnit(unit));
      } catch (e) {
        if (!(e instanceof TruncatedError)) {
          console.error("Janitor: unit failed", unit.path, e);
        }
        results.push({
          unit,
          status: UnitStatus.ERROR,
          bytes: 0,
          files: 0,
        });
      }
    }
    return results;
  }

  async #step() {
    if (++this.#entries > MAX_ENTRIES_PER_RUN) {
      throw new TruncatedError();
    }
    if (ChromeUtils.now() - this.#sliceStart > SLICE_MS) {
      await yieldToIdle();
      this.#sliceStart = ChromeUtils.now();
    }
  }

  #isValidRoot(root) {
    if (!root || !PathUtils.isAbsolute(root)) {
      return false;
    }
    const path = trimSeparator(root);
    // A filesystem or drive root, the home directory or anything above it.
    if (PathUtils.parent(path) === null) {
      return false;
    }
    if (isSameOrInside(this.#home, path)) {
      return false;
    }
    const systemDirs = IS_WINDOWS
      ? [Services.dirsvc.get("WinD", Ci.nsIFile).path]
      : [
          "/System",
          "/usr",
          "/bin",
          "/sbin",
          "/etc",
          "/var",
          "/private",
          "/private/var",
          "/Library",
          "/Applications",
          "/opt",
          "/lib",
          "/dev",
          "/proc",
          "/sys",
        ];
    return !systemDirs.some(dir => fold(dir) === fold(path));
  }

  /**
   * A link between the root and the unit would carry deletions to wherever
   * it points.
   *
   * @param {string} path - The unit.
   * @param {string} root - Where the unit has to stay.
   * @returns {boolean}
   */
  #hasLinkedAncestor(path, root) {
    let parent = PathUtils.parent(path);
    while (parent && isStrictlyInside(parent, root)) {
      if (classify(toFile(parent)).kind !== "dir") {
        return true;
      }
      parent = PathUtils.parent(parent);
    }
    return false;
  }

  #isProtected(path) {
    // Never the home directory itself or anything that contains it.
    if (isSameOrInside(this.#home, path)) {
      return true;
    }
    return (
      this.#tree.some(
        base => isSameOrInside(path, base) || isSameOrInside(base, path)
      ) || this.#inside.some(base => isSameOrInside(path, base))
    );
  }

  /**
   * @param {Unit} unit
   * @returns {Promise<UnitResult>}
   */
  async #cleanUnit(unit) {
    const result = (status, bytes = 0, files = 0) => ({
      unit,
      status,
      bytes,
      files,
    });

    if (
      !this.#isValidRoot(unit.root) ||
      !PathUtils.isAbsolute(unit.path) ||
      // "." and ".." would let a path that starts inside the root leave it.
      unit.path.split(SEP).some(part => part === "." || part === "..") ||
      !isStrictlyInside(unit.path, unit.root)
    ) {
      return result(UnitStatus.INVALID);
    }
    if (this.#isProtected(unit.path)) {
      return result(UnitStatus.PROTECTED);
    }
    if (this.#hasLinkedAncestor(unit.path, unit.root)) {
      return result(UnitStatus.INVALID);
    }

    const file = toFile(unit.path);
    const info = classify(file);
    if (info.kind === "special") {
      return result(UnitStatus.ACTIVE);
    }

    const cutoff =
      unit.ageGated === false ? Infinity : this.#now - this.#maxAge;

    // Pass 1: is the whole unit stale, and how much is in it?
    const scan = await this.#scan(file, info, cutoff);
    if (scan.active) {
      return result(UnitStatus.ACTIVE);
    }
    if (!scan.files && !scan.dirs) {
      return result(UnitStatus.EMPTY);
    }
    if (this.#dryRun) {
      return result(UnitStatus.DRY_RUN, scan.bytes, scan.files);
    }

    // Pass 2: delete, re-checking every entry.
    const removed = await this.#delete(
      file,
      info,
      unit.mode === "self",
      unit.path,
      cutoff
    );
    return result(
      removed.files ? UnitStatus.CLEANED : UnitStatus.EMPTY,
      removed.bytes,
      removed.files
    );
  }

  /**
   * Walks the unit without following links and stops at the first sign of
   * activity.
   *
   * @param {nsIFile} root - The unit.
   * @param {object} rootInfo - classify() of the unit.
   * @param {number} cutoff - Newer than this means in use.
   * @returns {Promise<{active: boolean, bytes: number, files: number,
   *   dirs: number}>}
   */
  async #scan(root, rootInfo, cutoff) {
    const total = { active: false, bytes: 0, files: 0, dirs: 0 };
    const visit = info => {
      if (info.kind === "special" || info.activity > cutoff) {
        total.active = true;
        return;
      }
      total.files++;
      total.bytes += info.size || 0;
    };

    if (rootInfo.kind !== "dir") {
      // A single file or link; a link as unit root is never followed.
      visit(rootInfo);
      return total;
    }

    const stack = [{ children: listChildren(root), index: 0, depth: 0 }];
    while (stack.length && !total.active) {
      const frame = stack[stack.length - 1];
      if (!frame.children) {
        // Unreadable directory.
        total.active = true;
        break;
      }
      if (frame.index >= frame.children.length) {
        stack.pop();
        continue;
      }
      const child = frame.children[frame.index++];
      await this.#step();
      const info = classify(child);
      if (info.kind === "dir") {
        if (frame.depth + 1 > MAX_DEPTH) {
          total.active = true;
          break;
        }
        total.dirs++;
        stack.push({
          children: listChildren(child),
          index: 0,
          depth: frame.depth + 1,
        });
      } else {
        visit(info);
      }
    }
    return total;
  }

  async #delete(root, rootInfo, removeRoot, rootPath, cutoff) {
    const removed = { bytes: 0, files: 0 };
    const removeLeaf = (file, info, isUnitRoot = false) => {
      // The last line of defense: never touch anything outside the unit.
      if (
        !(isUnitRoot || isStrictlyInside(file.path, rootPath)) ||
        file.leafName === "." ||
        file.leafName === ".."
      ) {
        return;
      }
      if (info.kind !== "file" && info.kind !== "symlink") {
        return;
      }
      if (info.activity > cutoff) {
        return;
      }
      if (tryRemove(file)) {
        removed.files++;
        removed.bytes += info.size || 0;
      }
    };

    if (rootInfo.kind !== "dir") {
      // The unit is a single file or link. Contents mode has nothing to do.
      if (removeRoot) {
        removeLeaf(root, rootInfo, true);
      }
      return removed;
    }

    const stack = [{ dir: root, children: listChildren(root), index: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (!frame.children || frame.index >= frame.children.length) {
        stack.pop();
        // The unit directory itself goes only for "self" units; emptied
        // subdirectories always go. Non-empty ones fail and stay.
        const isUnitRoot = !stack.length;
        if (
          isUnitRoot ? removeRoot : isStrictlyInside(frame.dir.path, rootPath)
        ) {
          tryRemove(frame.dir);
        }
        continue;
      }
      const child = frame.children[frame.index++];
      await this.#step();
      const info = classify(child);
      if (info.kind === "dir") {
        if (stack.length < MAX_DEPTH) {
          stack.push({ dir: child, children: listChildren(child), index: 0 });
        }
      } else {
        removeLeaf(child, info);
      }
    }
    return removed;
  }
}
