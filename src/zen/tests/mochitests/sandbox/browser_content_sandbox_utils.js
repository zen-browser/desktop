/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

const uuidGenerator = Services.uuid;

/*
 * Utility functions for the browser content sandbox tests.
 */

function sanityChecks() {
  // This test is only relevant in e10s
  if (!gMultiProcessBrowser) {
    ok(false, "e10s is enabled");
    info("e10s is not enabled, exiting");
    return;
  }

  let level = 0;
  let prefExists = true;

  // Read the security.sandbox.content.level pref.
  // eslint-disable-next-line mozilla/use-default-preference-values
  try {
    level = Services.prefs.getIntPref("security.sandbox.content.level");
  } catch (e) {
    prefExists = false;
  }

  ok(prefExists, "pref security.sandbox.content.level exists");
  if (!prefExists) {
    return;
  }

  info(`security.sandbox.content.level=${level}`);
  Assert.greater(level, 0, "content sandbox is enabled.");

  let isFileIOSandboxed = isContentFileIOSandboxed(level);

  // Content sandbox enabled, but level doesn't include file I/O sandboxing.
  ok(isFileIOSandboxed, "content file I/O sandboxing is enabled.");
  if (!isFileIOSandboxed) {
    info("content sandbox level too low for file I/O tests, exiting\n");
  }
}

function isXdgEnabled() {
  try {
    return Services.prefs.getBoolPref("widget.support-xdg-config");
  } catch (ex) {
    // if the pref is not there it means we dont have XDG support
    if (ex.name === "NS_ERROR_UNEXPECTED") {
      return false;
    }
    throw ex;
  }
}

// Creates file at |path| and returns a promise that resolves with an object
// with .ok boolean to indicate true if the file was successfully created,
// otherwise false. Include imports so this can be safely serialized and run
// remotely by ContentTask.spawn.
//
// Report the exception's error code in .code as well.
function createFile(path) {
  const { FileUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/FileUtils.sys.mjs"
  );

  try {
    const fstream = Cc[
      "@mozilla.org/network/file-output-stream;1"
    ].createInstance(Ci.nsIFileOutputStream);

    fstream.init(
      new FileUtils.File(path),
      -1, // readonly mode
      -1, // default permissions
      0
    ); // behaviour flags

    const ostream = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(
      Ci.nsIBinaryOutputStream
    );
    ostream.setOutputStream(fstream);

    const data = "TEST FILE DUMMY DATA";
    ostream.writeBytes(data, data.length);

    ostream.close();
    fstream.close();
  } catch (e) {
    return { ok: false, code: e.result };
  }

  return { ok: true };
}

// Creates a symlink at |path| and returns a promise that resolves with an
// object with .ok boolean to indicate true if the symlink was successfully
// created, otherwise false. Include imports so this can be safely serialized
// and run remotely by ContentTask.spawn.
//
// Report the exception's error code in .code as well.
// Report errno in .code if syscall returns -1.
function createSymlink(path) {
  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs"
  );

  try {
    // Trying to open "libc.so" on linux will fail with invalid elf header error
    // because it would be a linker script. Using libc.so.6 avoids that.
    const libc = ctypes.open(
      Services.appinfo.OS === "Darwin" ? "libSystem.B.dylib" : "libc.so.6"
    );

    const symlink = libc.declare(
      "symlink",
      ctypes.default_abi,
      ctypes.int, // return value
      ctypes.char.ptr, // target
      ctypes.char.ptr //linkpath
    );

    ctypes.errno = 0;
    const rv = symlink("/etc", path);
    const _errno = ctypes.errno;
    if (rv < 0) {
      return { ok: false, code: _errno };
    }
  } catch (e) {
    return { ok: false, code: e.result };
  }

  return { ok: true };
}

// Deletes file at |path| and returns a promise that resolves with an object
// with .ok boolean to indicate true if the file was successfully deleted,
// otherwise false. Include imports so this can be safely serialized and run
// remotely by ContentTask.spawn.
//
// Report the exception's error code in .code as well.
function deleteFile(path) {
  const { FileUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/FileUtils.sys.mjs"
  );

  try {
    const file = new FileUtils.File(path);
    file.remove(false);
  } catch (e) {
    return { ok: false, code: e.result };
  }

  return { ok: true };
}

