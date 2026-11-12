/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

do_get_profile();

const { SessionFile } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionFile.sys.mjs"
);

const { FirefoxProfileMigrator } = ChromeUtils.importESModule(
  "moz-src:///browser/components/migration/FirefoxProfileMigrator.sys.mjs"
);

// MigrationUtils is a browser-window global (from browser.js), but xpcshell
// tests don't have a browser window so the explicit import is necessary.
// eslint-disable-next-line mozilla/no-redeclare-with-import-autofix
const { MigrationUtils } = ChromeUtils.importESModule(
  "moz-src:///browser/components/migration/MigrationUtils.sys.mjs"
);

const { updateAppInfo } = ChromeUtils.importESModule(
  "resource://testing-common/AppInfo.sys.mjs"
);
updateAppInfo({
  name: "SessionRestoreTest",
  ID: "{230de50e-4cd1-11dc-8314-0800200c9a66}",
  version: "1",
  platformVersion: "",
});

const ENCRYPTION_AVAILABLE_PREF = "browser.sessionstore.encryption.available";
const ENCRYPTION_PREF = "browser.sessionstore.encryption.enabled";
const DEK_NAME_SESSIONSTORE = "sessionstore";
// Header IOUtils writes in front of encrypted files.
const ENC_MAGIC = [0x6d, 0x6f, 0x7a, 0x45, 0x6e, 0x63, 0x30, 0x00];

async function readFileMagic(path) {
  let bytes = await IOUtils.read(path, { maxBytes: ENC_MAGIC.length });
  return Array.from(bytes);
}

function nsIFileFromPath(path) {
  let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(path);
  return file;
}

// Set up a source profile directory with a plaintext session file,
// sessionCheckpoints.json, and optionally a prefs.js.
async function makeSourceProfile(sourceDir, prefsContent) {
  await IOUtils.makeDirectory(sourceDir);
  let state = {
    windows: [{ tabs: [{ entries: [{ url: "https://example.com" }] }] }],
  };
  await IOUtils.writeUTF8(
    PathUtils.join(sourceDir, "sessionstore.jsonlz4"),
    JSON.stringify(state),
    { compress: true }
  );
  await IOUtils.writeJSON(
    PathUtils.join(sourceDir, "sessionCheckpoints.json"),
    { profile: true }
  );
  if (prefsContent) {
    await IOUtils.writeUTF8(
      PathUtils.join(sourceDir, "prefs.js"),
      prefsContent
    );
  }
}

async function runSessionMigration(sourceDir, destDir) {
  await IOUtils.makeDirectory(destDir);
  Services.env.set("MOZ_RESET_PROFILE_SESSION", "1");
  let migrator = new FirefoxProfileMigrator();
  let resources = migrator.getResourcesInternal(
    nsIFileFromPath(sourceDir),
    nsIFileFromPath(destDir)
  );
  let sessionResource = resources.find(
    r => r.type == MigrationUtils.resourceTypes.SESSION
  );
  Assert.ok(sessionResource, "SESSION resource was created");
  let succeeded = await new Promise(resolve => {
    sessionResource.migrate(resolve);
  });
  Assert.ok(succeeded, "migration callback reported success");
}

add_setup(async function () {
  Services.prefs
    .getDefaultBranch("")
    .setBoolPref(ENCRYPTION_AVAILABLE_PREF, true);
  Services.prefs.lockPref(ENCRYPTION_AVAILABLE_PREF);
  Services.prefs.getDefaultBranch("").setBoolPref(ENCRYPTION_PREF, true);
  registerCleanupFunction(() => {
    Services.prefs.unlockPref(ENCRYPTION_AVAILABLE_PREF);
    Services.prefs.clearUserPref(ENCRYPTION_AVAILABLE_PREF);
    Services.prefs.clearUserPref(ENCRYPTION_PREF);
    Services.prefs.getDefaultBranch("").deleteBranch(ENCRYPTION_PREF);
    Services.prefs.getDefaultBranch("").deleteBranch(ENCRYPTION_AVAILABLE_PREF);
  });

  await SessionFile.read();
});

