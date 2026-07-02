/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  FileTestUtils: "resource://testing-common/FileTestUtils.sys.mjs",
  MockRegistrar: "resource://testing-common/MockRegistrar.sys.mjs",
});

const gBase = Services.dirsvc.get("ProfD", Ci.nsIFile);
gBase.append("CreateWindowsShortcut");
createDirectory(gBase);

const gTmpDir = Services.dirsvc.get("TmpD", Ci.nsIFile);

const gDirectoryServiceProvider = {
  getFile(prop, persistent) {
    persistent.value = false;

    // We only expect a narrow range of calls.
    let folder = gBase.clone();
    switch (prop) {
      case "Progs":
        folder.append("Programs");
        break;
      case "Desk":
        folder.append("Desktop");
        break;
      case "UpdRootD":
        // We really want DataRoot, but UpdateSubdir is what we usually get.
        folder.append("DataRoot");
        folder.append("UpdateDir");
        folder.append("UpdateSubdir");
        break;
      case "ProfD":
        // Used by test infrastructure.
        folder = folder.parent;
        break;
      case "TmpD":
        // Used by FileTestUtils.
        folder = gTmpDir;
        break;
      default:
        console.error(`Access to unexpected directory '${prop}'`);
        return Cr.NS_ERROR_FAILURE;
    }

    createDirectory(folder);
    return folder;
  },
  QueryInterface: ChromeUtils.generateQI([Ci.nsIDirectoryServiceProvider]),
};

add_setup(() => {
  Services.dirsvc
    .QueryInterface(Ci.nsIDirectoryService)
    .registerProvider(gDirectoryServiceProvider);
});

registerCleanupFunction(() => {
  gBase.remove(true);
  Services.dirsvc
    .QueryInterface(Ci.nsIDirectoryService)
    .unregisterProvider(gDirectoryServiceProvider);
});

add_task(async function test_CreateWindowsShortcut() {
  const DEST = "browser_createWindowsShortcut_TestFile.lnk";

  const file = FileTestUtils.getTempFile("program.exe");
  const iconPath = FileTestUtils.getTempFile("program.ico");

  let shortcut;

  const defaults = {
    shellService: Cc["@mozilla.org/toolkit/shell-service;1"].getService(),
    targetFile: file,
    iconFile: iconPath,
    description: "made by browser_createWindowsShortcut.js",
    aumid: "TESTTEST",
  };

  shortcut = Services.dirsvc.get("Progs", Ci.nsIFile);
  shortcut.append(DEST);
  await testShortcut({
    shortcutFile: shortcut,
    relativePath: DEST,
    specialFolder: "Programs",
    logHeader: "STARTMENU",
    ...defaults,
  });

  let subdir = Services.dirsvc.get("Progs", Ci.nsIFile);
  subdir.append("Shortcut Test");
  tryRemove(subdir);

  shortcut = subdir.clone();
  shortcut.append(DEST);
  await testShortcut({
    shortcutFile: shortcut,
    relativePath: "Shortcut Test\\" + DEST,
    specialFolder: "Programs",
    logHeader: "STARTMENU",
    ...defaults,
  });
  tryRemove(subdir);

  shortcut = Services.dirsvc.get("Desk", Ci.nsIFile);
  shortcut.append(DEST);
  await testShortcut({
    shortcutFile: shortcut,
    relativePath: DEST,
    specialFolder: "Desktop",
    logHeader: "DESKTOP",
    ...defaults,
  });
});

async function testShortcut({
  shortcutFile,
  relativePath,
  specialFolder,
  logHeader,

  // Generally provided by the defaults.
  shellService,
  targetFile,
  iconFile,
  description,
  aumid,
}) {
  // If it already exists, remove it.
  tryRemove(shortcutFile);

  await shellService.createShortcut(
    targetFile,
    [],
    description,
    iconFile,
    0,
    aumid,
    specialFolder,
    relativePath
  );
  ok(
    shortcutFile.exists(),
    `${specialFolder}\\${relativePath}: Shortcut should exist`
  );
  ok(
    queryShortcutLog(relativePath, logHeader),
    `${specialFolder}\\${relativePath}: Shortcut log entry was added`
  );
  await shellService.deleteShortcut(specialFolder, relativePath);
  ok(
    !shortcutFile.exists(),
    `${specialFolder}\\${relativePath}: Shortcut does not exist after deleting`
  );
  ok(
    !queryShortcutLog(relativePath, logHeader),
    `${specialFolder}\\${relativePath}: Shortcut log entry was removed`
  );
}

function queryShortcutLog(aShortcutName, aSection) {
  const parserFactory = Cc[
    "@mozilla.org/xpcom/ini-parser-factory;1"
  ].createInstance(Ci.nsIINIParserFactory);

  const dir = Services.dirsvc.get("UpdRootD", Ci.nsIFile).parent.parent;
  const enumerator = dir.directoryEntries;

  for (const file of enumerator) {
    // We don't know the user's SID from JS-land, so just look at all of them.
    if (!file.path.match(/[^_]+_S[^_]*_shortcuts.ini/)) {
      continue;
    }

    const parser = parserFactory.createINIParser(file);
    parser.QueryInterface(Ci.nsIINIParser);
    parser.QueryInterface(Ci.nsIINIParserWriter);

    for (let i = 0; ; i++) {
      try {
        let string = parser.getString(aSection, `Shortcut${i}`);
        if (string == aShortcutName) {
          enumerator.close();
          return true;
        }
      } catch (e) {
        // The key didn't exist, stop here.
        break;
      }
    }
  }

  enumerator.close();
  return false;
}

function createDirectory(aFolder) {
  try {
    aFolder.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
  } catch (e) {
    if (e.result != Cr.NS_ERROR_FILE_ALREADY_EXISTS) {
      throw e;
    }
  }
}

function tryRemove(file) {
  try {
    file.remove(false);
    return true;
  } catch (e) {
    return false;
  }
}
