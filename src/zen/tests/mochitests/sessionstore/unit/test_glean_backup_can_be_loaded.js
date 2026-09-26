/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/*
 * Ensures that exactly one backupCanBeLoadedSessionFile event is recorded for
 * each session file we attempt to load, and that the recorded outcome matches
 * the reason the file was accepted or rejected.
 */

"use strict";

do_get_profile();

const { SessionFile } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionFile.sys.mjs"
);

const VALID_SESSION = JSON.stringify({
  version: ["sessionrestore", 1],
  windows: [],
});

// A version the current SessionStore doesn't understand.
const INCOMPATIBLE_SESSION = JSON.stringify({
  version: ["sessionrestore", 999],
  windows: [],
});

const CORRUPT_SESSION = "{ this is not json";

/**
 * Writes the given session contents into the backup directory, removing any
 * file in the load order which wasn't supplied, and clears recorded metrics.
 *
 * @param {object} backups - Session file contents, keyed by load order key.
 */
async function promise_reset_session(backups = {}) {
  Services.fog.testResetFOG();

  await IOUtils.makeDirectory(SessionFile.Paths.backups);
  for (let key of SessionFile.Paths.loadOrder) {
    if (backups.hasOwnProperty(key)) {
      await IOUtils.writeUTF8(SessionFile.Paths[key], backups[key], {
        compress: true,
      });
    } else {
      await IOUtils.remove(SessionFile.Paths[key]);
    }
  }
}

function recordedOutcomes() {
  let events =
    Glean.sessionRestore.backupCanBeLoadedSessionFile.testGetValue() ?? [];
  return events.map(event => event.extra);
}

add_setup(function () {
  Services.fog.initializeFOG();
  // Keep the load order independent of whatever upgrade backup the profile
  // happens to have.
  Services.prefs.clearUserPref(
    "browser.sessionstore.upgradeBackup.latestBuildID"
  );
});

add_task(async function test_readable_file_recorded_once() {
  await promise_reset_session({ clean: VALID_SESSION });

  await SessionFile.read();

  Assert.deepEqual(
    recordedOutcomes(),
    [{ can_load: "true", path_key: "clean", loadfail_reason: "N/A" }],
    "A readable session file records a single can_load=true outcome."
  );
});

add_task(async function test_corrupt_file_recorded_once() {
  await promise_reset_session({
    clean: CORRUPT_SESSION,
    recovery: VALID_SESSION,
  });

  await SessionFile.read();

  let outcomes = recordedOutcomes();
  Assert.equal(outcomes.length, 2, "One outcome per file we tried to load.");
  Assert.equal(outcomes[0].path_key, "clean", "The corrupt file comes first.");
  Assert.equal(
    outcomes[0].can_load,
    "false",
    "The corrupt file can't be loaded."
  );
  Assert.ok(
    outcomes[0].loadfail_reason.includes("SyntaxError"),
    "The failure reason survives, rather than being overwritten with N/A."
  );
  Assert.deepEqual(
    outcomes[1],
    { can_load: "true", path_key: "recovery", loadfail_reason: "N/A" },
    "The file we fell back to records a single can_load=true outcome."
  );
});

add_task(async function test_incompatible_file_recorded_once() {
  await promise_reset_session({
    clean: INCOMPATIBLE_SESSION,
    recovery: VALID_SESSION,
  });

  await SessionFile.read();

  let outcomes = recordedOutcomes();
  Assert.equal(outcomes.length, 2, "One outcome per file we tried to load.");
  Assert.equal(
    outcomes[0].path_key,
    "clean",
    "The incompatible file comes first."
  );
  Assert.equal(
    outcomes[0].can_load,
    "false",
    "An incompatible file is never reported as loadable."
  );
  Assert.ok(
    outcomes[0].loadfail_reason.includes("Wrong format/version"),
    "The failure reason names the incompatible version."
  );
  Assert.equal(
    outcomes[1].can_load,
    "true",
    "The file we fell back to can be loaded."
  );
});

add_task(async function test_missing_files_recorded_once_each() {
  await promise_reset_session();

  await SessionFile.read();

  // With nothing to read, SessionFile.read() retries the whole load order
  // looking for files using the old, uncompressed extension.
  let outcomes = recordedOutcomes();
  let keys = SessionFile.Paths.loadOrder;
  Assert.equal(
    outcomes.length,
    keys.length * 2,
    "One outcome per file per read attempt."
  );
  Assert.ok(
    outcomes.every(
      outcome =>
        outcome.can_load == "false" &&
        outcome.loadfail_reason == "File doesn't exist."
    ),
    "Every outcome reports a missing file."
  );
  Assert.deepEqual(
    outcomes.slice(0, keys.length).map(outcome => outcome.path_key),
    keys,
    "The first read attempt covers each file in the load order once."
  );
});
