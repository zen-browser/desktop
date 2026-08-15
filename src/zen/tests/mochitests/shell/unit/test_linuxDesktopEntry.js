/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  AppConstants: "resource://gre/modules/AppConstants.sys.mjs",
  FileTestUtils: "resource://testing-common/FileTestUtils.sys.mjs",
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

const { Subprocess, getSubprocessImplForTest } = ChromeUtils.importESModule(
  "resource://gre/modules/Subprocess.sys.mjs"
);

const kOriginalEnvironment = Subprocess.getEnvironment();
let gEnvironment = [["PATH", ""]];

const gBrowserExe = Services.dirsvc.get("XREExeF", Ci.nsIFile).path;

// This is a symbol so it's a different type than a string.
const kAbsoluteArgv0 = Symbol("argv0");

const gTmpDir = Services.dirsvc.get("TmpD", Ci.nsIFile);
gTmpDir.append("createLinuxDesktopEntry-" + Date.now());

const gDirectoryServiceProvider = {
  getFile(prop, persistent) {
    persistent.value = false;

    // We only expect a narrow range of calls.
    let folder;
    let type = Ci.nsIFile.DIRECTORY_TYPE;
    switch (prop) {
      case "Home":
        folder = gTmpDir.clone();
        folder.append("home");
        break;
      default:
        console.error(`Access to unexpected directory '${prop}'`);
        return Cr.NS_ERROR_FAILURE;
    }

    try {
      folder.create(type, 0o755);
    } catch (e) {
      if (e.result !== Cr.NS_ERROR_FILE_ALREADY_EXISTS) {
        throw e;
      }
    }

    return folder;
  },
};

/**
 * Parses the INI file at the given path.
 *
 * @param {string} path - The path to the INI file.
 * @returns {nsIINIParser} The parsed INI file.
 */
async function parseINI(path) {
  let parser = Cc["@mozilla.org/xpcom/ini-parser-factory;1"]
    .getService(Ci.nsIINIParserFactory)
    .createINIParser();

  // The file should be UTF-8, so use IOUtils to make sure that's the case.
  parser.initFromString(await IOUtils.readUTF8(path));
  return parser;
}

add_setup(async function setup() {
  Services.dirsvc
    .QueryInterface(Ci.nsIDirectoryService)
    .registerProvider(gDirectoryServiceProvider);

  sinon
    .stub(getSubprocessImplForTest(), "getEnvironment")
    .callsFake(() => gEnvironment);
});

registerCleanupFunction(async function cleanupTmp() {
  gTmpDir.remove(true);
});

add_setup(function setupEnv() {
  Services.env.set("XDG_DATA_HOME", "");
});

add_task(async function test_validateAppId() {
  let message = /Desktop entry ID '[^']*' is invalid/;
  await Assert.rejects(
    ShellService.createLinuxDesktopEntry("", "ignored", [], ""),
    message,
    "The empty string is not a valid application ID"
  );
  await Assert.rejects(
    ShellService.createLinuxDesktopEntry("a.1b.c", "ignored", [], ""),
    message,
    "Segment cannot begin with a digit"
  );
  await Assert.rejects(
    ShellService.createLinuxDesktopEntry("a..c", "ignored", [], ""),
    message,
    "Segment cannot be empty"
  );
  // Doesn't really care about return value, just that it doesn't throw.
  Assert.equal(
    await ShellService.createLinuxDesktopEntry("a.b.c", "ignored", [], ""),
    undefined,
    "Typical segment is allowed"
  );
  Assert.equal(
    await ShellService.createLinuxDesktopEntry(
      "a-._b4.c__3",
      "ignored",
      [],
      ""
    ),
    undefined,
    "Underscores and numbers are allowed"
  );
});

add_task(async function test_xdgdir() {
  // By default, it should go into ~/.local/share/applications.
  let path = PathUtils.join(
    gTmpDir.path,
    "home",
    ".local",
    "share",
    "applications",
    "xdgdir.a.b.desktop"
  );
  await ShellService.createLinuxDesktopEntry("xdgdir.a.b", "ignored", [], "");
  Assert.ok(
    await IOUtils.exists(path),
    "Desktop file was created in the default location if XDG_DATA_HOME is unset"
  );

  // But $XDG_DATA_HOME/applications should be used instead if available.
  Services.env.set("XDG_DATA_HOME", PathUtils.join(gTmpDir.path, "datahome"));
  path = PathUtils.join(
    gTmpDir.path,
    "datahome",
    "applications",
    "xdgdir.c.d.desktop"
  );
  await ShellService.createLinuxDesktopEntry("xdgdir.c.d", "ignored", [], "");
  Assert.ok(
    await IOUtils.exists(path),
    "Desktop file was created in XDG_DATA_HOME/applications"
  );
  await IOUtils.remove(path); // datahome isn't removed in 'cleanup'

  // ...unless it's invalid. (Or empty, but XPCOM doesn't differentiate 'empty'
  // and 'nonexistent', which is fine.)
  Services.env.set("XDG_DATA_HOME", "pineapple!");
  path = PathUtils.join(
    gTmpDir.path,
    "home",
    ".local",
    "share",
    "applications",
    "xdgdir.e.f.desktop"
  );
  await ShellService.createLinuxDesktopEntry("xdgdir.e.f", "ignored", [], "");
  Assert.ok(
    await IOUtils.exists(path),
    "Desktop file was created in the default location if XDG_DATA_HOME is invalid"
  );

  Services.env.set("XDG_DATA_HOME", "");
});

