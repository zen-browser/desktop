/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
/* import-globals-from browser_content_sandbox_utils.js */
"use strict";

const lazy = {};

/* getLibcConstants is only present on *nix */
ChromeUtils.defineLazyGetter(lazy, "LIBC", () =>
  ChromeUtils.getLibcConstants()
);

// Test if the content process can create in $HOME, this should fail
async function createFileInHome() {
  let browser = gBrowser.selectedBrowser;
  let homeFile = fileInHomeDir();
  let path = homeFile.path;
  let fileCreated = await SpecialPowers.spawn(browser, [path], createFile);
  ok(!fileCreated.ok, "creating a file in home dir failed");
  is(
    fileCreated.code,
    Cr.NS_ERROR_FILE_ACCESS_DENIED,
    "creating a file in home dir failed with access denied"
  );
  if (fileCreated.ok) {
    // content process successfully created the file, now remove it
    homeFile.remove(false);
  }
}

// Test if the content process can create a temp file, this is forbidden on all
// platforms. Also test that the content process cannot create symlinks on
// macOS/Linux or delete files.
async function createTempFile() {
  // On Windows we allow access to the temp dir for DEBUG builds, because of
  // logging that uses that dir.
  let isDbgWin = isWin() && SpecialPowers.isDebugBuild;

  let browser = gBrowser.selectedBrowser;
  let path = fileInTempDir().path;
  let fileCreated = await SpecialPowers.spawn(browser, [path], createFile);
  if (isDbgWin) {
    ok(fileCreated.ok, "creating a file in temp suceeded");
  } else {
    ok(!fileCreated.ok, "creating a file in temp failed");
    is(
      fileCreated.code,
      Cr.NS_ERROR_FILE_ACCESS_DENIED,
      "creating a file in temp failed with access denied"
    );
  }

  // now delete the file
  let fileDeleted = await SpecialPowers.spawn(browser, [path], deleteFile);
  if (isDbgWin) {
    ok(fileDeleted.ok, "deleting a file in temp succeeded");
  } else {
    ok(!fileDeleted.ok, "deleting a file in temp failed");
    const expectedError = isLinux()
      ? Cr.NS_ERROR_FILE_ACCESS_DENIED
      : Cr.NS_ERROR_FILE_NOT_FOUND;
    is(
      fileDeleted.code,
      expectedError,
      "deleting a file in temp failed with access denied"
    );
  }

  // Test that symlink creation is not allowed on macOS/Linux.
  if (isMac() || isLinux()) {
    let path = fileInTempDir().path;
    let symlinkCreated = await SpecialPowers.spawn(
      browser,
      [path],
      createSymlink
    );
    ok(!symlinkCreated.ok, "created a symlink in temp failed");
    const expectedError = isLinux() ? lazy.LIBC.EACCES : lazy.LIBC.EPERM;
    is(
      symlinkCreated.code,
      expectedError,
      "created a symlink in temp failed with access denied"
    );
  }
}

