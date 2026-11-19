// A collection with a dump that's packaged on all builds where this test runs,
// including on Android at mobile/android/installer/package-manifest.in
const TEST_BUCKET = "main";
const TEST_COLLECTION = "password-recipes";

let client;
let DUMP_RECORDS;
let DUMP_LAST_MODIFIED;

add_setup(async () => {
  // "services.settings.server" pref is not set.
  // Test defaults to an unreachable server,
  // and will only load from the dump if any.

  client = new RemoteSettingsClient(TEST_COLLECTION, {
    bucketName: TEST_BUCKET,
  });

  const dump = await SharedUtils.loadJSONDump(TEST_BUCKET, TEST_COLLECTION);
  DUMP_RECORDS = dump.data;
  DUMP_LAST_MODIFIED = dump.timestamp;

  // Dumps are fetched via the following, which sorts the records, newest first.
  // https://searchfox.org/mozilla-central/rev/5b3444ad300e244b5af4214212e22bd9e4b7088a/taskcluster/docker/periodic-updates/scripts/periodic_file_updates.sh#304
  equal(
    DUMP_LAST_MODIFIED,
    DUMP_RECORDS[0].last_modified,
    "records in dump ought to be sorted by last_modified"
  );
});

async function importData(records) {
  await RemoteSettingsWorker._execute("_test_only_import", [
    TEST_BUCKET,
    TEST_COLLECTION,
    records,
    records[0]?.last_modified || 0,
  ]);
}

async function clear_state() {
  await client.db.clear();
}

add_task(async function test_load_from_dump_when_offline() {
  // Baseline: verify that the collection is empty at first,
  // but non-empty after loading from the dump.
  const beforeTimestamp = await client.db.getLastModified();
  equal(beforeTimestamp, null, "collection empty when offline");

  // should import from dump since collection was not initialized.
  const after = await client.get();
  equal(after.length, DUMP_RECORDS.length, "collection loaded from dump");
  equal(await client.getLastModified(), DUMP_LAST_MODIFIED, "dump's timestamp");
});
add_task(clear_state);

add_task(async function test_optional_skip_dump_after_empty_import() {
  // clear_state should have wiped the database.
  const beforeTimestamp = await client.db.getLastModified();
  equal(beforeTimestamp, null, "collection empty after clearing");

  // Verify that the dump is not imported again by client.get()
  // when the database is initialized with an empty dump
  // with `loadDumpIfNewer` disabled.
  await importData([]); // <-- Empty set of records.

  const after = await client.get({ loadDumpIfNewer: false });
  equal(after.length, 0, "collection still empty due to import");
  equal(await client.getLastModified(), 0, "Empty dump has no timestamp");
});
add_task(clear_state);

add_task(async function test_optional_skip_dump_after_non_empty_import() {
  await importData([{ last_modified: 1234, id: "dummy" }]);

  const after = await client.get({ loadDumpIfNewer: false });
  equal(after.length, 1, "Imported dummy data");
  equal(await client.getLastModified(), 1234, "Expected timestamp of import");

  await importData([]);
  const after2 = await client.get({ loadDumpIfNewer: false });
  equal(after2.length, 0, "Previous data wiped on duplicate import");
  equal(await client.getLastModified(), 0, "Timestamp of empty collection");
});
add_task(clear_state);

add_task(async function test_load_dump_after_empty_import() {
  await importData([]); // <-- Empty set of records, i.e. last_modified = 0.

  const after = await client.get();
  equal(after.length, DUMP_RECORDS.length, "Imported dump");
  equal(await client.getLastModified(), DUMP_LAST_MODIFIED, "dump's timestamp");
});
add_task(clear_state);

add_task(async function test_load_dump_after_non_empty_import() {
  // Dump is updated regularly, verify that the dump matches our expectations
  // before running the test.
  Assert.greater(
    DUMP_LAST_MODIFIED,
    1234,
    "Assuming dump to be newer than dummy 1234"
  );

  await importData([{ last_modified: 1234, id: "dummy" }]);

  const after = await client.get();
  equal(after.length, DUMP_RECORDS.length, "Imported dump");
  equal(await client.getLastModified(), DUMP_LAST_MODIFIED, "dump's timestamp");
});
add_task(clear_state);

add_task(async function test_load_dump_after_import_from_broken_distro() {
  // Dump is updated regularly, verify that the dump matches our expectations
  // before running the test.
  Assert.greater(
    DUMP_LAST_MODIFIED,
    1234,
    "Assuming dump to be newer than dummy 1234"
  );

  // No last_modified time.
  await importData([{ id: "dummy" }]);

  const after = await client.get();
  equal(after.length, DUMP_RECORDS.length, "Imported dump");
  equal(await client.getLastModified(), DUMP_LAST_MODIFIED, "dump's timestamp");
});
add_task(clear_state);

add_task(async function test_skip_dump_if_same_last_modified() {
  await importData([{ last_modified: DUMP_LAST_MODIFIED, id: "dummy" }]);

  const after = await client.get();
  equal(after.length, 1, "Not importing dump when time matches");
  equal(await client.getLastModified(), DUMP_LAST_MODIFIED, "Same timestamp");
});
add_task(clear_state);