add_task(async function test_standardContent() {
  let sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "shellService").value({
    getArgv0: () => "/executable",
  });

  let path = PathUtils.join(
    gTmpDir.path,
    "home",
    ".local",
    "share",
    "applications",
    "content.a.desktop"
  );
  await ShellService.createLinuxDesktopEntry(
    "content.a",
    "Cool Progr\xe0m!",
    [],
    "open-menu-symbolic"
  );
  let ini = await parseINI(path);

  Assert.equal(
    ini.getSections().getNext(),
    "Desktop Entry",
    "'Desktop Entry' must be the first section in the file"
  );
  Assert.equal(
    ini.getString("Desktop Entry", "Version"),
    "1.5",
    "Compliance with version 1.5 of the spec is declared"
  );
  Assert.equal(
    ini.getString("Desktop Entry", "Name"),
    "Cool Progr\xe0m!",
    "The name is stored, including any non-ASCII characters"
  );
  Assert.equal(
    ini.getString("Desktop Entry", "Exec"),
    `"/executable"`,
    "argv[0] will be run without any arguments"
  );
  Assert.equal(
    ini.getString("Desktop Entry", "Icon"),
    "open-menu-symbolic",
    "The icon is exactly the provided text"
  );

  sandbox.restore();
});

add_task(async function test_exec() {
  let sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "shellService").value({
    getArgv0: () => "/executable",
  });

  let path = PathUtils.join(
    gTmpDir.path,
    "home",
    ".local",
    "share",
    "applications",
    "content.b.desktop"
  );
  await ShellService.createLinuxDesktopEntry(
    "content.b",
    "Exec Test",
    ["abc", "$d$e$f", "gh\\i", "jk lm", '"nopq"'],
    ""
  );
  let ini = await parseINI(path);

  Assert.equal(
    ini.getString("Desktop Entry", "Exec"),
    `"/executable" "abc" "\\$d\\$e\\$f" "gh\\\\i" "jk lm" "\\"nopq\\""`,
    "Arguments are escaped as expected"
  );

  sandbox.restore();
});

add_task(async function test_relativeArgv0() {
  let sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "shellService").value({
    getArgv0: () => "../relative/./to",
  });

  let path = PathUtils.join(
    gTmpDir.path,
    "home",
    ".local",
    "share",
    "applications",
    "relative.desktop"
  );
  await ShellService.createLinuxDesktopEntry("relative", "Exec Test", [], "");
  let ini = await parseINI(path);

  let cwdParent = Services.dirsvc.get("CurWorkD", Ci.nsIFile).parent.path;
  Assert.equal(
    ini.getString("Desktop Entry", "Exec"),
    `"${cwdParent}/relative/./to"`,
    "The relative argv[0] value is replaced with an absolute path"
  );

  sandbox.restore();
});

add_task(async function test_pathLookup_nonPathArgv0() {
  let name = "argv0";
  await checkPathLookup([name], "anything", name, { argv0: name });

  name = AppConstants.MOZ_APP_NAME;
  await checkPathLookup([name], "anything", name, { argv0: name });

  name = AppConstants.MOZ_APP_NAME + "-" + AppConstants.MOZ_UPDATE_CHANNEL;
  await checkPathLookup([name], "anything", name, { argv0: name });
});

add_task(async function test_pathLookup_nonPathArgv0_notInPath() {
  await checkPathLookup([], "anything", gBrowserExe, { argv0: "argv0" });
});

add_task(async function test_pathLookup_notInPath() {
  await checkPathLookup([], "argv0", kAbsoluteArgv0);
});

add_task(async function test_pathLookup_emptyArgv0() {
  await checkPathLookup([], "argv0", gBrowserExe, { argv0: "" });

  let name = AppConstants.MOZ_APP_NAME;
  await checkPathLookup([name], gBrowserExe, name, { argv0: "" });

  name = AppConstants.MOZ_APP_NAME + "-" + AppConstants.MOZ_UPDATE_CHANNEL;
  await checkPathLookup([name], gBrowserExe, name, { argv0: "" });
});

add_task(async function test_pathLookup_argv0() {
  await checkPathLookup(["argv0"], "argv0", "argv0");
  await checkPathLookup(["argv0"], "elsewhere", kAbsoluteArgv0);
});

