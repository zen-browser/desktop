/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

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

add_setup(async function () {
  let source = do_get_file("data/sessionstore_valid.js");
  source.copyTo(profd, "sessionstore.js");
  await writeCompressedFile(Paths.clean.replace("jsonlz4", "js"), Paths.clean);

  // Finish initialization of SessionFile
  await SessionFile.read();
});

function promise_check_exist(path, shouldExist) {
  return (async function () {
    info(
      "Ensuring that " + path + (shouldExist ? " exists" : " does not exist")
    );
    if ((await IOUtils.exists(path)) != shouldExist) {
      throw new Error(
        "File" + path + " should " + (shouldExist ? "exist" : "not exist")
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

function generateFileContents(id) {
  let url = `http://example.com/test_backup_once#${id}_${Math.random()}`;
  return { windows: [{ tabs: [{ entries: [{ url }], index: 1 }] }] };
}

// Write to the store, and check that it creates:
// - $Path.recovery with the new data
// - $Path.nextUpgradeBackup with the old data
add_task(async function test_first_write_backup() {
  let initial_content = generateFileContents("initial");
  let new_content = generateFileContents("test_1");

  info("Before the first write, none of the files should exist");
  await promise_check_exist(Paths.backups, false);

  await IOUtils.makeDirectory(Paths.backups);
  await IOUtils.writeJSON(Paths.clean, initial_content, {
    compress: true,
  });
  await SessionFile.write(new_content);

  info("After first write, a few files should have been created");
  await promise_check_exist(Paths.backups, true);
  await promise_check_exist(Paths.clean, false);
  await promise_check_exist(Paths.cleanBackup, true);
  await promise_check_exist(Paths.recovery, true);
  await promise_check_exist(Paths.recoveryBackup, false);
  await promise_check_exist(Paths.nextUpgradeBackup, true);

  await promise_check_contents(Paths.recovery, new_content);
  await promise_check_contents(Paths.nextUpgradeBackup, initial_content);
});

// Write to the store again, and check that
// - $Path.clean is not written
// - $Path.recovery contains the new data
// - $Path.recoveryBackup contains the previous data
add_task(async function test_second_write_no_backup() {
  let new_content = generateFileContents("test_2");
  let previous_backup_content = await IOUtils.readJSON(Paths.recovery, {
    decompress: true,
  });

  await IOUtils.remove(Paths.cleanBackup);

  await SessionFile.write(new_content);

  await promise_check_exist(Paths.backups, true);
  await promise_check_exist(Paths.clean, false);
  await promise_check_exist(Paths.cleanBackup, false);
  await promise_check_exist(Paths.recovery, true);
  await promise_check_exist(Paths.nextUpgradeBackup, true);

  await promise_check_contents(Paths.recovery, new_content);
  await promise_check_contents(Paths.recoveryBackup, previous_backup_content);
});

// Make sure that we create $Paths.clean and remove $Paths.recovery*
// upon shutdown
add_task(async function test_shutdown() {
  let output = generateFileContents("test_3");

  await IOUtils.writeUTF8(Paths.recovery, "I should disappear");
  await IOUtils.writeUTF8(Paths.recoveryBackup, "I should also disappear");

  await SessionWriter.write(output, {
    isFinalWrite: true,
    performShutdownCleanup: true,
  });

  Assert.ok(!(await IOUtils.exists(Paths.recovery)));
  Assert.ok(!(await IOUtils.exists(Paths.recoveryBackup)));
  await promise_check_contents(Paths.clean, output);
});