// Reads the directory at |path| and returns a promise that resolves when
// iteration over the directory finishes or encounters an error. The promise
// resolves with an object where .ok indicates success or failure and
// .numEntries is the number of directory entries found.
//
// Report the exception's error code in .code as well.
function readDir(path) {
  const { FileUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/FileUtils.sys.mjs"
  );

  let numEntries = 0;

  try {
    const file = new FileUtils.File(path);
    const enumerator = file.directoryEntries;

    while (enumerator.hasMoreElements()) {
      void enumerator.nextFile;
      numEntries++;
    }
  } catch (e) {
    return { ok: false, numEntries, code: e.result };
  }

  return { ok: true, numEntries };
}

// Reads the file at |path| and returns a promise that resolves when
// reading is completed. Returned object has boolean .ok to indicate
// success or failure.
//
// Report the exception's error code in .code as well.
function readFile(path) {
  const { FileUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/FileUtils.sys.mjs"
  );

  try {
    const file = new FileUtils.File(path);

    const fstream = Cc[
      "@mozilla.org/network/file-input-stream;1"
    ].createInstance(Ci.nsIFileInputStream);
    fstream.init(file, -1, -1, 0);

    const istream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(
      Ci.nsIBinaryInputStream
    );
    istream.setInputStream(fstream);

    const available = istream.available();
    void istream.readBytes(available);
  } catch (e) {
    return { ok: false, code: e.result };
  }

  return { ok: true };
}

// Does a stat of |path| and returns a promise that resolves if the
// stat is successful. Returned object has boolean .ok to indicate
// success or failure.
//
// Report the exception's error code in .code as well.
function statPath(path) {
  const { FileUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/FileUtils.sys.mjs"
  );

  try {
    const file = new FileUtils.File(path);
    void file.lastModifiedTime;
  } catch (e) {
    return { ok: false, code: e.result };
  }

  return { ok: true };
}

// Returns true if the current content sandbox level, passed in
// the |level| argument, supports filesystem sandboxing.
function isContentFileIOSandboxed(level) {
  let fileIOSandboxMinLevel = 0;

  // Set fileIOSandboxMinLevel to the lowest level that has
  // content filesystem sandboxing enabled. For now, this
  // varies across Windows, Mac, Linux, other.
  switch (Services.appinfo.OS) {
    case "WINNT":
      fileIOSandboxMinLevel = 1;
      break;
    case "Darwin":
      fileIOSandboxMinLevel = 1;
      break;
    case "Linux":
      fileIOSandboxMinLevel = 2;
      break;
    default:
      Assert.ok(false, "Unknown OS");
  }

  return level >= fileIOSandboxMinLevel;
}

// Returns the lowest sandbox level where blanket reading of the profile
// directory from the content process should be blocked by the sandbox.
function minProfileReadSandboxLevel() {
  switch (Services.appinfo.OS) {
    case "WINNT":
      return 3;
    case "Darwin":
      return 2;
    case "Linux":
      return 3;
    default:
      Assert.ok(false, "Unknown OS");
      return 0;
  }
}

// Returns the lowest sandbox level where blanket reading of the home
// directory from the content process should be blocked by the sandbox.
function minHomeReadSandboxLevel() {
  switch (Services.appinfo.OS) {
    case "WINNT":
      return 3;
    case "Darwin":
      return 3;
    case "Linux":
      return 3;
    default:
      Assert.ok(false, "Unknown OS");
      return 0;
  }
}

function isMac() {
  return Services.appinfo.OS == "Darwin";
}
function isWin() {
  return Services.appinfo.OS == "WINNT";
}
function isLinux() {
  return Services.appinfo.OS == "Linux";
}

function isNightly() {
  let version = SpecialPowers.Services.appinfo.version;
  return version.endsWith("a1");
}

function uuid() {
  return uuidGenerator.generateUUID().toString();
}

// Returns a file object for a new file in the home dir ($HOME/<UUID>).
function fileInHomeDir() {
  // get home directory, make sure it exists
  let homeDir = Services.dirsvc.get("Home", Ci.nsIFile);
  Assert.ok(homeDir.exists(), "Home dir exists");
  Assert.ok(homeDir.isDirectory(), "Home dir is a directory");

  // build a file object for a new file named $HOME/<UUID>
  let homeFile = homeDir.clone();
  homeFile.appendRelativePath(uuid());
  Assert.ok(!homeFile.exists(), homeFile.path + " does not exist");
  return homeFile;
}

