const { pushBroadcastService } = ChromeUtils.importESModule(
  "resource://gre/modules/PushBroadcastService.sys.mjs"
);

const { remoteSettingsBroadcastHandler, BROADCAST_ID } =
  ChromeUtils.importESModule(
    "resource://services-settings/remote-settings.sys.mjs"
  );

const PREF_SETTINGS_SERVER = "services.settings.server";
const PREF_SETTINGS_SERVER_BACKOFF = "services.settings.server.backoff";
const PREF_LAST_UPDATE = "services.settings.last_update_seconds";
const PREF_LAST_ETAG = "services.settings.last_etag";
const PREF_CLOCK_SKEW_SECONDS = "services.settings.clock_skew_seconds";

// Telemetry report result.
const TELEMETRY_SOURCE_POLL = "settings-changes-monitoring";
const TELEMETRY_SOURCE_SYNC = "settings-sync";
const CHANGES_PATH = "/v1" + Utils.CHANGES_PATH;

var server;

async function clear_state() {
  // set up prefs so the kinto updater talks to the test server
  Services.prefs.setStringPref(
    PREF_SETTINGS_SERVER,
    `http://localhost:${server.identity.primaryPort}/v1`
  );

  // set some initial values so we can check these are updated appropriately
  Services.prefs.setIntPref(PREF_LAST_UPDATE, 0);
  Services.prefs.setIntPref(PREF_CLOCK_SKEW_SECONDS, 0);
  Services.prefs.clearUserPref(PREF_LAST_ETAG);

  // Clear events snapshot.
  Services.telemetry.snapshotEvents(Ci.nsITelemetry.DATASET_ALL_CHANNELS, true);
  Services.fog.testResetFOG();
  enableUptakeMetric();

  // Clear sync history.
  await new SyncHistory("").clear();
}

function serveChangesEntries(serverTime, entriesOrFunc) {
  return (request, response) => {
    response.setStatusLine(null, 200, "OK");
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("Date", new Date(serverTime).toUTCString());
    const entries =
      typeof entriesOrFunc == "function" ? entriesOrFunc() : entriesOrFunc;
    const latest = entries[0]?.last_modified ?? 42;
    if (entries.length) {
      response.setHeader("ETag", `"${latest}"`);
    }
    response.write(JSON.stringify({ timestamp: latest, changes: entries }));
  };
}

add_setup(() => {
  // Set up an HTTP Server
  server = new HttpServer();
  server.start(-1);

  registerCleanupFunction(() => {
    server.stop(() => {});
  });
});

add_task(clear_state);

add_task(async function test_an_event_is_sent_on_start() {
  server.registerPathHandler(CHANGES_PATH, (request, response) => {
    response.write(JSON.stringify({ timestamp: 42, changes: [] }));
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("ETag", "42");
    response.setHeader("Date", new Date().toUTCString());
    response.setStatusLine(null, 200, "OK");
  });
  let notificationObserved = null;
  const observer = {
    observe(aSubject, aTopic, aData) {
      Services.obs.removeObserver(this, "remote-settings:changes-poll-start");
      notificationObserved = JSON.parse(aData);
    },
  };
  Services.obs.addObserver(observer, "remote-settings:changes-poll-start");

  await RemoteSettings.pollChanges({ expectedTimestamp: 13 });

  Assert.equal(
    notificationObserved.expectedTimestamp,
    13,
    "start notification should have been observed"
  );
});
add_task(clear_state);

add_task(async function test_offline_is_reported_if_relevant() {
  const offlineBackup = Services.io.offline;
  try {
    Services.io.offline = true;

    await RemoteSettings.pollChanges();

    assertTelemetryEvents([
      {
        value: UptakeTelemetry.STATUS.NETWORK_OFFLINE_ERROR,
      },
    ]);
  } finally {
    Services.io.offline = offlineBackup;
  }
});
add_task(clear_state);

