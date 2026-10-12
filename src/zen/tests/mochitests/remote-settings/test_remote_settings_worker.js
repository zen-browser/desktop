add_task(async function test_canonicaljson() {
  const records = [
    { id: "1", title: "title 1" },
    { id: "2", title: "title 2" },
  ];
  const timestamp = 42;

  const serialized = await RemoteSettingsWorker.canonicalStringify(
    records,
    timestamp
  );

  Assert.equal(
    serialized,
    '{"data":[{"id":"1","title":"title 1"},{"id":"2","title":"title 2"}],"last_modified":"42"}'
  );
});

add_task(async function test_import_json_dump_into_idb() {
  if (IS_ANDROID) {
    // Skip test: we don't ship remote settings dumps on Android (see package-manifest).
    return;
  }
  const client = new RemoteSettingsClient("language-dictionaries");
  const before = await client.db.getLastModified();
  Assert.equal(before, null);

  await RemoteSettingsWorker.importJSONDump("main", "language-dictionaries");

  const after = await client.get({ syncIfEmpty: false });
  Assert.ok(!!after.length);
  let lastModifiedStamp = await client.getLastModified();

  Assert.equal(
    lastModifiedStamp,
    Math.max(...after.map(record => record.last_modified)),
    "Should have correct last modified timestamp"
  );

  // Force a DB close for shutdown so we can delete the DB later.
  Database._shutdownHandler();
});

add_task(async function test_throws_error_if_worker_fails() {
  let error;
  try {
    await RemoteSettingsWorker.canonicalStringify(null, 42);
  } catch (e) {
    error = e;
  }
  Assert.equal(error.message.endsWith("records is null"), true);
});

add_task(async function test_throws_error_if_worker_fails_async() {
  if (IS_ANDROID) {
    // Skip test: we don't ship dump, so importJSONDump() is no-op.
    return;
  }
  // Delete the Remote Settings database, and try to import a dump.
  // This is not supported, and the error thrown asynchronously in the worker
  // should be reported to the caller.
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("remote-settings");
    request.onsuccess = () => resolve();
    request.onblocked = () => reject(new Error("Cannot delete DB"));
    request.onerror = event => reject(event.target.error);
  });
  let error;
  try {
    await RemoteSettingsWorker.importJSONDump("main", "language-dictionaries");
  } catch (e) {
    error = e;
  }
  Assert.ok(/IndexedDB: Error accessing remote-settings/.test(error.message));
});

add_task(async function test_throws_error_if_worker_crashes() {
  // This simulates a crash at the worker level (not within a promise).
  let error;
  try {
    await RemoteSettingsWorker._execute("unknown_method");
  } catch (e) {
    error = e;
  }
  Assert.equal(error.message, "TypeError: Agent[method] is not a function");
});

add_task(async function test_stops_worker_after_timeout() {
  // Change the idle time.
  Services.prefs.setIntPref(
    "services.settings.worker_idle_max_milliseconds",
    1
  );
  // Run a task:
  let serialized = await RemoteSettingsWorker.canonicalStringify([], 42);
  Assert.equal(serialized, '{"data":[],"last_modified":"42"}', "API works.");
  // Check that the worker gets stopped now the task is done:
  await TestUtils.waitForCondition(() => !RemoteSettingsWorker.worker);
  // Ensure the worker stays alive for 10 minutes instead:
  Services.prefs.setIntPref(
    "services.settings.worker_idle_max_milliseconds",
    600000
  );
  // Run another task:
  serialized = await RemoteSettingsWorker.canonicalStringify([], 42);
  Assert.equal(
    serialized,
    '{"data":[],"last_modified":"42"}',
    "API still works."
  );
  Assert.ok(RemoteSettingsWorker.worker, "Worker should stay alive a bit.");

  // Clear the pref.
  Services.prefs.clearUserPref(
    "services.settings.worker_idle_max_milliseconds"
  );
});
