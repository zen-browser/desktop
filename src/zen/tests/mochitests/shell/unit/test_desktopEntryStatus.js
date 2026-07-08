/* Any copyright is dedicated to the Public Domain.
http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
});

const BAREBONES_DESKTOP_ENTRY = `[Desktop Entry]
Version=1.5
Type=Application
Name=test_desktopEntryStatus.js test case
`;

let gHomeDir;
let gSystemDir;

const filename = what => `test_desktopEntryStatus_file_${what}.desktop`;

// GLib caches results for efficiency. Unfortunately, it doesn't really provide
// a way to invalidate that cache, aside from hoping that the file monitor
// picks up on it. Resolve this by setting up all of the desktop entries at the
// start, then doing checks, then exiting.
//
// (Some others are special-cased, namely absent and Hidden= checks.)
const kDesktopEntries = [
  {
    label: "visible",
    content: BAREBONES_DESKTOP_ENTRY,
    expected: Ci.nsIGNOMEShellService.DESKTOP_ENTRY_VISIBLE,
  },
  {
    label: "nodisplay",
    content: BAREBONES_DESKTOP_ENTRY + "NoDisplay=true\n",
    expected: Ci.nsIGNOMEShellService.DESKTOP_ENTRY_INVISIBLE,
  },
  {
    label: "onlyshowin-matching",
    content: BAREBONES_DESKTOP_ENTRY + "OnlyShowIn=FirefoxOS\n",
    expected: Ci.nsIGNOMEShellService.DESKTOP_ENTRY_VISIBLE,
  },
  {
    label: "onlyshowin-notmatching",
    content: BAREBONES_DESKTOP_ENTRY + "OnlyShowIn=another\n",
    expected: Ci.nsIGNOMEShellService.DESKTOP_ENTRY_INVISIBLE,
  },
  {
    label: "notshowin-matching",
    content: BAREBONES_DESKTOP_ENTRY + "NotShowIn=FirefoxOS\n",
    expected: Ci.nsIGNOMEShellService.DESKTOP_ENTRY_INVISIBLE,
  },
  {
    label: "notshowin-notmatching",
    content: BAREBONES_DESKTOP_ENTRY + "NotShowIn=another\n",
    expected: Ci.nsIGNOMEShellService.DESKTOP_ENTRY_VISIBLE,
  },
];

add_setup(async function setup() {
  let unique = await IOUtils.createUniqueDirectory(
    Services.dirsvc.get("TmpD", Ci.nsIFile).path,
    "desktopEntryStatusTest"
  );

  let homeDir = PathUtils.join(unique, "data-home");
  Services.env.set("XDG_DATA_HOME", homeDir);
  gHomeDir = PathUtils.join(homeDir, "applications");
  await IOUtils.makeDirectory(gHomeDir, { createAncestors: true });

  let systemDir = PathUtils.join(unique, "data-system");
  Services.env.set("XDG_DATA_DIRS", systemDir);
  gSystemDir = PathUtils.join(systemDir, "applications");
  await IOUtils.makeDirectory(gSystemDir, { createAncestors: true });

  Services.env.set("XDG_CURRENT_DESKTOP", "FirefoxOS");

  await IOUtils.writeUTF8(
    PathUtils.join(gHomeDir, filename("deleted")),
    BAREBONES_DESKTOP_ENTRY + "Hidden=true\n"
  );
  await IOUtils.writeUTF8(
    PathUtils.join(gSystemDir, filename("deleted")),
    BAREBONES_DESKTOP_ENTRY
  );

  for (const desktopEntry of kDesktopEntries) {
    await IOUtils.writeUTF8(
      PathUtils.join(gHomeDir, filename(desktopEntry.label + "-home")),
      desktopEntry.content
    );
    await IOUtils.writeUTF8(
      PathUtils.join(gSystemDir, filename(desktopEntry.label + "-system")),
      desktopEntry.content
    );
  }

  registerCleanupFunction(async () => {
    return IOUtils.remove(unique, { recursive: true });
  });
});

add_task(function test_desktopEntryStatus() {
  Assert.equal(
    ShellService.getDesktopEntryStatus(filename("absent")),
    Ci.nsIGNOMEShellService.DESKTOP_ENTRY_ABSENT,
    "A desktop entry that doesn't exist should be absent."
  );
  Assert.equal(
    ShellService.getDesktopEntryStatus(filename("hidden")),
    Ci.nsIGNOMEShellService.DESKTOP_ENTRY_ABSENT,
    "A desktop entry shadowed by one with the Hidden= attribute should be absent."
  );

  for (const desktopEntry of kDesktopEntries) {
    Assert.equal(
      ShellService.getDesktopEntryStatus(
        filename(desktopEntry.label + "-home")
      ),
      desktopEntry.expected,
      "Desktop entry matches when at the local level: " + desktopEntry.label
    );
    Assert.equal(
      ShellService.getDesktopEntryStatus(
        filename(desktopEntry.label + "-system")
      ),
      desktopEntry.expected,
      "Desktop entry matches when at the system level: " + desktopEntry.label
    );
  }
});