add_task(async function test_check_success() {
  const serverTime = 8000;

  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(serverTime, [
      {
        id: "330a0c5f-fadf-ff0b-40c8-4eb0d924ff6a",
        last_modified: 1100,
        host: "localhost",
        bucket: "some-other-bucket",
        collection: "test-collection",
      },
      {
        id: "254cbb9e-6888-4d9f-8e60-58b74faa8778",
        last_modified: 1000,
        host: "localhost",
        bucket: "test-bucket",
        collection: "test-collection",
      },
    ])
  );

  // add a test kinto client that will respond to lastModified information
  // for a collection called 'test-collection'.
  // Let's use a bucket that is not the default one (`test-bucket`).
  const c = RemoteSettings("test-collection", {
    bucketName: "test-bucket",
  });
  let maybeSyncCalled = false;
  c.maybeSync = () => {
    maybeSyncCalled = true;
  };

  // Ensure that the remote-settings:changes-poll-end notification works
  let notificationObserved = false;
  const observer = {
    observe() {
      Services.obs.removeObserver(this, "remote-settings:changes-poll-end");
      notificationObserved = true;
    },
  };
  Services.obs.addObserver(observer, "remote-settings:changes-poll-end");

  await RemoteSettings.pollChanges();

  // It didn't fail, hence we are sure that the unknown collection ``some-other-bucket/test-collection``
  // was ignored, otherwise it would have tried to reach the network.

  Assert.ok(maybeSyncCalled, "maybeSync was called");
  Assert.ok(notificationObserved, "a notification should have been observed");
  // Last timestamp was saved. An ETag header value is a quoted string.
  Assert.equal(Services.prefs.getStringPref(PREF_LAST_ETAG), "1100");
  // check the last_update is updated
  Assert.equal(Services.prefs.getIntPref(PREF_LAST_UPDATE), serverTime / 1000);

  // ensure that we've accumulated the correct telemetry
  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.SUCCESS,
      source: TELEMETRY_SOURCE_POLL,
      trigger: "manual",
    },
    {
      value: UptakeTelemetry.STATUS.SUCCESS,
      source: TELEMETRY_SOURCE_SYNC,
      trigger: "manual",
    },
  ]);
});
add_task(clear_state);

add_task(async function test_update_timer_interface() {
  const remoteSettings = Cc["@mozilla.org/services/settings;1"].getService(
    Ci.nsITimerCallback
  );

  const serverTime = 8000;
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(serverTime, [
      {
        id: "028261ad-16d4-40c2-a96a-66f72914d125",
        last_modified: 42,
        host: "localhost",
        bucket: "main",
        collection: "whatever-collection",
      },
    ])
  );

  await new Promise(resolve => {
    const e = "remote-settings:changes-poll-end";
    const changesPolledObserver = {
      observe() {
        Services.obs.removeObserver(this, e);
        resolve();
      },
    };
    Services.obs.addObserver(changesPolledObserver, e);
    remoteSettings.notify(null);
  });

  // Everything went fine.
  Assert.equal(Services.prefs.getStringPref(PREF_LAST_ETAG), "42");
  Assert.equal(Services.prefs.getIntPref(PREF_LAST_UPDATE), serverTime / 1000);
});
add_task(clear_state);

add_task(async function test_check_up_to_date() {
  // Simulate a poll with up-to-date collection.
  const serverTime = 4000;
  server.registerPathHandler(CHANGES_PATH, serveChangesEntries(serverTime, []));

  Services.prefs.setStringPref(PREF_LAST_ETAG, "1100");

  // Ensure that the remote-settings:changes-poll-end notification is sent.
  let notificationObserved = false;
  const observer = {
    observe() {
      Services.obs.removeObserver(this, "remote-settings:changes-poll-end");
      notificationObserved = true;
    },
  };
  Services.obs.addObserver(observer, "remote-settings:changes-poll-end");

  // If server has no change, maybeSync() is not called.
  let maybeSyncCalled = false;
  const c = RemoteSettings("test-collection", {
    bucketName: "test-bucket",
  });
  c.maybeSync = () => {
    maybeSyncCalled = true;
  };

  await RemoteSettings.pollChanges();

  Assert.ok(notificationObserved, "a notification should have been observed");
  Assert.ok(!maybeSyncCalled, "maybeSync should not be called");
  // Last update is overwritten
  Assert.equal(Services.prefs.getIntPref(PREF_LAST_UPDATE), serverTime / 1000);

  // ensure that we've accumulated the correct telemetry
  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.UP_TO_DATE,
      source: TELEMETRY_SOURCE_POLL,
    },
    {
      value: UptakeTelemetry.STATUS.SUCCESS,
      source: TELEMETRY_SOURCE_SYNC,
    },
  ]);
});
add_task(clear_state);

add_task(async function test_expected_timestamp() {
  function withCacheBust(request, response) {
    const entries = [
      {
        id: "695c2407-de79-4408-91c7-70720dd59d78",
        last_modified: 1100,
        host: "localhost",
        bucket: "main",
        collection: "with-cache-busting",
      },
    ];
    if (
      request.queryString.includes(`_expected=${encodeURIComponent('"42"')}`)
    ) {
      response.write(
        JSON.stringify({
          timestamp: 1110,
          changes: entries,
        })
      );
    }
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("ETag", '"1100"');
    response.setHeader("Date", new Date().toUTCString());
    response.setStatusLine(null, 200, "OK");
  }
  server.registerPathHandler(CHANGES_PATH, withCacheBust);

  const c = RemoteSettings("with-cache-busting");
  let maybeSyncCalled = false;
  c.maybeSync = () => {
    maybeSyncCalled = true;
  };

  await RemoteSettings.pollChanges({ expectedTimestamp: '"42"' });

  Assert.ok(maybeSyncCalled, "maybeSync was called");
});
add_task(clear_state);

