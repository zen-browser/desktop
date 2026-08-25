/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/*
 * The primary purpose of this test is to ensure that
 * the sessionstore component records information about
 * corrupted backup files into a histogram.
 */

"use strict";

const Telemetry = Services.telemetry;
const HistogramId = "FX_SESSION_RESTORE_ALL_FILES_CORRUPT";

// Prepare the session file.
do_get_profile();
const { SessionFile } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionFile.sys.mjs"
);

/**
 * A utility function for resetting the histogram and the contents
 * of the backup directory. This will also compress the file using lz4 compression.
 */
function promise_reset_session(backups = {}) {
  return (async function () {
    // Reset the histogram.
    Telemetry.getHistogramById(HistogramId).clear();

    // Reset the contents of the backups directory
    await IOUtils.makeDirectory(SessionFile.Paths.backups);
    let basePath = do_get_cwd().path;
    for (let key of SessionFile.Paths.loadOrder) {
      if (backups.hasOwnProperty(key)) {
        let path = backups[key];
        const fullPath = PathUtils.join(basePath, ...path);
        let s = await IOUtils.read(fullPath);
        await IOUtils.write(SessionFile.Paths[key], s, {
          compress: true,
        });
      } else {
        await IOUtils.remove(SessionFile.Paths[key]);
      }
    }
  })();
}

/**
 * In order to use FX_SESSION_RESTORE_ALL_FILES_CORRUPT histogram
 * it has to be registered in "toolkit/components/telemetry/Histograms.json".
 * This test ensures that the histogram is registered and empty.
 */
add_task(async function test_ensure_histogram_exists_and_empty() {
  let s = Telemetry.getHistogramById(HistogramId).snapshot();
  Assert.equal(s.sum, 0, "Initially, the sum of probes is 0");
});

/**
 * Makes sure that the histogram is negatively updated when no
 * backup files are present.
 */
add_task(async function test_no_files_exist() {
  // No session files are available to SessionFile.
  await promise_reset_session();

  await SessionFile.read();
  // Checking if the histogram is updated negatively
  let h = Telemetry.getHistogramById(HistogramId);
  let s = h.snapshot();
  Assert.equal(s.values[0], 1, "One probe for the 'false' bucket.");
  Assert.equal(s.values[1], 0, "No probes in the 'true' bucket.");
});

/**
 * Makes sure that the histogram is negatively updated when at least one
 * backup file is not corrupted.
 */
add_task(async function test_one_file_valid() {
  // Corrupting some backup files.
  let invalidSession = ["data", "sessionstore_invalid.js"];
  let validSession = ["data", "sessionstore_valid.js"];
  await promise_reset_session({
    clean: invalidSession,
    cleanBackup: validSession,
    recovery: invalidSession,
    recoveryBackup: invalidSession,
  });

  await SessionFile.read();
  // Checking if the histogram is updated negatively.
  let h = Telemetry.getHistogramById(HistogramId);
  let s = h.snapshot();
  Assert.equal(s.values[0], 1, "One probe for the 'false' bucket.");
  Assert.equal(s.values[1], 0, "No probes in the 'true' bucket.");
});

/**
 * Makes sure that the histogram is positively updated when all
 * backup files are corrupted.
 */
add_task(async function test_all_files_corrupt() {
  // Corrupting all backup files.
  let invalidSession = ["data", "sessionstore_invalid.js"];
  await promise_reset_session({
    clean: invalidSession,
    cleanBackup: invalidSession,
    recovery: invalidSession,
    recoveryBackup: invalidSession,
  });

  await SessionFile.read();
  // Checking if the histogram is positively updated.
  let h = Telemetry.getHistogramById(HistogramId);
  let s = h.snapshot();
  Assert.equal(s.values[1], 1, "One probe for the 'true' bucket.");
  Assert.equal(s.values[0], 0, "No probes in the 'false' bucket.");
});