// Test reading files and dirs from web and file content processes.
async function testFileAccessAllPlatforms() {
  let webBrowser = GetWebBrowser();
  let fileContentProcessEnabled = isFileContentProcessEnabled();
  let fileBrowser = GetFileBrowser();

  // Directories/files to test accessing from content processes.
  // For directories, we test whether a directory listing is allowed
  // or blocked. For files, we test if we can read from the file.
  // Each entry in the array represents a test file or directory
  // that will be read from either a web or file process.
  let tests = [];

  let profileDir = GetProfileDir();
  tests.push({
    desc: "profile dir", // description
    ok: false, // expected to succeed?
    browser: webBrowser, // browser to run test in
    file: profileDir, // nsIFile object
    minLevel: minProfileReadSandboxLevel(), // min level to enable test
    func: readDir,
  });
  if (fileContentProcessEnabled) {
    tests.push({
      desc: "profile dir",
      ok: true,
      browser: fileBrowser,
      file: profileDir,
      minLevel: 0,
      func: readDir,
    });
  }

  let homeDir = GetHomeDir();
  tests.push({
    desc: "home dir",
    ok: false,
    browser: webBrowser,
    file: homeDir,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });
  if (fileContentProcessEnabled) {
    tests.push({
      desc: "home dir",
      ok: true,
      browser: fileBrowser,
      file: homeDir,
      minLevel: 0,
      func: readDir,
    });
  }

  let extensionsDir = GetProfileEntry("extensions");
  if (extensionsDir.exists() && extensionsDir.isDirectory()) {
    tests.push({
      desc: "extensions dir",
      ok: true,
      browser: webBrowser,
      file: extensionsDir,
      minLevel: 0,
      func: readDir,
    });
  } else {
    ok(false, `${extensionsDir.path} is a valid dir`);
  }

  let chromeDir = GetProfileEntry("chrome");
  if (chromeDir.exists() && chromeDir.isDirectory()) {
    tests.push({
      desc: "chrome dir",
      ok: true,
      browser: webBrowser,
      file: chromeDir,
      minLevel: 0,
      func: readDir,
    });
  } else {
    ok(false, `${chromeDir.path} is valid dir`);
  }

  let cookiesFile = GetProfileEntry("cookies.sqlite");
  if (cookiesFile.exists() && !cookiesFile.isDirectory()) {
    tests.push({
      desc: "cookies file",
      ok: false,
      browser: webBrowser,
      file: cookiesFile,
      minLevel: minProfileReadSandboxLevel(),
      func: readFile,
    });
    if (fileContentProcessEnabled) {
      tests.push({
        desc: "cookies file",
        ok: true,
        browser: fileBrowser,
        file: cookiesFile,
        minLevel: 0,
        func: readFile,
      });
    }
  } else {
    ok(false, `${cookiesFile.path} is a valid file`);
  }

  if (isMac() || isLinux()) {
    let varDir = GetDir("/var");

    if (isMac()) {
      // Mac sandbox rules use /private/var because /var is a symlink
      // to /private/var on OS X. Make sure that hasn't changed.
      varDir.normalize();
      Assert.strictEqual(
        varDir.path,
        "/private/var",
        "/var resolves to /private/var"
      );
    }

    tests.push({
      desc: "/var",
      ok: false,
      browser: webBrowser,
      file: varDir,
      minLevel: minHomeReadSandboxLevel(),
      func: readDir,
    });
    if (fileContentProcessEnabled) {
      tests.push({
        desc: "/var",
        ok: true,
        browser: fileBrowser,
        file: varDir,
        minLevel: 0,
        func: readDir,
      });
    }
  }

  await runTestsList(tests);
}