add_task(async function test_client_last_check_is_saved() {
  server.registerPathHandler(CHANGES_PATH, (request, response) => {
    response.write(
      JSON.stringify({
        timestamp: 42,
        changes: [
          {
            id: "695c2407-de79-4408-91c7-70720dd59d78",
            last_modified: 1100,
            host: "localhost",
            bucket: "main",
            collection: "models-recipes",
          },
        ],
      })
    );
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("ETag", '"42"');
    response.setHeader("Date", new Date().toUTCString());
    response.setStatusLine(null, 200, "OK");
  });

  const c = RemoteSettings("models-recipes");
  c.maybeSync = () => {};

  equal(
    c.lastCheckTimePref,
    "services.settings.main.models-recipes.last_check"
  );
  Services.prefs.setIntPref(c.lastCheckTimePref, 0);

  await RemoteSettings.pollChanges({ expectedTimestamp: '"42"' });

  notEqual(Services.prefs.getIntPref(c.lastCheckTimePref), 0);
});
add_task(clear_state);

add_task(async function test_age_of_data_is_reported_in_uptake_status() {
  const serverTime = 1552323900000;
  const recordsTimestamp = serverTime - 3600 * 1000;
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(serverTime, [
      {
        id: "b6ba7fab-a40a-4d03-a4af-6b627f3c5b36",
        last_modified: recordsTimestamp,
        host: "localhost",
        bucket: "main",
        collection: "some-entry",
      },
    ])
  );

  await RemoteSettings.pollChanges();

  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.SUCCESS,
      source: TELEMETRY_SOURCE_POLL,
      age: "3600",
      trigger: "manual",
    },
    {
      value: UptakeTelemetry.STATUS.SUCCESS,
      source: TELEMETRY_SOURCE_SYNC,
      trigger: "manual",
      timestamp: `${recordsTimestamp}`,
      duration: d => !!d,
    },
  ]);
});
add_task(clear_state);

add_task(
  async function test_synchronization_duration_is_reported_in_uptake_status() {
    server.registerPathHandler(
      CHANGES_PATH,
      serveChangesEntries(10000, [
        {
          id: "b6ba7fab-a40a-4d03-a4af-6b627f3c5b36",
          last_modified: 42,
          host: "localhost",
          bucket: "main",
          collection: "some-entry",
        },
      ])
    );
    const c = RemoteSettings("some-entry");
    // Simulate a synchronization that lasts 1 sec.
    // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
    c.maybeSync = () => new Promise(resolve => setTimeout(resolve, 1000));

    await RemoteSettings.pollChanges();

    assertTelemetryEvents([
      {
        value: UptakeTelemetry.STATUS.SUCCESS,
        source: TELEMETRY_SOURCE_POLL,
        trigger: "manual",
        age: a => !!a,
      },
      {
        value: UptakeTelemetry.STATUS.SUCCESS,
        source: TELEMETRY_SOURCE_SYNC,
        trigger: "manual",
        duration: d => parseInt(d) >= 1000,
      },
    ]);
  }
);
add_task(clear_state);

add_task(async function test_success_with_partial_list() {
  function partialList(request, response) {
    const entries = [
      {
        id: "028261ad-16d4-40c2-a96a-66f72914d125",
        last_modified: 43,
        host: "localhost",
        bucket: "main",
        collection: "cid-1",
      },
      {
        id: "98a34576-bcd6-423f-abc2-1d290b776ed8",
        last_modified: 42,
        host: "localhost",
        bucket: "main",
        collection: "poll-test-collection",
      },
    ];
    if (request.queryString.includes(`_since=42`)) {
      response.write(
        JSON.stringify({
          timestamp: 43,
          changes: entries.slice(0, 1),
        })
      );
    } else {
      response.write(
        JSON.stringify({
          timestamp: 42,
          changes: entries,
        })
      );
    }
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("Date", new Date().toUTCString());
    response.setStatusLine(null, 200, "OK");
  }
  server.registerPathHandler(CHANGES_PATH, partialList);

  const c = RemoteSettings("poll-test-collection");
  let maybeSyncCount = 0;
  c.maybeSync = () => {
    maybeSyncCount++;
  };

  await RemoteSettings.pollChanges();
  await RemoteSettings.pollChanges();

  // On the second call, the server does not mention the poll-test-collection
  // and maybeSync() is not called.
  Assert.equal(maybeSyncCount, 1, "maybeSync should not be called twice");
});
add_task(clear_state);

