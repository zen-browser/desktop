/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * What Peppermint Janitor is allowed to look at. Everything here is a fixed,
 * per-OS list; no path ever comes from the user or from the network. Each
 * entry becomes a "unit" (see PeppermintJanitorCleaner) that the cleaner then
 * checks again before touching.
 */

import {
  classify,
  listChildren,
  toFile,
} from "moz-src:///peppermint/janitor/PeppermintJanitorCleaner.sys.mjs";

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

/** Location groups, in the order they are cleaned and reported. */
export const GROUPS = Object.freeze([
  "temp",
  "traces",
  "updates",
  "caches",
  "trash",
]);

// Names that are never a temp or cache entry to remove: system daemons and
// live services keep state in them.
const SYSTEM_NAME_PREFIXES = [
  ".",
  "com.apple.",
  "systemd-",
  "tmux-",
  "ssh-",
  "snap",
  "pulse",
  "dbus-",
  "gpg",
  "launchd",
  "nsird_",
  "temporaryitems",
  "powerlog",
  "cvcd",
  "mds",
];

// Caches that system services depend on.
const MAC_CACHE_DENY = new Set([
  "cloudkit",
  "familycircle",
  "geoservices",
  "metadata",
  "storeassetd",
]);

// Folders of the Windows profile that hold app data, not caches.
const WINDOWS_SKIP_DIRS = new Set([
  "microsoft",
  "packages",
  "programs",
  "temp",
  "publishers",
  "apps",
  "virtualstore",
  "connecteddevicesplatform",
  "comms",
]);

const WINDOWS_CACHE_NAMES = new Set([
  "cache",
  "caches",
  "code cache",
  "gpucache",
  "dawncache",
  "graphitedawncache",
  "grshadercache",
  "shadercache",
  "d3dscache",
  "cache2",
  "media cache",
]);

// Chromium keeps its cache at <vendor>/<browser>/User Data/<profile>/Cache.
const WINDOWS_CACHE_SEARCH_DEPTH = 5;

/**
 * @typedef {object} Environment
 * @property {string} os - "Darwin", "Linux" or "WINNT".
 * @property {string} home - The user's home directory.
 * @property {string} tmp - The temp folder.
 * @property {string[]} [extraTmp] - More temp folders (macOS has /tmp).
 * @property {string} [localAppData] - Windows only.
 * @property {string} [appData] - Windows only.
 * @property {string} [xdgCache] - Linux only.
 * @property {string} [xdgData] - Linux only.
 */