// Returns a file object for a new file in the content temp dir (.../<UUID>).
function fileInTempDir() {
  let contentTempKey = "TmpD";

  // get the content temp dir, make sure it exists
  let ctmp = Services.dirsvc.get(contentTempKey, Ci.nsIFile);
  Assert.ok(ctmp.exists(), "Temp dir exists");
  Assert.ok(ctmp.isDirectory(), "Temp dir is a directory");

  // build a file object for a new file in content temp
  let tempFile = ctmp.clone();
  tempFile.appendRelativePath(uuid());
  Assert.ok(!tempFile.exists(), tempFile.path + " does not exist");
  return tempFile;
}

function GetProfileDir() {
  // get profile directory
  let profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
  return profileDir;
}

function GetHomeDir() {
  // get home directory
  let homeDir = Services.dirsvc.get("Home", Ci.nsIFile);
  return homeDir;
}

function GetHomeSubdir(subdir) {
  return GetSubdir(GetHomeDir(), subdir);
}

function GetHomeSubdirFile(subdir) {
  return GetSubdirFile(GetHomeSubdir(subdir));
}

function GetSubdir(dir, subdir) {
  let newSubdir = dir.clone();
  newSubdir.appendRelativePath(subdir);
  return newSubdir;
}

function GetSubdirFile(dir) {
  let newFile = dir.clone();
  newFile.appendRelativePath(uuid());
  return newFile;
}

function GetPerUserExtensionDir() {
  return Services.dirsvc.get("XREUSysExt", Ci.nsIFile);
}

// Returns a file object for the file or directory named |name| in the
// profile directory.
function GetProfileEntry(name) {
  let entry = GetProfileDir();
  entry.append(name);
  return entry;
}

function GetDir(path) {
  info(`GetDir(${path})`);
  let dir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  dir.initWithPath(path);
  Assert.ok(dir.isDirectory(), `${path} is a directory`);
  return dir;
}

function GetDirFromEnvVariable(varName) {
  return GetDir(Services.env.get(varName));
}

function GetFile(path) {
  let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(path);
  return file;
}

function GetBrowserType(type) {
  let browserType = undefined;

  if (!GetBrowserType[type]) {
    if (type === "web") {
      GetBrowserType[type] = gBrowser.selectedBrowser;
    } else {
      // open a tab in a `type` content process
      gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
        preferredRemoteType: type,
        allowInheritPrincipal: true,
      });
      // get the browser for the `type` process tab
      GetBrowserType[type] = gBrowser.getBrowserForTab(gBrowser.selectedTab);
    }
  }

  browserType = GetBrowserType[type];
  Assert.strictEqual(
    browserType.remoteType,
    type,
    `GetBrowserType(${type}) returns a ${type} process`
  );
  return browserType;
}

function GetWebBrowser() {
  return GetBrowserType("web");
}

function isFileContentProcessEnabled() {
  // Ensure that the file content process is enabled.
  let fileContentProcessEnabled = Services.prefs.getBoolPref(
    "browser.tabs.remote.separateFileUriProcess"
  );
  ok(fileContentProcessEnabled, "separate file content process is enabled");
  return fileContentProcessEnabled;
}

function GetFileBrowser() {
  if (!isFileContentProcessEnabled()) {
    return undefined;
  }
  return GetBrowserType("file");
}

function GetSandboxLevel() {
  // Current level
  return Services.prefs.getIntPref("security.sandbox.content.level");
}

async function runTestsList(tests) {
  let level = GetSandboxLevel();

  // remove tests not enabled by the current sandbox level
  tests = tests.filter(test => test.minLevel <= level);

  for (let test of tests) {
    let okString = test.ok ? "allowed" : "blocked";
    let processType = test.browser.remoteType;

    // ensure the file/dir exists before we ask a content process to stat
    // it so we know a failure is not due to a nonexistent file/dir
    if (test.func === statPath) {
      ok(test.file.exists(), `${test.file.path} exists`);
    }

    let result = await ContentTask.spawn(
      test.browser,
      test.file.path,
      test.func
    );

    Assert.equal(
      result.ok,
      test.ok,
      `reading ${test.desc} from a ${processType} process ` +
        `is ${okString} (${test.file.path})`
    );

    // if the directory is not expected to be readable,
    // ensure the listing has zero entries
    if (test.func === readDir && !test.ok) {
      Assert.equal(
        result.numEntries,
        0,
        `directory list is empty (${test.file.path})`
      );
    }

    if (test.cleanup != undefined) {
      await test.cleanup(test.file.path);
    }
  }
}