add_task(async function test_full_polling() {
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(10000, [
      {
        id: "b6ba7fab-a40a-4d03-a4af-6b627f3c5b36",
        last_modified: 42,
        host: "localhost",
        bucket: "main",
        collection: "poll-test-collection",
      },
    ])
  );

  const c = RemoteSettings("poll-test-collection");
  let maybeSyncCount = 0;
  c.maybeSync = () => {
    maybeSyncCount++;
  };

  await RemoteSettings.pollChanges();
  await RemoteSettings.pollChanges({ full: true });

  // Since the second call is full, clients are called
  Assert.equal(maybeSyncCount, 2, "maybeSync should be called twice");
});
add_task(clear_state);

add_task(async function test_server_bad_json() {
  function simulateBadJSON(request, response) {
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.write("<html></html>");
    response.setStatusLine(null, 200, "OK");
  }
  server.registerPathHandler(CHANGES_PATH, simulateBadJSON);

  let error;
  try {
    await RemoteSettings.pollChanges();
  } catch (e) {
    error = e;
  }
  Assert.ok(/JSON.parse: unexpected character/.test(error.message));

  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.PARSE_ERROR,
    },
  ]);
});
add_task(clear_state);

add_task(async function test_server_bad_content_type() {
  function simulateBadContentType(request, response) {
    response.setHeader("Content-Type", "text/html");
    response.write("<html></html>");
    response.setStatusLine(null, 200, "OK");
  }
  server.registerPathHandler(CHANGES_PATH, simulateBadContentType);

  let error;
  try {
    await RemoteSettings.pollChanges();
  } catch (e) {
    error = e;
  }
  Assert.ok(/Unexpected content-type/.test(error.message));

  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.CONTENT_ERROR,
    },
  ]);
});
add_task(clear_state);

add_task(async function test_server_404_response() {
  function simulateDummy404(request, response) {
    response.setHeader("Content-Type", "text/html; charset=UTF-8");
    response.write("<html></html>");
    response.setStatusLine(null, 404, "OK");
  }
  server.registerPathHandler(CHANGES_PATH, simulateDummy404);

  await RemoteSettings.pollChanges(); // Does not fail when running from tests.
});
add_task(clear_state);

add_task(async function test_server_error() {
  // Simulate a server error.
  function simulateErrorResponse(request, response) {
    response.setHeader("Date", new Date(3000).toUTCString());
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.write(
      JSON.stringify({
        code: 503,
        errno: 999,
        error: "Service Unavailable",
      })
    );
    response.setStatusLine(null, 503, "Service Unavailable");
  }
  server.registerPathHandler(CHANGES_PATH, simulateErrorResponse);

  let notificationObserved = false;
  const observer = {
    observe() {
      Services.obs.removeObserver(this, "remote-settings:changes-poll-end");
      notificationObserved = true;
    },
  };
  Services.obs.addObserver(observer, "remote-settings:changes-poll-end");
  Services.prefs.setIntPref(PREF_LAST_UPDATE, 42);

  // pollChanges() fails with adequate error and no notification.
  let error;
  try {
    await RemoteSettings.pollChanges();
  } catch (e) {
    error = e;
  }

  Assert.ok(
    !notificationObserved,
    "a notification should not have been observed"
  );
  Assert.ok(/Polling for changes failed/.test(error.message));
  // When an error occurs, last update was not overwritten.
  Assert.equal(Services.prefs.getIntPref(PREF_LAST_UPDATE), 42);
  // ensure that we've accumulated the correct telemetry
  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.SERVER_ERROR,
    },
  ]);
});
add_task(clear_state);

add_task(async function test_server_error_5xx() {
  function simulateErrorResponse(request, response) {
    response.setHeader("Date", new Date(3000).toUTCString());
    response.setHeader("Content-Type", "text/html; charset=UTF-8");
    response.write("<html></html>");
    response.setStatusLine(null, 504, "Gateway Timeout");
  }
  server.registerPathHandler(CHANGES_PATH, simulateErrorResponse);

  try {
    await RemoteSettings.pollChanges();
  } catch (e) {}

  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.SERVER_ERROR,
    },
  ]);
});
add_task(clear_state);

