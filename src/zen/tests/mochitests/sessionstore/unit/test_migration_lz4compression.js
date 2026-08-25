"use strict";

const { SessionWriter } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionWriter.sys.mjs"
);

// Make sure that we have a profile before initializing SessionFile.
const profd = do_get_profile();
const { SessionFile } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionFile.sys.mjs"
);
const Paths = SessionFile.Paths;

// We need a XULAppInfo to initialize SessionFile
const { updateAppInfo } = ChromeUtils.importESModule(
  "resource://testing-common/AppInfo.sys.mjs"
);
updateAppInfo({
  name: "SessionRestoreTest",
  ID: "{230de50e-4cd1-11dc-8314-0800200c9a66}",
  version: "1",
  platformVersion: "",
});

function promise_check_exist(path, shouldExist) {
  return (async function () {
    info(
      "Ensuring that " + path + (shouldExist ? " exists" : " does not exist")
    );
    if ((await IOUtils.exists(path)) != shouldExist) {
      throw new Error(
        "File " + path + " should " + (shouldExist ? "exist" : "not exist")
      );
    }
  })();
}

function promise_check_contents(path, expect) {
  return (async function () {
    info("Checking whether " + path + " has the right contents");
    let actual = await IOUtils.readJSON(path, {
      decompress: true,
    });
    Assert.deepEqual(
      actual,
      expect,
      `File ${path} contains the expected data.`
    );
  })();
}

// Check whether the migration from .js to .jslz4 is correct.
add_task(async function test_migration() {
  let source = do_get_file("data/sessionstore_valid.js");
  source.copyTo(profd, "sessionstore.js");

  // Read the content of the session store file.
  let parsed = await IOUtils.readJSON(Paths.clean.replace("jsonlz4", "js"));

  // Read the session file with .js extension.
  let result = await SessionFile.read();

  // Check whether the result is what we wanted.
  equal(result.origin, "clean");
  equal(result.useOldExtension, true);
  Assert.deepEqual(
    result.parsed,
    parsed,
    "result.parsed contains expected data"
  );

  // Initiate a write to ensure we write the compressed version.
  await SessionFile.write(parsed);
  await promise_check_exist(Paths.backups, true);
  await promise_check_exist(Paths.clean, false);
  await promise_check_exist(Paths.cleanBackup, true);
  await promise_check_exist(Paths.recovery, true);
  await promise_check_exist(Paths.recoveryBackup, false);
  await promise_check_exist(Paths.nextUpgradeBackup, true);
  // The deprecated $Path.clean should exist.
  await promise_check_exist(Paths.clean.replace("jsonlz4", "js"), true);

  await promise_check_contents(Paths.recovery, parsed);
});

add_task(async function test_startup_with_compressed_clean() {
  let state = { windows: [] };

  // Mare sure we have an empty profile dir.
  await SessionFile.wipe();

  // Populate session files to profile dir.
  await IOUtils.writeJSON(Paths.clean, state, {
    compress: true,
  });
  await IOUtils.makeDirectory(Paths.backups);
  await IOUtils.writeJSON(Paths.cleanBackup, state, {
    compress: true,
  });

  // Initiate a read.
  let result = await SessionFile.read();

  // Make sure we read correct session file and its content.
  equal(result.origin, "clean");
  equal(result.useOldExtension, false);
  Assert.deepEqual(
    state,
    result.parsed,
    "result.parsed contains expected data"
  );
});

add_task(async function test_empty_profile_dir() {
  // Make sure that we have empty profile dir.
  await SessionFile.wipe();
  await promise_check_exist(Paths.backups, false);
  await promise_check_exist(Paths.clean, false);
  await promise_check_exist(Paths.cleanBackup, false);
  await promise_check_exist(Paths.recovery, false);
  await promise_check_exist(Paths.recoveryBackup, false);
  await promise_check_exist(Paths.nextUpgradeBackup, false);
  await promise_check_exist(Paths.backups.replace("jsonlz4", "js"), false);
  await promise_check_exist(Paths.clean.replace("jsonlz4", "js"), false);
  await promise_check_exist(Paths.cleanBackup.replace("lz4", ""), false);
  await promise_check_exist(Paths.recovery.replace("jsonlz4", "js"), false);
  await promise_check_exist(
    Paths.recoveryBackup.replace("jsonlz4", "js"),
    false
  );
  await promise_check_exist(
    Paths.nextUpgradeBackup.replace("jsonlz4", "js"),
    false
  );

  // Initiate a read and make sure that we are in empty state.
  let result = await SessionFile.read();
  equal(result.origin, "empty");
  equal(result.noFilesFound, true);

  // Create a state to store.
  let state = { windows: [] };
  await SessionWriter.write(state, { isFinalWrite: true });

  // Check session files are created, but not deprecated ones.
  await promise_check_exist(Paths.clean, true);
  await promise_check_exist(Paths.clean.replace("jsonlz4", "js"), false);

  // Check session file' content is correct.
  await promise_check_contents(Paths.clean, state);
});
