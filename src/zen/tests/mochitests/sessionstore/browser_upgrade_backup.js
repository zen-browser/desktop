/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const Paths = SessionFile.Paths;
const PREF_UPGRADE = "browser.sessionstore.upgradeBackup.latestBuildID";
const PREF_MAX_UPGRADE_BACKUPS =
  "browser.sessionstore.upgradeBackup.maxUpgradeBackups";

/**
 * Prepares tests by retrieving the current platform's build ID, clearing the
 * build where the last backup was created and creating arbitrary JSON data
 * for a new backup.
 */
function prepareTest() {
  let result = {};

  result.buildID = Services.appinfo.platformBuildID;
  Services.prefs.setCharPref(PREF_UPGRADE, "");
  result.contents = {
    "browser_upgrade_backup.js": Math.random(),
  };

  return result;
}

/**
 * Retrieves all upgrade backups and returns them in an array.
 */
async function getUpgradeBackups() {
  let children = await IOUtils.getChildren(Paths.backups);

  return children.filter(path => path.startsWith(Paths.upgradeBackupPrefix));
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["test.wait300msAfterTabSwitch", true]],
  });

  // Wait until initialization is complete
  await SessionStore.promiseInitialized;
});

add_task(async function test_upgrade_backup() {
  let test = prepareTest();
  info("Let's check if we create an upgrade backup");
  await SessionFile.wipe();
  await IOUtils.writeJSON(Paths.clean, test.contents, {
    compress: true,
  });
  info("Call `SessionFile.read()` to set state to 'clean'");
  await SessionFile.read();
  await SessionFile.write(""); // First call to write() triggers the backup

  Assert.equal(
    Services.prefs.getCharPref(PREF_UPGRADE),
    test.buildID,
    "upgrade backup should be set"
  );

  Assert.ok(
    await IOUtils.exists(Paths.upgradeBackup),
    "upgrade backup file has been created"
  );

  let data = await IOUtils.readJSON(Paths.upgradeBackup, { decompress: true });
  Assert.deepEqual(
    test.contents,
    data,
    "upgrade backup contains the expected contents"
  );

  info("Let's check that we don't overwrite this upgrade backup");
  let newContents = {
    "something else entirely": Math.random(),
  };
  await IOUtils.writeJSON(Paths.clean, newContents, {
    compress: true,
  });
  await SessionFile.write(""); // Next call to write() shouldn't trigger the backup
  data = await IOUtils.readJSON(Paths.upgradeBackup, { decompress: true });
  Assert.deepEqual(test.contents, data, "upgrade backup hasn't changed");
});

add_task(async function test_upgrade_backup_removal() {
  let test = prepareTest();
  let maxUpgradeBackups = Services.prefs.getIntPref(
    PREF_MAX_UPGRADE_BACKUPS,
    3
  );
  info("Let's see if we remove backups if there are too many");
  await SessionFile.wipe();
  await IOUtils.writeJSON(Paths.clean, test.contents, {
    compress: true,
  });
  info("Call `SessionFile.read()` to set state to 'clean'");
  await SessionFile.read();

  // create dummy backups
  await IOUtils.writeUTF8(Paths.upgradeBackupPrefix + "20080101010101", "", {
    compress: true,
  });
  await IOUtils.writeUTF8(Paths.upgradeBackupPrefix + "20090101010101", "", {
    compress: true,
  });
  await IOUtils.writeUTF8(Paths.upgradeBackupPrefix + "20100101010101", "", {
    compress: true,
  });
  await IOUtils.writeUTF8(Paths.upgradeBackupPrefix + "20110101010101", "", {
    compress: true,
  });
  await IOUtils.writeUTF8(Paths.upgradeBackupPrefix + "20120101010101", "", {
    compress: true,
  });
  await IOUtils.writeUTF8(Paths.upgradeBackupPrefix + "20130101010101", "", {
    compress: true,
  });

  // get currently existing backups
  let backups = await getUpgradeBackups();

  info("Write the session to disk and perform a backup");
  await SessionFile.write(""); // First call to write() triggers the backup and the cleanup

  // a new backup should have been created (and still exist)
  is(
    Services.prefs.getCharPref(PREF_UPGRADE),
    test.buildID,
    "upgrade backup should be set"
  );
  Assert.ok(
    await IOUtils.exists(Paths.upgradeBackup),
    "upgrade backup file has been created"
  );

  // get currently existing backups and check their count
  let newBackups = await getUpgradeBackups();
  is(
    newBackups.length,
    maxUpgradeBackups,
    "expected number of backups are present after removing old backups"
  );

  // find all backups that were created during the last call to `SessionFile.write("");`
  // ie, filter out all the backups that have already been present before the call
  newBackups = newBackups.filter(function (backup) {
    return !backups.includes(backup);
  });

  // check that exactly one new backup was created
  is(newBackups.length, 1, "one new backup was created that was not removed");

  await SessionFile.write(""); // Second call to write() should not trigger anything

  backups = await getUpgradeBackups();
  is(
    backups.length,
    maxUpgradeBackups,
    "second call to SessionFile.write() didn't create or remove more backups"
  );
});