add_task(async function test_server_error_4xx() {
  function simulateErrorResponse(request, response) {
    response.setHeader("Date", new Date(3000).toUTCString());
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    if (request.queryString.includes(`_since=${encodeURIComponent('"abc"')}`)) {
      response.setStatusLine(null, 400, "Bad Request");
      response.write(JSON.stringify({}));
    } else {
      response.setStatusLine(null, 200, "OK");
      response.write(JSON.stringify({ changes: [] }));
    }
  }
  server.registerPathHandler(CHANGES_PATH, simulateErrorResponse);

  Services.prefs.setStringPref(PREF_LAST_ETAG, '"abc"');

  let error;
  try {
    await RemoteSettings.pollChanges();
  } catch (e) {
    error = e;
  }

  Assert.ok(error.message.includes("400 Bad Request"), "Polling failed");
  Assert.ok(
    !Services.prefs.prefHasUserValue(PREF_LAST_ETAG),
    "Last ETag pref was cleared"
  );

  await RemoteSettings.pollChanges(); // Does not raise.
});
add_task(clear_state);

add_task(async function test_client_error() {
  const collectionDetails = {
    id: "b6ba7fab-a40a-4d03-a4af-6b627f3c5b36",
    last_modified: 42,
    host: "localhost",
    bucket: "main",
    collection: "some-entry",
  };
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(10000, [collectionDetails])
  );
  const c = RemoteSettings("some-entry");
  c.maybeSync = () => {
    throw new RemoteSettingsClient.CorruptedDataError("main/some-entry");
  };

  let notificationsObserved = [];
  const observer = {
    observe(aSubject, aTopic) {
      Services.obs.removeObserver(this, aTopic);
      notificationsObserved.push([aTopic, aSubject.wrappedJSObject]);
    },
  };
  Services.obs.addObserver(observer, "remote-settings:changes-poll-end");
  Services.obs.addObserver(observer, "remote-settings:sync-error");
  Services.prefs.setIntPref(PREF_LAST_ETAG, 42);

  // pollChanges() fails with adequate error and a sync-error notification.
  let error;
  try {
    await RemoteSettings.pollChanges();
  } catch (e) {
    error = e;
  }

  Assert.equal(
    notificationsObserved.length,
    1,
    "only the error notification should not have been observed"
  );
  console.log(notificationsObserved);
  let [topicObserved, subjectObserved] = notificationsObserved[0];
  Assert.equal(topicObserved, "remote-settings:sync-error");
  Assert.ok(
    subjectObserved.error instanceof RemoteSettingsClient.CorruptedDataError,
    `original error is provided (got ${subjectObserved.error})`
  );
  Assert.deepEqual(
    subjectObserved.error.details,
    collectionDetails,
    "information about collection is provided"
  );

  Assert.ok(/Corrupted/.test(error.message), "original client error is thrown");
  // When an error occurs, last etag was not overwritten.
  Assert.equal(Services.prefs.getIntPref(PREF_LAST_ETAG), 42);
  // ensure that we've accumulated the correct telemetry
  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.SUCCESS,
    },
    {
      value: UptakeTelemetry.STATUS.SYNC_ERROR,
    },
  ]);
});
add_task(clear_state);

add_task(async function test_sync_success_is_stored_in_history() {
  const collectionDetails = {
    last_modified: 444,
    bucket: "main",
    collection: "desktop-manager",
  };
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(10000, [collectionDetails])
  );
  const c = RemoteSettings("desktop-manager");
  c.maybeSync = () => {};
  try {
    await RemoteSettings.pollChanges({ expectedTimestamp: 555 });
  } catch (e) {}

  const { history } = await RemoteSettings.inspect();

  Assert.deepEqual(history, {
    [TELEMETRY_SOURCE_SYNC]: [
      {
        timestamp: 444,
        status: "success",
        infos: {},
        datetime: new Date(444),
      },
    ],
  });
});
add_task(clear_state);

add_task(async function test_sync_error_is_stored_in_history() {
  const collectionDetails = {
    last_modified: 1337,
    bucket: "main",
    collection: "desktop-manager",
  };
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(10000, [collectionDetails])
  );
  const c = RemoteSettings("desktop-manager");
  c.maybeSync = () => {
    throw new RemoteSettingsClient.MissingSignatureError(
      "main/desktop-manager"
    );
  };
  try {
    await RemoteSettings.pollChanges({ expectedTimestamp: 123456 });
  } catch (e) {}

  const { history } = await RemoteSettings.inspect();

  Assert.deepEqual(history, {
    [TELEMETRY_SOURCE_SYNC]: [
      {
        timestamp: 1337,
        status: "sync_error",
        infos: {
          expectedTimestamp: 123456,
          errorName: "MissingSignatureError",
        },
        datetime: new Date(1337),
      },
    ],
  });
});
add_task(clear_state);