async function testFileAccessMacOnly() {
  if (!isMac()) {
    return;
  }

  let webBrowser = GetWebBrowser();
  let fileContentProcessEnabled = isFileContentProcessEnabled();
  let fileBrowser = GetFileBrowser();
  let level = GetSandboxLevel();

  let tests = [];

  // If ~/Library/Caches/TemporaryItems exists, when level <= 2 we
  // make sure it's readable. For level 3, we make sure it isn't.
  let homeTempDir = GetHomeDir();
  homeTempDir.appendRelativePath("Library/Caches/TemporaryItems");
  if (homeTempDir.exists()) {
    let shouldBeReadable, minLevel;
    if (level >= minHomeReadSandboxLevel()) {
      shouldBeReadable = false;
      minLevel = minHomeReadSandboxLevel();
    } else {
      shouldBeReadable = true;
      minLevel = 0;
    }
    tests.push({
      desc: "home library cache temp dir",
      ok: shouldBeReadable,
      browser: webBrowser,
      file: homeTempDir,
      minLevel,
      func: readDir,
    });
  }

  // Test if we can read from $TMPDIR because we expect it
  // to be within /private/var. Reading from it should be
  // prevented in a 'web' process.
  let macTempDir = GetDirFromEnvVariable("TMPDIR");

  macTempDir.normalize();
  Assert.ok(
    macTempDir.path.startsWith("/private/var"),
    "$TMPDIR is in /private/var"
  );

  tests.push({
    desc: `$TMPDIR (${macTempDir.path})`,
    ok: false,
    browser: webBrowser,
    file: macTempDir,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });
  if (fileContentProcessEnabled) {
    tests.push({
      desc: `$TMPDIR (${macTempDir.path})`,
      ok: true,
      browser: fileBrowser,
      file: macTempDir,
      minLevel: 0,
      func: readDir,
    });
  }

  // The font registry directory is in the Darwin user cache dir which is
  // accessible with the getconf(1) library call using DARWIN_USER_CACHE_DIR.
  // For this test, assume the cache dir is located at $TMPDIR/../C and use
  // the $TMPDIR to derive the path to the registry.
  let fontRegistryDir = macTempDir.parent.clone();
  fontRegistryDir.appendRelativePath("C/com.apple.FontRegistry");
  if (fontRegistryDir.exists()) {
    tests.push({
      desc: `FontRegistry (${fontRegistryDir.path})`,
      ok: true,
      browser: webBrowser,
      file: fontRegistryDir,
      minLevel: minHomeReadSandboxLevel(),
      func: readDir,
    });
    // Check that we can read the file named `font` which typically
    // exists in the the font registry directory.
    let fontFile = fontRegistryDir.clone();
    fontFile.appendRelativePath("font");
    if (fontFile.exists()) {
      tests.push({
        desc: `FontRegistry file (${fontFile.path})`,
        ok: true,
        browser: webBrowser,
        file: fontFile,
        minLevel: minHomeReadSandboxLevel(),
        func: readFile,
      });
    }
  }

  // Test that we cannot read from /Volumes at level 3
  let volumes = GetDir("/Volumes");
  tests.push({
    desc: "/Volumes",
    ok: false,
    browser: webBrowser,
    file: volumes,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });

  // Test that we cannot read from /Users at level 3
  let users = GetDir("/Users");
  tests.push({
    desc: "/Users",
    ok: false,
    browser: webBrowser,
    file: users,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });

  // Test that we can stat /Users at level 3
  tests.push({
    desc: "/Users",
    ok: true,
    browser: webBrowser,
    file: users,
    minLevel: minHomeReadSandboxLevel(),
    func: statPath,
  });

  // Test that we can stat /Library at level 3, but can't get a
  // directory listing of /Library. This test uses "/Library"
  // because it's a path that is expected to always be present.
  let libraryDir = GetDir("/Library");
  tests.push({
    desc: "/Library",
    ok: true,
    browser: webBrowser,
    file: libraryDir,
    minLevel: minHomeReadSandboxLevel(),
    func: statPath,
  });
  tests.push({
    desc: "/Library",
    ok: false,
    browser: webBrowser,
    file: libraryDir,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });

  // Similarly, test that we can stat /private, but not /private/etc.
  let privateDir = GetDir("/private");
  tests.push({
    desc: "/private",
    ok: true,
    browser: webBrowser,
    file: privateDir,
    minLevel: minHomeReadSandboxLevel(),
    func: statPath,
  });

  await runTestsList(tests);
}