// Lockstore key files from the source profile should be copied to the
// destination so SessionMigration can decrypt the session data.
add_task(async function test_copies_lockstore_keys() {
  let sourceDir = PathUtils.join(PathUtils.tempDir, "copy-keys-source");
  let destDir = PathUtils.join(PathUtils.tempDir, "copy-keys-dest");

  await makeSourceProfile(sourceDir);

  // Place lockstore key files in the source.
  await IOUtils.writeUTF8(
    PathUtils.join(sourceDir, "lockstore.keys.sqlite"),
    "fake-key-data"
  );
  await IOUtils.writeUTF8(
    PathUtils.join(sourceDir, "lockstore.keys.sqlite-wal"),
    "fake-wal-data"
  );

  await runSessionMigration(sourceDir, destDir);

  Assert.ok(
    await IOUtils.exists(PathUtils.join(destDir, "lockstore.keys.sqlite")),
    "lockstore.keys.sqlite was copied"
  );
  Assert.ok(
    await IOUtils.exists(PathUtils.join(destDir, "lockstore.keys.sqlite-wal")),
    "lockstore.keys.sqlite-wal was copied"
  );

  await IOUtils.remove(sourceDir, { recursive: true });
  await IOUtils.remove(destDir, { recursive: true });
});

// An encrypted source session is decrypted, converted and written back
// encrypted, with its history entries intact.
add_task(async function test_migrates_encrypted_session() {
  let sourceDir = PathUtils.join(PathUtils.tempDir, "enc-session-source");
  let destDir = PathUtils.join(PathUtils.tempDir, "enc-session-dest");

  await makeSourceProfile(sourceDir);

  let entries = [{ url: "https://example.com/encrypted", title: "Encrypted" }];
  await SessionFile.write({
    selectedWindow: 0,
    windows: [
      {
        selected: 1,
        tabs: [{ entries, index: 1, hidden: false, pinned: false }],
      },
    ],
  });
  let sourcePath = PathUtils.join(sourceDir, "sessionstore.jsonlz4");
  await IOUtils.copy(SessionFile.Paths.recovery, sourcePath);
  Assert.deepEqual(
    await readFileMagic(sourcePath),
    ENC_MAGIC,
    "source session file is encrypted"
  );

  await runSessionMigration(sourceDir, destDir);

  let destPath = PathUtils.join(destDir, "sessionstore.jsonlz4");
  Assert.deepEqual(
    await readFileMagic(destPath),
    ENC_MAGIC,
    "migrated session file is encrypted"
  );
  let migrated = await IOUtils.readJSON(destPath, {
    decompress: true,
    decrypt: DEK_NAME_SESSIONSTORE,
  });
  Assert.deepEqual(
    migrated.windows[0].tabs[0].formdata.id.sessionData.windows[0].tabs[0]
      .entries,
    entries,
    "migrated session keeps the original history entries"
  );

  await IOUtils.remove(sourceDir, { recursive: true });
  await IOUtils.remove(destDir, { recursive: true });
});

// The enabled pref is migrated from the source profile's prefs.js. The
// available pref is left to the destination build.
add_task(async function test_migrates_encryption_pref_true() {
  let sourceDir = PathUtils.join(PathUtils.tempDir, "pref-true-source");
  let destDir = PathUtils.join(PathUtils.tempDir, "pref-true-dest");

  await makeSourceProfile(
    sourceDir,
    'user_pref("browser.sessionstore.encryption.available", true);\n' +
      'user_pref("browser.sessionstore.encryption.enabled", true);\n'
  );
  await runSessionMigration(sourceDir, destDir);

  Assert.ok(
    !Services.prefs.prefHasUserValue(ENCRYPTION_AVAILABLE_PREF),
    "encryption available pref is not migrated"
  );
  Assert.equal(
    Services.prefs.getBoolPref(ENCRYPTION_PREF),
    true,
    "encryption pref migrated as true"
  );

  await IOUtils.remove(sourceDir, { recursive: true });
  await IOUtils.remove(destDir, { recursive: true });
});

add_task(async function test_migrates_encryption_pref_false() {
  let sourceDir = PathUtils.join(PathUtils.tempDir, "pref-false-source");
  let destDir = PathUtils.join(PathUtils.tempDir, "pref-false-dest");

  await makeSourceProfile(
    sourceDir,
    'user_pref("browser.sessionstore.encryption.available", false);\n' +
      'user_pref("browser.sessionstore.encryption.enabled", false);\n'
  );
  await runSessionMigration(sourceDir, destDir);

  Assert.ok(
    !Services.prefs.prefHasUserValue(ENCRYPTION_AVAILABLE_PREF),
    "encryption available pref is not migrated"
  );
  Assert.equal(
    Services.prefs.getBoolPref(ENCRYPTION_PREF),
    false,
    "encryption pref migrated as false"
  );

  await IOUtils.remove(sourceDir, { recursive: true });
  await IOUtils.remove(destDir, { recursive: true });
});