add_task(
  async function test_sync_broken_signal_is_sent_on_consistent_failure() {
    // Wait for the "sync-broken-error" notification.
    let notificationObserved = false;
    const observer = {
      observe() {
        notificationObserved = true;
      },
    };
    Services.obs.addObserver(observer, "remote-settings:broken-sync-error");
    // Register a client with a failing sync method.
    const c = RemoteSettings("desktop-manager");
    c.maybeSync = () => {
      throw new RemoteSettingsClient.InvalidSignatureError(
        "main/desktop-manager"
      );
    };
    // Simulate a response whose ETag gets incremented on each call
    // (in order to generate several history entries, indexed by timestamp).
    let timestamp = 1337;
    server.registerPathHandler(
      CHANGES_PATH,
      serveChangesEntries(10000, () => {
        return [
          {
            last_modified: ++timestamp,
            bucket: "main",
            collection: "desktop-manager",
          },
        ];
      })
    );

    // Now obtain several failures in a row (less than threshold).
    for (var i = 0; i < 9; i++) {
      try {
        await RemoteSettings.pollChanges();
      } catch (e) {}
    }
    Assert.ok(!notificationObserved, "Not notified yet");

    // Clear events snapshot.
    Services.telemetry.snapshotEvents(
      Ci.nsITelemetry.DATASET_ALL_CHANNELS,
      true
    );
    Services.fog.testResetFOG();
    enableUptakeMetric();

    // Fail again once. Will now notify.
    try {
      await RemoteSettings.pollChanges();
    } catch (e) {}
    Assert.ok(notificationObserved, "Broken sync notified");
    // Uptake event to notify broken sync is sent.
    assertTelemetryEvents([
      {
        value: UptakeTelemetry.STATUS.SUCCESS,
      },
      {
        value: UptakeTelemetry.STATUS.SYNC_ERROR,
      },
      {
        value: UptakeTelemetry.STATUS.SYNC_BROKEN_ERROR,
      },
    ]);

    // Synchronize successfully.
    notificationObserved = false;
    const failingSync = c.maybeSync;
    c.maybeSync = () => {};
    await RemoteSettings.pollChanges();

    const { history } = await RemoteSettings.inspect();
    Assert.equal(
      history[TELEMETRY_SOURCE_SYNC][0].status,
      UptakeTelemetry.STATUS.SUCCESS,
      "Last sync is success"
    );
    Assert.ok(!notificationObserved, "Not notified after success");

    // Now fail again. Broken sync isn't notified, we need several in a row.
    c.maybeSync = failingSync;
    try {
      await RemoteSettings.pollChanges();
    } catch (e) {}
    Assert.ok(!notificationObserved, "Not notified on single error");
    Services.obs.removeObserver(observer, "remote-settings:broken-sync-error");
  }
);
add_task(clear_state);

add_task(async function test_check_clockskew_is_updated() {
  const serverTime = 2000;

  function serverResponse(request, response) {
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("Date", new Date(serverTime).toUTCString());
    response.write(JSON.stringify({ timestamp: 42, changes: [] }));
    response.setStatusLine(null, 200, "OK");
  }
  server.registerPathHandler(CHANGES_PATH, serverResponse);

  let startTime = Date.now();

  await RemoteSettings.pollChanges();

  // How does the clock difference look?
  let endTime = Date.now();
  let clockDifference = Services.prefs.getIntPref(PREF_CLOCK_SKEW_SECONDS);
  // we previously set the serverTime to 2 (seconds past epoch)
  Assert.ok(
    clockDifference <= endTime / 1000 &&
      clockDifference >= Math.floor(startTime / 1000) - serverTime / 1000
  );

  // check negative clock skew times
  // set to a time in the future
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(Date.now() + 10000, [])
  );

  await RemoteSettings.pollChanges();

  clockDifference = Services.prefs.getIntPref(PREF_CLOCK_SKEW_SECONDS);
  // we previously set the serverTime to Date.now() + 10000 ms past epoch
  Assert.ok(clockDifference <= 0 && clockDifference >= -10);
});
add_task(clear_state);

add_task(async function test_check_clockskew_takes_age_into_account() {
  const currentTime = Date.now();
  const skewSeconds = 5;
  const ageCDNSeconds = 3600;
  const serverTime = currentTime - skewSeconds * 1000 - ageCDNSeconds * 1000;

  function serverResponse(request, response) {
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("Date", new Date(serverTime).toUTCString());
    response.setHeader("Age", `${ageCDNSeconds}`);
    response.write(JSON.stringify({ timestamp: 42, changes: [] }));
    response.setStatusLine(null, 200, "OK");
  }
  server.registerPathHandler(CHANGES_PATH, serverResponse);

  await RemoteSettings.pollChanges();

  const clockSkew = Services.prefs.getIntPref(PREF_CLOCK_SKEW_SECONDS);
  Assert.greaterOrEqual(clockSkew, skewSeconds, `clockSkew is ${clockSkew}`);
});
add_task(clear_state);

