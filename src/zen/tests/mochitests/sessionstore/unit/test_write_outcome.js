/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/*
 * Ensures SessionFile.write() counts every write outcome, and records a
 * write_failure event identifying the failed step only when a write fails
 * differently from the previous one, or when the final write fails.
 * Failures are caused by putting files where the writer expects directories.
 */

"use strict";

do_get_profile();

const { SessionFile } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionFile.sys.mjs"
);
const { RunState } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/RunState.sys.mjs"
);
const Paths = SessionFile.Paths;

const STATE = { windows: [] };

function getOutcomes() {
  return {
    attempts: Glean.sessionRestore.writeAttempts.testGetValue() ?? 0,
    success: Glean.sessionRestore.writeOutcome.success.testGetValue() ?? 0,
    failed: Glean.sessionRestore.writeOutcome.failed.testGetValue() ?? 0,
    backupFailed:
      Glean.sessionRestore.writeOutcome.session_written_backup_failed.testGetValue() ??
      0,
  };
}

function getFailureEvents() {
  return (Glean.sessionRestore.writeFailure.testGetValue() ?? []).map(
    e => e.extra
  );
}

function assertFailureEvent(extra, expected) {
  for (let [key, value] of Object.entries(expected)) {
    Assert.equal(extra[key], value, `write_failure has ${key}=${value}`);
  }
  Assert.stringMatches(
    extra.cause,
    /^NS_ERROR_[A-Z0-9_]+$/,
    "cause is the nsresult reported by IOUtils"
  );
}

/**
 * Lists the session files and directories in the profile, including legacy
 * ones and the backups directory.
 *
 * @returns {Promise<string[]>}
 */
async function getSessionEntries() {
  let children = await IOUtils.getChildren(PathUtils.profileDir);
  return children.filter(path =>
    PathUtils.filename(path).startsWith("sessionstore")
  );
}

/**
 * Removes all session files, reads the session so that later writes start
 * from the corresponding writer state, and resets telemetry.
 *
 * @param {object} [options]
 * @param {boolean} [options.withCleanFile] Whether to start from a clean
 *   session file rather than from "empty".
 */
async function resetSession({ withCleanFile = false } = {}) {
  await SessionFile.wipe();
  if (withCleanFile) {
    await IOUtils.writeJSON(Paths.clean, STATE, { compress: true });
  }
  await SessionFile.read();
  Services.fog.testResetFOG();
}

/**
 * Puts a plain file where the backups directory should be, so writes fail
 * until it is removed.
 */
async function breakBackupsDir() {
  await IOUtils.remove(Paths.backups, { recursive: true, ignoreAbsent: true });
  await IOUtils.writeUTF8(Paths.backups, "not a directory");
}

add_setup(async function () {
  Services.fog.initializeFOG();

  // Put the profile's session files back as we found them, whatever the
  // tasks leave behind.
  let savedDir = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "test_write_outcome"
  );
  for (let path of await getSessionEntries()) {
    await IOUtils.copy(
      path,
      PathUtils.join(savedDir, PathUtils.filename(path)),
      {
        recursive: true,
      }
    );
  }
  registerCleanupFunction(async () => {
    for (let path of await getSessionEntries()) {
      await IOUtils.remove(path, { recursive: true });
    }
    for (let path of await IOUtils.getChildren(savedDir)) {
      await IOUtils.copy(
        path,
        PathUtils.join(PathUtils.profileDir, PathUtils.filename(path)),
        { recursive: true }
      );
    }
    await IOUtils.remove(savedDir, { recursive: true });
  });

  await SessionFile.read();
});

add_task(async function test_success() {
  await resetSession();

  await SessionFile.write(STATE);

  Assert.deepEqual(
    getOutcomes(),
    { attempts: 1, success: 1, failed: 0, backupFailed: 0 },
    "a successful write is counted"
  );
  Assert.greater(
    Glean.sessionRestore.fileSizeBytes.testGetValue().count,
    0,
    "file_size_bytes is recorded on success"
  );
  Assert.deepEqual(getFailureEvents(), [], "no write_failure is recorded");
});

add_task(async function test_repeated_failures_recorded_once() {
  await resetSession();
  await breakBackupsDir();

  // Starting from "empty", the first write fails to create the backups
  // directory. The writer then assumes it exists, so later writes fail to
  // write the recovery file inside it.
  await SessionFile.write(STATE);
  await SessionFile.write(STATE);
  await SessionFile.write(STATE);

  Assert.deepEqual(
    getOutcomes(),
    { attempts: 3, success: 0, failed: 3, backupFailed: 0 },
    "every failed write is counted"
  );
  let events = getFailureEvents();
  Assert.equal(events.length, 2, "the repeated failure is recorded once");
  assertFailureEvent(events[0], {
    step: "make_backups_dir",
    session_written: "false",
    is_final_write: "false",
  });
  assertFailureEvent(events[1], {
    step: "write_recovery",
    session_written: "false",
    is_final_write: "false",
  });
});

add_task(async function test_failure_after_success_recorded_again() {
  await resetSession();
  await SessionFile.write(STATE);

  await breakBackupsDir();
  await SessionFile.write(STATE);

  Assert.deepEqual(
    getOutcomes(),
    { attempts: 2, success: 1, failed: 1, backupFailed: 0 },
    "the success and the failure are counted"
  );
  let events = getFailureEvents();
  Assert.equal(
    events.length,
    1,
    "the same failure is recorded again after a success"
  );
  assertFailureEvent(events[0], {
    step: "write_recovery",
  });
});

add_task(async function test_backup_failure_after_session_written() {
  await resetSession({ withCleanFile: true });

  // The upgrade backup is copied into a directory at its path, where a
  // non-empty directory with the name of the copied file blocks it.
  await IOUtils.makeDirectory(
    PathUtils.join(
      Paths.nextUpgradeBackup,
      PathUtils.filename(Paths.cleanBackup),
      "blocker"
    )
  );

  await SessionFile.write(STATE);

  Assert.deepEqual(
    getOutcomes(),
    { attempts: 1, success: 0, failed: 0, backupFailed: 1 },
    "the write is counted as a backup failure"
  );
  Assert.ok(
    await IOUtils.exists(Paths.recovery),
    "the session was still written"
  );
  let events = getFailureEvents();
  Assert.equal(events.length, 1, "the failure is recorded");
  Assert.equal(events[0].step, "copy_upgrade_backup");
  Assert.equal(events[0].session_written, "true");
});

// Must run last, as no writes are accepted after the final write.
add_task(async function test_final_write_failure_always_recorded() {
  await resetSession();
  await breakBackupsDir();
  await SessionFile.write(STATE);

  // Start from "empty" again so the final write fails at the same step.
  await resetSession();
  await breakBackupsDir();

  RunState.setRunning();
  RunState.setQuitting();
  RunState.setClosing();
  await SessionFile.write(STATE);

  let events = getFailureEvents();
  Assert.equal(
    events.length,
    1,
    "the final write failure is recorded despite matching the previous one"
  );
  assertFailureEvent(events[0], {
    step: "make_backups_dir",
    is_final_write: "true",
  });
});
