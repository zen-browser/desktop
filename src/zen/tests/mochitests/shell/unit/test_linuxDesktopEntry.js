/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  FileTestUtils: "resource://testing-common/FileTestUtils.sys.mjs",
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
});

const gTmpDir = Services.dirsvc.get("TmpD", Ci.nsIFile);
gTmpDir.append("createLinuxDesktopEntry-" + Date.now());

const gBrowserExe = Services.dirsvc
  .get("XREExeF", Ci.nsIFile)
  .path // (keep this?) Windows path compat
  .replaceAll("\\", "\\\\");
// [the overarching issue here is that XREExeF can't seem to be intercepted,
// and therefore this test could break if characters in it need escaping. any
// way to fix?]

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
    `"${gBrowserExe}"`,
    "XREExeF will be run without any arguments"
  );
  Assert.equal(
    ini.getString("Desktop Entry", "Icon"),
    "open-menu-symbolic",
    "The icon is exactly the provided text"
  );
});

add_task(async function test_exec() {
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
    `"${gBrowserExe}" "abc" "\\$d\\$e\\$f" "gh\\\\i" "jk lm" "\\"nopq\\""`,
    "Arguments are escaped as expected"
  );
});

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
