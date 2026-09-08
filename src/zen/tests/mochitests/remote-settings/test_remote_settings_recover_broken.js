const PREF_SETTINGS_SERVER = "services.settings.server";
const CHANGES_PATH = "/v1" + Utils.CHANGES_PATH;
const BROKEN_SYNC_THRESHOLD = 10; // See default pref value

let server;
let client;
let maybeSyncBackup;

async function clear_state() {
  // Disable logging output.
  Services.prefs.setStringPref("services.settings.loglevel", "critical");
  // Pull data from the test server.
  Services.prefs.setStringPref(
    PREF_SETTINGS_SERVER,
    `http://localhost:${server.identity.primaryPort}/v1`
  );

  // Clear sync history.
  await new SyncHistory("").clear();

  // Simulate a response whose ETag gets incremented on each call
  // (in order to generate several history entries, indexed by timestamp).
  let timestamp = 1337;
  server.registerPathHandler(CHANGES_PATH, (request, response) => {
    response.setStatusLine(null, 200, "OK");
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("Date", new Date(1000000).toUTCString());
    response.setHeader("ETag", `"${timestamp}"`);
    response.write(
      JSON.stringify({
        timestamp,
        changes: [
          {
            last_modified: ++timestamp,
            bucket: "main",
            collection: "desktop-manager",
          },
        ],
      })
    );
  });

  // Restore original maybeSync() method between each test.
  client.maybeSync = maybeSyncBackup;
}

function run_test() {
  // Set up an HTTP Server
  server = new HttpServer();
  server.start(-1);

  client = RemoteSettings("desktop-manager");
  maybeSyncBackup = client.maybeSync;

  run_next_test();

  registerCleanupFunction(() => {
    server.stop(() => {});
    // Restore original maybeSync() method when test suite is done.
    client.maybeSync = maybeSyncBackup;
  });
}

add_task(clear_state);

add_task(async function test_db_is_destroyed_when_sync_is_broken() {
  // Simulate a successful sync.
  client.maybeSync = async () => {
    // Store some data in local DB.
    await client.db.importChanges({}, 1515, []);
  };
  await RemoteSettings.pollChanges({ trigger: "timer" });

  // Register a client with a failing sync method.
  client.maybeSync = () => {
    throw new RemoteSettingsClient.InvalidSignatureError(
      "main/desktop-manager"
    );
  };

  // Now obtain several failures in a row.
  for (var i = 0; i < BROKEN_SYNC_THRESHOLD; i++) {
    try {
      await RemoteSettings.pollChanges({ trigger: "timer" });
    } catch (e) {}
  }

  // Synchronization is in broken state.
  Assert.equal(
    await client.db.getLastModified(),
    1515,
    "Local DB was not destroyed yet"
  );

  // Synchronize again. Broken state will be detected.
  try {
    await RemoteSettings.pollChanges({ trigger: "timer" });
  } catch (e) {}

  // DB was destroyed.
  Assert.equal(
    await client.db.getLastModified(),
    null,
    "Local DB was destroyed"
  );
});

add_task(clear_state);

add_task(async function test_db_is_not_destroyed_when_state_is_server_error() {
  // Since we don't mock the server endpoints to obtain the changeset of this
  // collection, the call to `maybeSync()` will fail with network errors.

  // Store some data in local DB.
  await client.db.importChanges({}, 1515, []);

  // Now obtain several failures in a row.
  let lastError;
  for (var i = 0; i < BROKEN_SYNC_THRESHOLD + 1; i++) {
    try {
      await RemoteSettings.pollChanges({ trigger: "timer" });
    } catch (e) {
      lastError = e;
    }
  }
  Assert.ok(
    /Cannot parse server content/.test(lastError.message),
    "Error is about server"
  );
  // DB was not destroyed.
  Assert.equal(
    await client.db.getLastModified(),
    1515,
    "Local DB was not destroyed"
  );
});

add_task(clear_state);