add_task(async function test_backoff() {
  function simulateBackoffResponse(request, response) {
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("Backoff", "10");
    response.write(JSON.stringify({ timestamp: 42, changes: [] }));
    response.setStatusLine(null, 200, "OK");
  }
  server.registerPathHandler(CHANGES_PATH, simulateBackoffResponse);

  // First will work.
  await RemoteSettings.pollChanges();
  // Second will fail because we haven't waited.
  try {
    await RemoteSettings.pollChanges();
    // The previous line should have thrown an error.
    Assert.ok(false);
  } catch (e) {
    Assert.ok(
      /Server is asking clients to back off; retry in \d+s./.test(e.message)
    );
  }

  // Once backoff time has expired, polling for changes can start again.
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(12000, [
      {
        id: "6a733d4a-601e-11e8-837a-0f85257529a1",
        last_modified: 1300,
        host: "localhost",
        bucket: "some-bucket",
        collection: "some-collection",
      },
    ])
  );
  Services.prefs.setStringPref(
    PREF_SETTINGS_SERVER_BACKOFF,
    `${Date.now() - 1000}`
  );

  await RemoteSettings.pollChanges();

  // Backoff tracking preference was cleared.
  Assert.ok(!Services.prefs.prefHasUserValue(PREF_SETTINGS_SERVER_BACKOFF));

  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.UP_TO_DATE,
    },
    {
      value: UptakeTelemetry.STATUS.SUCCESS,
    },
    {
      value: UptakeTelemetry.STATUS.BACKOFF,
    },
    {
      value: UptakeTelemetry.STATUS.SUCCESS,
    },
    {
      value: UptakeTelemetry.STATUS.SUCCESS,
    },
  ]);
});
add_task(clear_state);

add_task(async function test_network_error() {
  // Simulate a network error (to check telemetry report).
  Services.prefs.setStringPref(PREF_SETTINGS_SERVER, "http://localhost:42/v1");
  try {
    await RemoteSettings.pollChanges();
  } catch (e) {}

  // ensure that we've accumulated the correct telemetry
  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.NETWORK_ERROR,
    },
  ]);
});
add_task(clear_state);

add_task(async function test_syncs_clients_with_local_database() {
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(42000, [
      {
        id: "d4a14f44-601f-11e8-8b8a-030f3dc5b844",
        last_modified: 10000,
        host: "localhost",
        bucket: "main",
        collection: "some-unknown",
      },
      {
        id: "39f57e4e-6023-11e8-8b74-77c8dedfb389",
        last_modified: 9000,
        host: "localhost",
        bucket: "blocklists",
        collection: "addons",
      },
      {
        id: "9a594c1a-601f-11e8-9c8a-33b2239d9113",
        last_modified: 8000,
        host: "localhost",
        bucket: "main",
        collection: "recipes",
      },
    ])
  );

  // This simulates what remote-settings would do when initializing a local database.
  // We don't want to instantiate a client using the RemoteSettings() API
  // since we want to test «unknown» clients that have a local database.
  new RemoteSettingsClient("addons", {
    bucketName: "blocklists",
  }).db.importChanges({}, 42);
  new RemoteSettingsClient("recipes").db.importChanges({}, 43);

  let error;
  try {
    await RemoteSettings.pollChanges();
    Assert.ok(false, "pollChange() should throw when pulling recipes");
  } catch (e) {
    error = e;
  }

  // The `main/some-unknown` should be skipped because it has no local database.
  // The `blocklists/addons` should be skipped because it is not the main bucket.
  // The `recipes` has a local database, and should cause a network error because the test
  // does not setup the server to receive the requests of `maybeSync()`.
  Assert.ok(/HTTP 404/.test(error.message), "server will return 404 on sync");
  Assert.equal(error.details.collection, "recipes");
});
add_task(clear_state);

