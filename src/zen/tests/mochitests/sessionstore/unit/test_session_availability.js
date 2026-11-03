/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/*
 * Ensures SessionFile.read() reports what it observed of each candidate file
 * while looking for one to load. The report describes the search rather than
 * the profile directory: files after the one that loaded are never examined,
 * and an upgrade backup that was never taken is distinct from one that has
 * gone missing.
 */

"use strict";

do_get_profile();

const { SessionFile } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionFile.sys.mjs"
);

const PREF_UPGRADE_BACKUP = "browser.sessionstore.upgradeBackup.latestBuildID";

const VALID_SESSION = JSON.stringify({
  version: ["sessionrestore", 1],
  windows: [],
});

const CORRUPT_SESSION = "{ this is not json";

const ALL_KEYS = [
  "clean",
  "recovery",
  "recoveryBackup",
  "cleanBackup",
  "upgradeBackup",
];

/**
 * The path SessionFile reads from when it falls back to the deprecated
 * uncompressed file format.
 *
 * @param {string} path - A path from SessionFile.Paths.
 * @returns {string} The same path with the legacy extension.
 */
function legacyPath(path) {
  return path.replace("jsonlz4", "js").replace("baklz4", "bak");
}

/**
 * Empties the profile of session files and writes the ones supplied.
 *
 * @param {object} options
 * @param {object} options.compressed - Session contents, keyed by load order
 *   key, written in the current jsonlz4 format.
 * @param {object} options.legacy - Session contents, keyed by load order key,
 *   written to the deprecated uncompressed paths.
 * @param {string} options.upgradeBackupId - Build ID to record as the latest
 *   upgrade backup, which is what puts "upgradeBackup" in the load order. Left
 *   unset, no upgrade backup was ever taken.
 */
async function promise_reset_session({
  compressed = {},
  legacy = {},
  upgradeBackupId = null,
} = {}) {
  await IOUtils.remove(SessionFile.Paths.backups, {
    recursive: true,
    ignoreAbsent: true,
  });
  await IOUtils.remove(SessionFile.Paths.clean, { ignoreAbsent: true });
  await IOUtils.remove(legacyPath(SessionFile.Paths.clean), {
    ignoreAbsent: true,
  });
  await IOUtils.makeDirectory(SessionFile.Paths.backups);

  if (upgradeBackupId) {
    Services.prefs.setCharPref(PREF_UPGRADE_BACKUP, upgradeBackupId);
  } else {
    Services.prefs.clearUserPref(PREF_UPGRADE_BACKUP);
  }

  for (let [key, contents] of Object.entries(compressed)) {
    await IOUtils.writeUTF8(SessionFile.Paths[key], contents, {
      compress: true,
    });
  }
  for (let [key, contents] of Object.entries(legacy)) {
    await IOUtils.writeUTF8(legacyPath(SessionFile.Paths[key]), contents);
  }
}

/**
 * @param {object} states - Expected states, keyed by load order key. Any key
 *   not supplied is expected to be "absent".
 * @returns {object} A full set of expected file states.
 */
function expectStates(states) {
  return Object.fromEntries(
    ALL_KEYS.map(key => [key, states[key] ?? "absent"])
  );
}

add_task(async function test_no_session_files() {
  await promise_reset_session();

  let result = await SessionFile.read();

  Assert.equal(result.origin, "empty", "No session could be loaded.");
  Assert.ok(result.noFilesFound, "Nothing was found to restore from.");
  Assert.deepEqual(
    result.fileStates,
    expectStates({ upgradeBackup: "not_configured" }),
    "Every candidate was looked for and found missing."
  );
});

add_task(async function test_first_file_loads() {
  await promise_reset_session({ compressed: { clean: VALID_SESSION } });

  let result = await SessionFile.read();

  Assert.equal(result.origin, "clean", "The clean file was loaded.");
  Assert.ok(!result.noFilesFound, "A session file was found.");
  Assert.deepEqual(
    result.fileStates,
    expectStates({
      clean: "present",
      recovery: "not_examined",
      recoveryBackup: "not_examined",
      cleanBackup: "not_examined",
      upgradeBackup: "not_configured",
    }),
    "Once a file loads, the rest of the load order is never examined."
  );
});

add_task(async function test_fallback_stops_at_first_loadable_file() {
  await promise_reset_session({
    compressed: { clean: CORRUPT_SESSION, recovery: VALID_SESSION },
  });

  let result = await SessionFile.read();

  Assert.equal(result.origin, "recovery", "We fell back to the recovery file.");
  Assert.ok(!result.noFilesFound, "A session file was found.");
  Assert.deepEqual(
    result.fileStates,
    expectStates({
      clean: "present",
      recovery: "present",
      recoveryBackup: "not_examined",
      cleanBackup: "not_examined",
      upgradeBackup: "not_configured",
    }),
    "A corrupt file counts as present, and the search stops after recovery."
  );
});

add_task(async function test_present_but_unloadable_files() {
  await promise_reset_session({
    compressed: {
      clean: CORRUPT_SESSION,
      recovery: CORRUPT_SESSION,
      recoveryBackup: CORRUPT_SESSION,
      cleanBackup: CORRUPT_SESSION,
    },
  });

  let result = await SessionFile.read();

  Assert.equal(result.origin, "empty", "No session could be loaded.");
  Assert.ok(
    !result.noFilesFound,
    "Files were found, even though none could be loaded."
  );
  Assert.deepEqual(
    result.fileStates,
    expectStates({
      clean: "present",
      recovery: "present",
      recoveryBackup: "present",
      cleanBackup: "present",
      upgradeBackup: "not_configured",
    }),
    "Every candidate was examined, and being unreadable doesn't make a file absent."
  );
});

add_task(async function test_upgrade_backup_present() {
  await promise_reset_session({
    upgradeBackupId: "20260101000000",
    compressed: { upgradeBackup: VALID_SESSION },
  });

  let result = await SessionFile.read();

  Assert.equal(
    result.origin,
    "upgradeBackup",
    "We fell back to the upgrade backup."
  );
  Assert.deepEqual(
    result.fileStates,
    expectStates({ upgradeBackup: "present" }),
    "An upgrade backup that exists is reported as present."
  );
});

add_task(async function test_upgrade_backup_missing() {
  await promise_reset_session({ upgradeBackupId: "20260101000000" });

  let result = await SessionFile.read();

  Assert.equal(result.origin, "empty", "No session could be loaded.");
  Assert.deepEqual(
    result.fileStates,
    expectStates({}),
    "An upgrade backup that was taken but has gone missing reads as absent, not as never taken."
  );
});

add_task(async function test_legacy_format_session() {
  await promise_reset_session({ legacy: { clean: VALID_SESSION } });

  let result = await SessionFile.read();

  Assert.equal(result.origin, "clean", "The legacy clean file was loaded.");
  Assert.ok(
    result.useOldExtension,
    "The session was loaded from the deprecated file format."
  );
  Assert.ok(!result.noFilesFound, "A session file was found.");
  Assert.deepEqual(
    result.fileStates,
    expectStates({
      clean: "present",
      upgradeBackup: "not_configured",
    }),
    "A file found only in the legacy format is still reported as present."
  );
});
