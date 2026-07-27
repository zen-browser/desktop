/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  IOUtils: "resource://gre/modules/IOUtils.sys.mjs",
  PathUtils: "resource://gre/modules/PathUtils.sys.mjs",
});

let _migrationUtils = null;
function getMigrationUtils() {
  if (!_migrationUtils) {
    _migrationUtils = ChromeUtils.importESModule(
      "resource:///modules/MigrationUtils.sys.mjs"
    ).MigrationUtils;
  }
  return _migrationUtils;
}

function getFirefoxProfilesIniPath() {
  try {
    if (AppConstants.platform === "win") {
      let appData = Services.dirsvc.get("AppData", Ci.nsIFile);
      return lazy.PathUtils.join(
        appData.path, "Mozilla", "Firefox", "profiles.ini"
      );
    }
    if (AppConstants.platform === "macosx") {
      let home = Services.dirsvc.get("Home", Ci.nsIFile);
      return lazy.PathUtils.join(
        home.path, "Library", "Application Support", "Firefox", "profiles.ini"
      );
    }
    let home = Services.dirsvc.get("Home", Ci.nsIFile);
    return lazy.PathUtils.join(home.path, ".mozilla", "firefox", "profiles.ini");
  } catch (e) {
    console.error("Failed to determine Firefox profiles.ini path:", e);
    return null;
  }
}

function parseProfilesIni(data) {
  let entries = [];
  let current = null;

  for (let line of data.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      if (current && current.name && current.path !== undefined) {
        entries.push(current);
      }
      current = line.slice(1, -1).startsWith("Profile") ? {} : null;
    } else if (current) {
      let eqIdx = line.indexOf("=");
      if (eqIdx > 0) {
        let key = line.substring(0, eqIdx).trim();
        let value = line.substring(eqIdx + 1).trim();
        switch (key) {
          case "Name":
            current.name = value;
            break;
          case "Path":
            current.path = value;
            break;
          case "IsRelative":
            current.isRelative = value === "1";
            break;
        }
      }
    }
  }

  if (current && current.name && current.path !== undefined) {
    entries.push(current);
  }

  return entries;
}

async function scanExternalProfiles(profilesIniPath, baseDir) {
  let profiles = new Map();

  let data;
  try {
    if (!(await lazy.IOUtils.exists(profilesIniPath))) {
      return profiles;
    }
    data = await lazy.IOUtils.readUTF8(profilesIniPath);
  } catch (e) {
    console.error("Failed to read Firefox profiles.ini:", e);
    return profiles;
  }

  let entries = parseProfilesIni(data);
  let currentProfileDir = getMigrationUtils().profileStartup.directory;

  for (let entry of entries) {
    try {
      let profilePath = entry.isRelative
        ? lazy.PathUtils.join(baseDir, entry.path)
        : entry.path;

      let rootDir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      rootDir.initWithPath(profilePath);

      if (
        rootDir.exists() &&
        rootDir.isReadable() &&
        !rootDir.equals(currentProfileDir)
      ) {
        if (!profiles.has(profilePath)) {
          profiles.set(profilePath, {
            id: profilePath,
            name: entry.name,
            rootDir,
          });
        }
      }
    } catch (e) {
      console.error("Failed to resolve external Firefox profile:", e);
    }
  }

  return profiles;
}

export function installFirefoxProfileScanner() {
  let { FirefoxProfileMigrator } = ChromeUtils.importESModule(
    "resource:///modules/FirefoxProfileMigrator.sys.mjs"
  );

  if (FirefoxProfileMigrator.prototype.__zenExternalScanInstalled) {
    return;
  }
  FirefoxProfileMigrator.prototype.__zenExternalScanInstalled = true;

  let originalGetAllProfiles =
    FirefoxProfileMigrator.prototype.getAllProfiles;

  FirefoxProfileMigrator.prototype.getAllProfiles = async function () {
    let allProfiles = await originalGetAllProfiles.call(this);

    let profilesIniPath = getFirefoxProfilesIniPath();
    if (profilesIniPath) {
      let baseDir = lazy.PathUtils.parent(profilesIniPath);
      let externalProfiles = await scanExternalProfiles(
        profilesIniPath,
        baseDir
      );

      for (let [path, profile] of externalProfiles) {
        if (!allProfiles.has(path)) {
          allProfiles.set(path, profile);
        }
      }
    }

    return allProfiles;
  };
}