add_task(async function test_pathLookup_appNameOnly() {
  let name = AppConstants.MOZ_APP_NAME;
  await checkPathLookup([name], "argv0", name);
  await checkPathLookup([name], "elsewhere", kAbsoluteArgv0);
});

add_task(async function test_pathLookup_updateBranch() {
  let name = AppConstants.MOZ_APP_NAME + "-" + AppConstants.MOZ_UPDATE_CHANNEL;
  await checkPathLookup([name], "argv0", name);
  await checkPathLookup([name], "elsewhere", kAbsoluteArgv0);
});

add_task(async function test_pathLookup_priority() {
  let options = [
    "argv0",
    AppConstants.MOZ_APP_NAME + "-" + AppConstants.MOZ_UPDATE_CHANNEL,
    AppConstants.MOZ_APP_NAME,
  ];

  for (let i = 0; options.length; i++) {
    await checkPathLookup(options, "argv0", options[0]);
    options.shift();
  }
});

/**
 * Checks, indirectly, that ShellService._findStartupCommand works as expected.
 *
 * The names in linkNames are created as symlinks to a transient file
 * targetName and made available in $PATH. A desktop entry is then created, and
 * the Exec line's command name is compared to expected.
 *
 * @param {string[]} linkNames - A list of symlink names that will be present
 * in the (fake) $PATH during the check.
 * @param {string} targetName - The file that those symlinks point to, within a
 * transient 'bin' folder.
 * @param {string} expected - The command name that is expected in the desktop
 * file. If this is kAbsoluteArgv0, the absolute path of the transient argv0
 * will be expected.
 * @param {{argv0:string}} [options] - Additional options, currently the value
 * to use as argv[0]. If no value is provided, a file 'argv0' in the transient
 * bin folder will be used.
 */
async function checkPathLookup(
  linkNames,
  targetName,
  expected,
  { argv0 } = {}
) {
  let desktopEntryPath = PathUtils.join(
    gTmpDir.path,
    "home",
    ".local",
    "share",
    "applications",
    "checkpathlookup.desktop"
  );
  Assert.equal(
    await IOUtils.exists(desktopEntryPath),
    false,
    "Desktop entry path shouldn't exist yet"
  );

  // Don't just put it in gTmpDir to avoid the file being found in other
  // tests if this one exits halfway through (e.g. in the debugger).
  let container = await IOUtils.createUniqueDirectory(
    gTmpDir.path,
    "test_linuxDesktopEntry_checkPathLookup"
  );

  let sandbox = sinon.createSandbox();
  let absoluteArgv0 = argv0 ?? PathUtils.join(container, "bin", "argv0");
  sandbox.stub(ShellService, "shellService").value({
    getArgv0: () => absoluteArgv0,
  });

  let targetPath;
  if (PathUtils.isAbsolute(targetName)) {
    targetPath = targetName;
    // assume it exists with reasonable permissions
  } else {
    targetPath = PathUtils.join(container, "bin", targetName);
    await IOUtils.writeUTF8(targetPath, "");
    await IOUtils.setPermissions(targetPath, 0o755);
  }

  await IOUtils.makeDirectory(PathUtils.join(container, "links"));

  try {
    await Promise.all(
      linkNames.map(async linkName => {
        let linkPath = PathUtils.join(container, "links", linkName);

        // There doesn't seem to be a nice way to create symlinks from JavaScript,
        // so call out to the command-line.
        await Subprocess.call({
          command: await Subprocess.pathSearch("ln", kOriginalEnvironment),
          arguments: ["-s", targetPath, linkPath],
          environment: kOriginalEnvironment,
        }).then(process => process.wait());
      })
    );

    gEnvironment = [["PATH", PathUtils.join(container, "links")]];

    await ShellService.createLinuxDesktopEntry(
      "checkpathlookup",
      "Exec Test",
      ["abc"],
      ""
    );
    let ini = await parseINI(desktopEntryPath);

    Assert.equal(
      ini.getString("Desktop Entry", "Exec"),
      `"${expected === kAbsoluteArgv0 ? absoluteArgv0 : expected}" "abc"`,
      "The expected command name was used."
    );
  } finally {
    sandbox.restore();

    gEnvironment = [["PATH", ""]];
    await IOUtils.remove(container, { recursive: true });
    await IOUtils.remove(desktopEntryPath, { ignoreAbsent: true });
  }
}

add_task(async function test_deletion() {
  let path = PathUtils.join(
    gTmpDir.path,
    "home",
    ".local",
    "share",
    "applications",
    "deletion.desktop"
  );
  await ShellService.createLinuxDesktopEntry(
    "deletion",
    "Deletion Test",
    [],
    ""
  );
  ok(await IOUtils.exists(path), "The desktop file was created");
  await ShellService.deleteLinuxDesktopEntry("deletion");
  ok(!(await IOUtils.exists(path)), "The desktop file was deleted");
});
