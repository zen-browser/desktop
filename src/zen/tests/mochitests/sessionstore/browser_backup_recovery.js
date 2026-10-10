/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// This tests are for a sessionstore.js atomic backup.
// Each test will wait for a write to the Session Store
// before executing.

const PREF_SS_INTERVAL = "browser.sessionstore.interval";
const Paths = SessionFile.Paths;

// Global variables that contain sessionstore.jsonlz4 and sessionstore.baklz4 data for
// comparison between tests.
var gSSData;
var gSSBakData;

function promiseRead(path) {
  return IOUtils.readUTF8(path, { decompress: true });
}

async function reInitSessionFile() {
  await SessionFile.wipe();
  await SessionFile.read();
}

add_setup(async function () {
  // Make sure that we are not racing with SessionSaver's time based
  // saves.
  Services.prefs.setIntPref(PREF_SS_INTERVAL, 10000000);
  registerCleanupFunction(() => Services.prefs.clearUserPref(PREF_SS_INTERVAL));
});

add_task(async function test_creation() {
  // Cancel all pending session saves so they won't get in our way.
  SessionSaver.cancel();

  // Create dummy sessionstore backups
  let OLD_BACKUP = PathUtils.join(PathUtils.profileDir, "sessionstore.baklz4");
  let OLD_UPGRADE_BACKUP = PathUtils.join(
    PathUtils.profileDir,
    "sessionstore.baklz4-0000000"
  );

  await IOUtils.writeUTF8(OLD_BACKUP, "sessionstore.bak");
  await IOUtils.writeUTF8(OLD_UPGRADE_BACKUP, "sessionstore upgrade backup");

  await reInitSessionFile();

  // Ensure none of the sessionstore files and backups exists
  for (let k of Paths.loadOrder) {
    ok(
      !(await IOUtils.exists(Paths[k])),
      "After wipe " + k + " sessionstore file doesn't exist"
    );
  }
  ok(
    !(await IOUtils.exists(OLD_BACKUP)),
    "After wipe, old backup doesn't exist"
  );
  ok(
    !(await IOUtils.exists(OLD_UPGRADE_BACKUP)),
    "After wipe, old upgrade backup doesn't exist"
  );

  // Open a new tab, save session, ensure that the correct files exist.
  let URL_BASE =
    "http://example.com/?atomic_backup_test_creation=" + Math.random();
  let URL = URL_BASE + "?first_write";
  let tab = BrowserTestUtils.addTab(gBrowser, URL);

  info("Testing situation after a single write");
  await promiseBrowserLoaded(tab.linkedBrowser);
  await TabStateFlusher.flush(tab.linkedBrowser);
  await SessionSaver.run();

  ok(
    await IOUtils.exists(Paths.recovery),
    "After write, recovery sessionstore file exists again"
  );
  ok(
    !(await IOUtils.exists(Paths.recoveryBackup)),
    "After write, recoveryBackup sessionstore doesn't exist"
  );
  ok(
    (await promiseRead(Paths.recovery)).includes(URL),
    "Recovery sessionstore file contains the required tab"
  );
  ok(
    !(await IOUtils.exists(Paths.clean)),
    "After first write, clean shutdown " +
      "sessionstore doesn't exist, since we haven't shutdown yet"
  );

  // Open a second tab, save session, ensure that the correct files exist.
  info("Testing situation after a second write");
  let URL2 = URL_BASE + "?second_write";
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, URL2);
  await promiseBrowserLoaded(tab.linkedBrowser);
  await TabStateFlusher.flush(tab.linkedBrowser);
  await SessionSaver.run();

  ok(
    await IOUtils.exists(Paths.recovery),
    "After second write, recovery sessionstore file still exists"
  );
  ok(
    (await promiseRead(Paths.recovery)).includes(URL2),
    "Recovery sessionstore file contains the latest url"
  );
  ok(
    await IOUtils.exists(Paths.recoveryBackup),
    "After write, recoveryBackup sessionstore now exists"
  );
  let backup = await promiseRead(Paths.recoveryBackup);
  ok(!backup.includes(URL2), "Recovery backup doesn't contain the latest url");
  ok(backup.includes(URL), "Recovery backup contains the original url");
  ok(
    !(await IOUtils.exists(Paths.clean)),
    "After first write, clean shutdown " +
      "sessionstore doesn't exist, since we haven't shutdown yet"
  );

  info("Reinitialize, ensure that we haven't leaked sensitive files");
  await SessionFile.read(); // Reinitializes SessionFile
  await SessionSaver.run();
  ok(
    !(await IOUtils.exists(Paths.clean)),
    "After second write, clean shutdown " +
      "sessionstore doesn't exist, since we haven't shutdown yet"
  );
  Assert.strictEqual(
    Paths.upgradeBackup,
    "",
    "After second write, clean " +
      "shutdown sessionstore doesn't exist, since we haven't shutdown yet"
  );
  ok(
    !(await IOUtils.exists(Paths.nextUpgradeBackup)),
    "After second write, clean " +
      "shutdown sessionstore doesn't exist, since we haven't shutdown yet"
  );

  gBrowser.removeTab(tab);
});