async function testFileAccessLinuxOnly() {
  if (!isLinux()) {
    return;
  }

  let webBrowser = GetWebBrowser();
  let fileContentProcessEnabled = isFileContentProcessEnabled();
  let fileBrowser = GetFileBrowser();

  let tests = [];

  // Test /proc/self/fd, because that can be used to unfreeze
  // frozen shared memory.
  let selfFdDir = GetDir("/proc/self/fd");
  tests.push({
    desc: "/proc/self/fd",
    ok: false,
    browser: webBrowser,
    file: selfFdDir,
    minLevel: isContentFileIOSandboxed(),
    func: readDir,
  });

  let cacheFontConfigDir = GetHomeSubdir(".cache/fontconfig/");
  tests.push({
    desc: `$HOME/.cache/fontconfig/ (${cacheFontConfigDir.path})`,
    ok: true,
    browser: webBrowser,
    file: cacheFontConfigDir,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });

  // allows to handle both $HOME/.config/ or $XDG_CONFIG_HOME
  let configDir = GetHomeSubdir(".config");

  const xdgConfigHome = Services.env.get("XDG_CONFIG_HOME");
  if (xdgConfigHome) {
    configDir = GetDir(xdgConfigHome);
    configDir.normalize();
  }

  tests.push({
    desc: `$XDG_CONFIG_HOME (${configDir.path})`,
    ok: true, // access should not be granted outside of XDG support
    browser: webBrowser,
    file: configDir,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });

  tests.push({
    desc: `XDG_CONFIG_HOME=${configDir.path} dir should have rdonly`,
    ok: true, // should be allowed only if XDG support is there
    browser: webBrowser,
    file: configDir,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });

  if (fileContentProcessEnabled) {
    tests.push({
      desc: `${configDir.path} dir`,
      ok: true, // should be allowed only if XDG support is there
      browser: fileBrowser,
      file: configDir,
      minLevel: 0,
      func: readDir,
    });
  }

  if (isXdgEnabled() && xdgConfigHome) {
    const homeConfigDir = GetHomeSubdir(".config");
    tests.push({
      desc: `XDG_CONFIG_HOME=${homeConfigDir.path} dir should deny $HOME/.config`,
      ok: false,
      browser: webBrowser,
      file: homeConfigDir,
      minLevel: minHomeReadSandboxLevel(),
      func: readDir,
    });
    if (fileContentProcessEnabled) {
      tests.push({
        desc: `${homeConfigDir.path} dir`,
        ok: true,
        browser: fileBrowser,
        file: homeConfigDir,
        minLevel: 0,
        func: readDir,
      });
    }
  } else {
    // WWhen XDG_CONFIG_HOME is not set, verify we do not allow $HOME/.configlol
    // (i.e., check allow the dir and not the prefix)
    //
    // Checking $HOME/.config is already done above.
    const homeConfigPrefix = GetHomeSubdir(".configlol");
    tests.push({
      desc: `No XDG_CONFIG_HOME we dont allow ${homeConfigPrefix.path} access`,
      ok: false,
      browser: webBrowser,
      file: homeConfigPrefix,
      minLevel: minHomeReadSandboxLevel(),
      func: readDir,
    });
    if (fileContentProcessEnabled) {
      tests.push({
        desc: `No XDG_CONFIG_HOME we dont allow ${homeConfigPrefix.path} access`,
        ok: false,
        browser: fileBrowser,
        file: homeConfigPrefix,
        minLevel: 0,
        func: readDir,
      });
    }
  }

  // Create a file under $HOME/.config/ or $XDG_CONFIG_HOME and ensure we can
  // read it
  let fileUnderConfig = GetSubdirFile(configDir);
  await IOUtils.writeUTF8(fileUnderConfig.path, "TEST FILE DUMMY DATA");
  ok(
    await IOUtils.exists(fileUnderConfig.path),
    `File ${fileUnderConfig.path} was properly created`
  );

  tests.push({
    desc: `${configDir.path}/xxx is readable (${fileUnderConfig.path})`,
    ok: true,
    browser: webBrowser,
    file: fileUnderConfig,
    minLevel: minHomeReadSandboxLevel(),
    func: readFile,
    cleanup: aPath => IOUtils.remove(aPath),
  });

  let configFile = GetSubdirFile(configDir);
  tests.push({
    desc: `${configDir.path} file write`,
    ok: false,
    browser: webBrowser,
    file: configFile,
    minLevel: minHomeReadSandboxLevel(),
    func: createFile,
  });
  if (fileContentProcessEnabled) {
    tests.push({
      desc: `${configDir.path} file write`,
      ok: false,
      browser: fileBrowser,
      file: configFile,
      minLevel: 0,
      func: createFile,
    });
  }

  // Create a $HOME/.config/mozilla/ or $XDG_CONFIG_HOME/mozilla/ if none
  // exists and assert content process cannot access it
  let configMozilla = GetSubdir(configDir, "mozilla");
  const emptyFileName = ".test_run_browser_sandbox.tmp";
  let emptyFile = configMozilla.clone();
  emptyFile.appendRelativePath(emptyFileName);

  let populateFakeConfigMozilla = async aPath => {
    // called with configMozilla
    await IOUtils.makeDirectory(aPath, { permissions: 0o700 });
    await IOUtils.writeUTF8(emptyFile.path, "");
    ok(
      await IOUtils.exists(emptyFile.path),
      `Temp file ${emptyFile.path} was created`
    );
  };

  let unpopulateFakeConfigMozilla = async aPath => {
    // called with emptyFile
    await IOUtils.remove(aPath);
    ok(!(await IOUtils.exists(aPath)), `Temp file ${aPath} was removed`);
    const parentDir = PathUtils.parent(aPath);
    try {
      await IOUtils.remove(parentDir, { recursive: false });
    } catch (ex) {
      if (
        !DOMException.isInstance(ex) ||
        ex.name !== "OperationError" ||
        /Could not remove the non-empty directory/.test(ex.message)
      ) {
        // If we get here it means the directory was not empty and since we assert
        // earlier we removed the temp file we created it means we should not
        // worrying about removing this directory ...
        throw ex;
      }
    }
  };

  await populateFakeConfigMozilla(configMozilla.path);

  tests.push({
    desc: `stat ${configDir.path}/mozilla (${configMozilla.path})`,
    ok: false,
    browser: webBrowser,
    file: configMozilla,
    minLevel: minHomeReadSandboxLevel(),
    func: statPath,
  });

  tests.push({
    desc: `read ${configDir.path}/mozilla (${configMozilla.path})`,
    ok: false,
    browser: webBrowser,
    file: configMozilla,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });

  tests.push({
    desc: `stat ${configDir.path}/mozilla/${emptyFileName} (${emptyFile.path})`,
    ok: false,
    browser: webBrowser,
    file: emptyFile,
    minLevel: minHomeReadSandboxLevel(),
    func: statPath,
  });

  tests.push({
    desc: `read ${configDir.path}/mozilla/${emptyFileName} (${emptyFile.path})`,
    ok: false,
    browser: webBrowser,
    file: emptyFile,
    minLevel: minHomeReadSandboxLevel(),
    func: readFile,
    cleanup: unpopulateFakeConfigMozilla,
  });

  // Only needed to perform cleanup
  if (isXdgEnabled()) {
    tests.push({
      desc: `$XDG_CONFIG_HOME (${configDir.path}) cleanup`,
      ok: true,
      browser: webBrowser,
      file: configDir,
      minLevel: minHomeReadSandboxLevel(),
      func: readDir,
    });
  }

  await runTestsList(tests);
}