function dirPath(key) {
  try {
    return Services.dirsvc.get(key, Ci.nsIFile).path;
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} path
 * @returns {string|null} The path with every link resolved, or null if it
 *   does not exist.
 */
export function normalizePath(path) {
  try {
    const file = toFile(path);
    file.normalize();
    return file.path;
  } catch (e) {
    return null;
  }
}

/** @returns {Environment} The real environment of this machine. */
export function getEnvironment() {
  const os = Services.appinfo.OS;
  const home = dirPath("Home");
  const env = { os, home, tmp: dirPath("TmpD") };
  if (os === "Darwin") {
    env.extraTmp = ["/tmp"];
  }
  if (os === "WINNT") {
    env.localAppData = dirPath("LocalAppData");
    env.appData = dirPath("AppData");
  } else if (os === "Linux") {
    const fromEnv = name => {
      const value = Services.env.get(name);
      return value && PathUtils.isAbsolute(value) ? value : null;
    };
    env.xdgCache =
      fromEnv("XDG_CACHE_HOME") || (home && PathUtils.join(home, ".cache"));
    env.xdgData =
      fromEnv("XDG_DATA_HOME") ||
      (home && PathUtils.join(home, ".local", "share"));
  }
  return env;
}

/**
 * Paths a unit may never equal, contain or sit inside: everything this
 * browser lives in or updates itself from.
 *
 * @returns {string[]}
 */
export function getProtectedTrees() {
  const paths = [];
  for (const key of [
    "ProfD",
    "ProfLD",
    "UAppData",
    "DefProfRt",
    "DefProfLRt",
    "GreD",
    "GreBinD",
    "XCurProcD",
    "UpdRootD",
  ]) {
    const path = dirPath(key);
    if (path) {
      paths.push(path, normalizePath(path));
    }
  }
  return [...new Set(paths.filter(Boolean))];
}

/**
 * Paths a unit may never equal or sit inside: the user's own folders.
 *
 * @param {string} home
 * @returns {string[]}
 */
export function getProtectedFolders(home) {
  const paths = [];
  for (const name of [
    "Desktop",
    "Documents",
    "Downloads",
    "Pictures",
    "Movies",
    "Music",
    "Videos",
    "Public",
  ]) {
    paths.push(PathUtils.join(home, name));
  }
  const download = dirPath("DfltDwnld");
  if (download) {
    paths.push(download);
  }
  const custom = Services.prefs.getStringPref("browser.download.dir", "");
  if (custom && PathUtils.isAbsolute(custom)) {
    paths.push(custom);
  }
  return [
    ...new Set(
      paths.flatMap(path => [path, normalizePath(path)]).filter(Boolean)
    ),
  ];
}

/** @returns {string[]} Lower-cased names that identify this browser. */
function ownNames() {
  const names = new Set(["peppermint", "mozilla"]);
  for (const name of [
    AppConstants.MOZ_APP_NAME,
    AppConstants.MOZ_APP_BASENAME,
    Services.appinfo.name,
    Services.appinfo.vendor,
  ]) {
    if (name && name.length >= 3) {
      names.add(name.toLowerCase());
    }
  }
  return [...names];
}

function isSystemName(name) {
  const lower = name.toLowerCase();
  return SYSTEM_NAME_PREFIXES.some(prefix => lower.startsWith(prefix));
}

/**
 * @param {string[]} own - From ownNames().
 * @param {Set<string>} [extraDeny] - More lower-cased names to skip.
 * @returns {(name: string) => boolean} Skips system entries and our own.
 */
function skipper(own, extraDeny = null) {
  return name => {
    const lower = name.toLowerCase();
    return (
      isSystemName(name) ||
      own.some(token => lower.includes(token)) ||
      !!extraDeny?.has(lower)
    );
  };
}

/**
 * One unit per entry of a directory. The directory is the units' root.
 *
 * @param {string} rootPath
 * @param {string} group
 * @param {object} [options]
 * @param {"self"|"contents"} [options.dirMode] - What to do with a
 *   subdirectory: remove it, or only empty it.
 * @param {(name: string) => boolean} [options.skip]
 * @param {boolean} [options.ageGated]
 * @returns {object[]}
 */
function childUnits(
  rootPath,
  group,
  { dirMode = "contents", skip = () => false, ageGated = true } = {}
) {
  const root = rootPath && normalizePath(rootPath);
  if (!root) {
    return [];
  }
  const dir = toFile(root);
  if (classify(dir).kind !== "dir") {
    return [];
  }
  const units = [];
  for (const child of listChildren(dir) || []) {
    if (skip(child.leafName)) {
      continue;
    }
    const { kind } = classify(child);
    if (kind === "dir") {
      units.push({ group, path: child.path, root, mode: dirMode, ageGated });
    } else if (kind === "file" || kind === "symlink") {
      units.push({ group, path: child.path, root, mode: "self", ageGated });
    }
  }
  return units;
}

/**
 * One unit for a single file, rooted in its folder.
 *
 * @param {string} path
 * @param {string} group
 * @param {boolean} ageGated
 * @returns {object[]}
 */
function fileUnit(path, group, ageGated) {
  const resolved = normalizePath(path);
  const parent = resolved && PathUtils.parent(resolved);
  if (!parent || classify(toFile(resolved)).kind !== "file") {
    return [];
  }
  return [{ group, path: resolved, root: parent, mode: "self", ageGated }];
}

/**
 * One unit for the contents of a folder somewhere under `root`.
 *
 * @param {string} path
 * @param {string} group
 * @param {boolean} ageGated
 * @param {string} root
 * @returns {object[]}
 */
function dirUnit(path, group, ageGated, root) {
  const resolved = normalizePath(path);
  if (!resolved || classify(toFile(resolved)).kind !== "dir") {
    return [];
  }
  return [{ group, path: resolved, root, mode: "contents", ageGated }];
}

function tempUnits(env, own) {
  const skip = skipper(own);
  const roots = [env.tmp, ...(env.extraTmp || [])];
  const seen = new Set();
  const units = [];
  for (const root of roots) {
    const resolved = root && normalizePath(root);
    if (!resolved || seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    units.push(...childUnits(resolved, "temp", { dirMode: "self", skip }));
  }
  return units;
}

function traceUnits(env, own) {
  const skip = skipper(own);
  const { home } = env;
  switch (env.os) {
    case "Darwin": {
      const lib = PathUtils.join(home, "Library");
      return [
        ...childUnits(PathUtils.join(lib, "Logs"), "traces", { skip }),
        ...childUnits(
          PathUtils.join(lib, "Application Support", "CrashReporter"),
          "traces"
        ),
        // The "Open Recent" lists of apps.
        ...childUnits(
          PathUtils.join(
            lib,
            "Application Support",
            "com.apple.sharedfilelist",
            "com.apple.LSSharedFileList.ApplicationRecentDocuments"
          ),
          "traces",
          { dirMode: "self", ageGated: false }
        ),
        // Flash shared objects, long obsolete trackers.
        ...childUnits(
          PathUtils.join(lib, "Preferences", "Macromedia"),
          "traces",
          { dirMode: "self", ageGated: false }
        ),
      ];
    }
    case "Linux":
      return [
        ...fileUnit(
          PathUtils.join(env.xdgData, "recently-used.xbel"),
          "traces",
          false
        ),
        ...childUnits(
          PathUtils.join(env.xdgData, "RecentDocuments"),
          "traces",
          {
            dirMode: "self",
            ageGated: false,
          }
        ),
        ...childUnits(PathUtils.join(home, ".macromedia"), "traces", {
          dirMode: "self",
          ageGated: false,
        }),
      ];
    case "WINNT": {
      const local = env.localAppData;
      const roaming = env.appData;
      return [
        ...childUnits(
          PathUtils.join(roaming, "Microsoft", "Windows", "Recent"),
          "traces",
          { ageGated: false }
        ),
        ...childUnits(
          PathUtils.join(roaming, "Microsoft", "Office", "Recent"),
          "traces",
          { ageGated: false }
        ),
        ...childUnits(PathUtils.join(local, "CrashDumps"), "traces"),
        ...childUnits(
          PathUtils.join(local, "Microsoft", "Windows", "WER", "ReportArchive"),
          "traces"
        ),
        ...childUnits(
          PathUtils.join(local, "Microsoft", "Windows", "WER", "ReportQueue"),
          "traces"
        ),
        ...childUnits(
          PathUtils.join(roaming, "Macromedia", "Flash Player"),
          "traces",
          {
            dirMode: "self",
            ageGated: false,
          }
        ),
      ];
    }
  }
  return [];
}

/**
 * Update leftovers: ShipIt and Sparkle downloads and electron-updater
 * "pending" folders, which an app no longer needs once it is updated. This
 * browser's own update directory is protected by the cleaner.
 *
 * @param {Environment} env
 * @param {string[]} own
 * @returns {object[]}
 */
function updateUnits(env, own) {
  const skip = skipper(own);
  const units = [];
  let appRoot;
  switch (env.os) {
    case "Darwin":
      units.push(
        ...childUnits(PathUtils.join(env.home, "Library", "Updates"), "updates")
      );
      appRoot = PathUtils.join(env.home, "Library", "Caches");
      break;
    case "Linux":
      appRoot = env.xdgCache;
      break;
    case "WINNT":
      appRoot = env.localAppData;
      break;
  }
  const root = appRoot && normalizePath(appRoot);
  if (!root || classify(toFile(root)).kind !== "dir") {
    return units;
  }
  for (const app of listChildren(toFile(root)) || []) {
    const name = app.leafName;
    if (skip(name) || classify(app).kind !== "dir") {
      continue;
    }
    if (name.endsWith(".ShipIt")) {
      units.push(...dirUnit(app.path, "updates", true, root));
      continue;
    }
    if (name.endsWith("-updater")) {
      units.push(
        ...dirUnit(PathUtils.join(app.path, "pending"), "updates", true, root)
      );
    }
    for (const sub of listChildren(app) || []) {
      if (
        (sub.leafName === "org.sparkle-project.Sparkle" ||
          sub.leafName.endsWith(".ShipIt")) &&
        classify(sub).kind === "dir"
      ) {
        units.push(...dirUnit(sub.path, "updates", true, root));
      }
    }
  }
  return units;
}

/**
 * Windows has no single cache folder, so look for well-known cache folder
 * names a few levels below the app data folder, without entering any of them.
 *
 * @param {Environment} env
 * @param {string[]} own
 * @returns {object[]}
 */
function windowsCacheUnits(env, own) {
  const root = env.localAppData && normalizePath(env.localAppData);
  if (!root || classify(toFile(root)).kind !== "dir") {
    return [];
  }
  const skip = skipper(own);
  const units = [];
  const queue = [{ dir: toFile(root), depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    for (const child of listChildren(dir) || []) {
      const lower = child.leafName.toLowerCase();
      if (skip(child.leafName) || classify(child).kind !== "dir") {
        continue;
      }
      if (WINDOWS_CACHE_NAMES.has(lower)) {
        units.push(...dirUnit(child.path, "caches", true, root));
      } else if (
        depth + 1 < WINDOWS_CACHE_SEARCH_DEPTH &&
        !(depth === 0 && WINDOWS_SKIP_DIRS.has(lower))
      ) {
        queue.push({ dir: child, depth: depth + 1 });
      }
    }
  }
  units.push(
    ...dirUnit(
      PathUtils.join(root, "Microsoft", "Windows", "INetCache"),
      "caches",
      true,
      root
    )
  );
  return units;
}

function cacheUnits(env, own) {
  switch (env.os) {
    case "Darwin":
      return childUnits(
        PathUtils.join(env.home, "Library", "Caches"),
        "caches",
        { skip: skipper(own, MAC_CACHE_DENY) }
      );
    case "Linux":
      return childUnits(env.xdgCache, "caches", { skip: skipper(own) });
    case "WINNT":
      return windowsCacheUnits(env, own);
  }
  return [];
}

/**
 * The recycle bin as units, on the platforms where it is plain files. On
 * Windows it goes through the shell API instead (see the recycle bin worker).
 *
 * @param {Environment} env
 * @returns {object[]}
 */
function trashUnits(env) {
  const options = { dirMode: "self", ageGated: false };
  switch (env.os) {
    case "Darwin":
      return childUnits(PathUtils.join(env.home, ".Trash"), "trash", options);
    case "Linux": {
      const trash = PathUtils.join(env.xdgData, "Trash");
      return [
        ...childUnits(PathUtils.join(trash, "files"), "trash", options),
        ...childUnits(PathUtils.join(trash, "info"), "trash", options),
      ];
    }
  }
  return [];
}

/**
 * @param {Environment} env
 * @param {string[]} groups - A subset of GROUPS.
 * @returns {object[]} Units, in the order of GROUPS.
 */
export function resolveUnits(env, groups) {
  if (!env.home || !env.tmp) {
    return [];
  }
  const own = ownNames();
  const builders = {
    temp: tempUnits,
    traces: traceUnits,
    updates: updateUnits,
    caches: cacheUnits,
    trash: trashUnits,
  };
  const units = [];
  for (const group of GROUPS) {
    if (!groups.includes(group)) {
      continue;
    }
    try {
      units.push(...builders[group](env, own));
    } catch (e) {
      console.error(`Janitor: could not resolve ${group}`, e);
    }
  }
  return units;
}