var promiseSource = async function (name) {
  let URL =
    "http://example.com/?atomic_backup_test_recovery=" +
    Math.random() +
    "&name=" +
    name;
  let tab = BrowserTestUtils.addTab(gBrowser, URL);

  await promiseBrowserLoaded(tab.linkedBrowser);
  await TabStateFlusher.flush(tab.linkedBrowser);
  await SessionSaver.run();
  gBrowser.removeTab(tab);

  let SOURCE = await promiseRead(Paths.recovery);
  await SessionFile.wipe();
  return SOURCE;
};

add_task(async function test_recovery() {
  await reInitSessionFile();
  info("Attempting to recover from the recovery file");

  // Create Paths.recovery, ensure that we can recover from it.
  let SOURCE = await promiseSource("Paths.recovery");
  await IOUtils.makeDirectory(Paths.backups);
  await IOUtils.writeUTF8(Paths.recovery, SOURCE, { compress: true });
  is(
    (await SessionFile.read()).source,
    SOURCE,
    "Recovered the correct source from the recovery file"
  );

  info("Corrupting recovery file, attempting to recover from recovery backup");
  SOURCE = await promiseSource("Paths.recoveryBackup");
  await IOUtils.makeDirectory(Paths.backups);
  await IOUtils.writeUTF8(Paths.recoveryBackup, SOURCE, { compress: true });
  await IOUtils.writeUTF8(Paths.recovery, "<Invalid JSON>", { compress: true });
  is(
    (await SessionFile.read()).source,
    SOURCE,
    "Recovered the correct source from the recovery file"
  );
});

add_task(async function test_recovery_inaccessible() {
  // Can't do chmod() on non-UNIX platforms, we need that for this test.
  if (AppConstants.platform != "macosx" && AppConstants.platform != "linux") {
    return;
  }

  await reInitSessionFile();
  info(
    "Making recovery file inaccessible, attempting to recover from recovery backup"
  );
  let SOURCE_RECOVERY = await promiseSource("Paths.recovery");
  let SOURCE = await promiseSource("Paths.recoveryBackup");
  await IOUtils.makeDirectory(Paths.backups);
  await IOUtils.writeUTF8(Paths.recoveryBackup, SOURCE, { compress: true });

  // Write a valid recovery file but make it inaccessible.
  await IOUtils.writeUTF8(Paths.recovery, SOURCE_RECOVERY, { compress: true });
  await IOUtils.setPermissions(Paths.recovery, 0);

  is(
    (await SessionFile.read()).source,
    SOURCE,
    "Recovered the correct source from the recovery file"
  );
  await IOUtils.setPermissions(Paths.recovery, 0o644);
});

add_task(async function test_clean() {
  await reInitSessionFile();
  let SOURCE = await promiseSource("Paths.clean");
  await IOUtils.writeUTF8(Paths.clean, SOURCE, { compress: true });
  await SessionFile.read();
  await SessionSaver.run();
  is(
    await promiseRead(Paths.cleanBackup),
    SOURCE,
    "After first read/write, " +
      "clean shutdown file has been moved to cleanBackup"
  );
});

/**
 * Tests loading of sessionstore when format version is known.
 */
add_task(async function test_version() {
  info("Preparing sessionstore");
  let SOURCE = await promiseSource("Paths.clean");

  // Check there's a format version number
  is(
    JSON.parse(SOURCE).version[0],
    "sessionrestore",
    "Found sessionstore format version"
  );

  // Create Paths.clean file
  await IOUtils.makeDirectory(Paths.backups);
  await IOUtils.writeUTF8(Paths.clean, SOURCE, { compress: true });

  info("Attempting to recover from the clean file");
  // Ensure that we can recover from Paths.recovery
  is(
    (await SessionFile.read()).source,
    SOURCE,
    "Recovered the correct source from the clean file"
  );
});

/**
 * Tests fallback to previous backups if format version is unknown.
 */
add_task(async function test_version_fallback() {
  await reInitSessionFile();
  info("Preparing data, making sure that it has a version number");
  let SOURCE = await promiseSource("Paths.clean");
  let BACKUP_SOURCE = await promiseSource("Paths.cleanBackup");

  is(
    JSON.parse(SOURCE).version[0],
    "sessionrestore",
    "Found sessionstore format version"
  );
  is(
    JSON.parse(BACKUP_SOURCE).version[0],
    "sessionrestore",
    "Found backup sessionstore format version"
  );

  await IOUtils.makeDirectory(Paths.backups);

  info(
    "Modifying format version number to something incorrect, to make sure that we disregard the file."
  );
  let parsedSource = JSON.parse(SOURCE);
  parsedSource.version[0] = "bookmarks";
  await IOUtils.writeJSON(Paths.clean, parsedSource, { compress: true });
  await IOUtils.writeUTF8(Paths.cleanBackup, BACKUP_SOURCE, { compress: true });
  is(
    (await SessionFile.read()).source,
    BACKUP_SOURCE,
    "Recovered the correct source from the backup recovery file"
  );

  info(
    "Modifying format version number to a future version, to make sure that we disregard the file."
  );
  parsedSource = JSON.parse(SOURCE);
  parsedSource.version[1] = Number.MAX_SAFE_INTEGER;
  await IOUtils.writeJSON(Paths.clean, parsedSource, { compress: true });
  await IOUtils.writeUTF8(Paths.cleanBackup, BACKUP_SOURCE, { compress: true });
  is(
    (await SessionFile.read()).source,
    BACKUP_SOURCE,
    "Recovered the correct source from the backup recovery file"
  );
});

add_task(async function cleanup() {
  await reInitSessionFile();
});