async function testFileAccessLinuxSnap() {
  let webBrowser = GetWebBrowser();

  let tests = [];

  // Assert that if we run with SNAP= env, then we allow access to it in the
  // content process
  let snap = Services.env.get("SNAP");
  let snapExpectedResult = false;
  if (snap.length > 1) {
    snapExpectedResult = true;
  } else {
    snap = "/tmp/.snap_firefox_current/";
  }

  let snapDir = GetDir(snap);
  snapDir.normalize();

  let snapFile = GetSubdirFile(snapDir);
  await createFile(snapFile.path);
  ok(await IOUtils.exists(snapFile.path), `SNAP ${snapFile.path} was created`);
  info(`SNAP (file) ${snapFile.path} was created`);

  tests.push({
    desc: `$SNAP (${snapDir.path} => ${snapFile.path})`,
    ok: snapExpectedResult,
    browser: webBrowser,
    file: snapFile,
    minLevel: minHomeReadSandboxLevel(),
    func: readFile,
  });

  await runTestsList(tests);
}

async function testFileAccessWindowsOnly() {
  if (!isWin()) {
    return;
  }

  let webBrowser = GetWebBrowser();

  let tests = [];

  let extDir = GetPerUserExtensionDir();
  tests.push({
    desc: "per-user extensions dir",
    ok: true,
    browser: webBrowser,
    file: extDir,
    minLevel: minHomeReadSandboxLevel(),
    func: readDir,
  });

  await runTestsList(tests);
}

function cleanupBrowserTabs() {
  let fileBrowser = GetFileBrowser();
  if (fileBrowser.selectedTab) {
    gBrowser.removeTab(fileBrowser.selectedTab);
  }

  let webBrowser = GetWebBrowser();
  if (webBrowser.selectedTab) {
    gBrowser.removeTab(webBrowser.selectedTab);
  }

  let tab1 = gBrowser.tabs[1];
  if (tab1) {
    gBrowser.removeTab(tab1);
  }
}