add_task(async function test_syncs_clients_with_local_dump() {
  if (IS_ANDROID) {
    // Skip test: we don't ship remote settings dumps on Android (see package-manifest).
    return;
  }
  server.registerPathHandler(
    CHANGES_PATH,
    serveChangesEntries(42000, [
      {
        id: "d4a14f44-601f-11e8-8b8a-030f3dc5b844",
        last_modified: 10000,
        host: "localhost",
        bucket: "main",
        collection: "some-unknown",
      },
      {
        id: "39f57e4e-6023-11e8-8b74-77c8dedfb389",
        last_modified: 9000,
        host: "localhost",
        bucket: "blocklists",
        collection: "addons",
      },
      {
        id: "9a594c1a-601f-11e8-9c8a-33b2239d9113",
        last_modified: 8000,
        host: "localhost",
        bucket: "main",
        collection: "example",
      },
    ])
  );

  let error;
  try {
    await RemoteSettings.pollChanges();
  } catch (e) {
    error = e;
  }

  // The `main/some-unknown` should be skipped because it has no dump.
  // The `blocklists/addons` should be skipped because it is not the main bucket.
  // The `example` has a dump, and should cause a network error because the test
  // does not setup the server to receive the requests of `maybeSync()`.
  Assert.ok(/HTTP 404/.test(error.message), "server will return 404 on sync");
  Assert.equal(error.details.collection, "example");
});
add_task(clear_state);

add_task(async function test_adding_client_resets_polling() {
  function serve200(request, response) {
    const entries = [
      {
        id: "aa71e6cc-9f37-447a-b6e0-c025e8eabd03",
        last_modified: 42,
        host: "localhost",
        bucket: "main",
        collection: "a-collection",
      },
    ];
    if (request.queryString.includes("_since")) {
      response.write(
        JSON.stringify({
          timestamp: 42,
          changes: [],
        })
      );
    } else {
      response.write(
        JSON.stringify({
          timestamp: 42,
          changes: entries,
        })
      );
    }
    response.setStatusLine(null, 200, "OK");
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setHeader("Date", new Date().toUTCString());
  }
  server.registerPathHandler(CHANGES_PATH, serve200);

  // Poll once, without any client for "a-collection"
  await RemoteSettings.pollChanges();

  // Register a new client.
  let maybeSyncCalled = false;
  const c = RemoteSettings("a-collection");
  c.maybeSync = () => {
    maybeSyncCalled = true;
  };

  // Poll again.
  await RemoteSettings.pollChanges();

  // The new client was called, even if the server data didn't change.
  Assert.ok(maybeSyncCalled);

  // Poll again. This time maybeSync() won't be called.
  maybeSyncCalled = false;
  await RemoteSettings.pollChanges();
  Assert.ok(!maybeSyncCalled);
});
add_task(clear_state);

add_task(
  async function test_broadcast_handler_passes_version_and_trigger_values() {
    // The polling will use the broadcast version as cache busting query param.
    let passedQueryString;
    function serveCacheBusted(request, response) {
      passedQueryString = request.queryString;
      const entries = [
        {
          id: "b6ba7fab-a40a-4d03-a4af-6b627f3c5b36",
          last_modified: 42,
          host: "localhost",
          bucket: "main",
          collection: "from-broadcast",
        },
      ];
      response.write(
        JSON.stringify({
          changes: entries,
          timestamp: 42,
        })
      );
      response.setHeader("ETag", "42");
      response.setStatusLine(null, 200, "OK");
      response.setHeader("Content-Type", "application/json; charset=UTF-8");
      response.setHeader("Date", new Date().toUTCString());
    }
    server.registerPathHandler(CHANGES_PATH, serveCacheBusted);

    let passedTrigger;
    const c = RemoteSettings("from-broadcast");
    c.maybeSync = (last_modified, { trigger }) => {
      passedTrigger = trigger;
    };

    const version = "1337";

    let context = { phase: pushBroadcastService.PHASES.HELLO };
    await remoteSettingsBroadcastHandler.receivedBroadcastMessage(
      version,
      BROADCAST_ID,
      context
    );
    Assert.equal(passedTrigger, "startup");
    Assert.equal(passedQueryString, `_expected=${version}`);

    clear_state();

    context = { phase: pushBroadcastService.PHASES.REGISTER };
    await remoteSettingsBroadcastHandler.receivedBroadcastMessage(
      version,
      BROADCAST_ID,
      context
    );
    Assert.equal(passedTrigger, "startup");

    clear_state();

    context = { phase: pushBroadcastService.PHASES.BROADCAST };
    await remoteSettingsBroadcastHandler.receivedBroadcastMessage(
      version,
      BROADCAST_ID,
      context
    );
    Assert.equal(passedTrigger, "broadcast");
  }
);
add_task(clear_state);

add_task(async function test_stale_startup_timestamp() {
  Services.prefs.setStringPref(PREF_LAST_ETAG, 42);

  let error;
  try {
    await RemoteSettings.pollChanges({
      trigger: "startup",
      expectedTimestamp: "41",
    });
  } catch (e) {
    error = e;
  }

  Assert.equal(error, undefined);
  Assert.equal(Services.prefs.getStringPref(PREF_LAST_ETAG), "42");
  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.STALE_EXPECTED,
    },
  ]);
});
add_task(clear_state);
