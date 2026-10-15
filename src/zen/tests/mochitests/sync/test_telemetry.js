/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { WBORecord } = ChromeUtils.importESModule(
  "resource://services-sync/record.sys.mjs"
);
const { RotaryEngine } = ChromeUtils.importESModule(
  "resource://testing-common/services/sync/rotaryengine.sys.mjs"
);
const { getFxAccountsSingleton } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccounts.sys.mjs"
);
const fxAccounts = getFxAccountsSingleton();

function SteamStore(engine) {
  Store.call(this, "Steam", engine);
}
Object.setPrototypeOf(SteamStore.prototype, Store.prototype);

function SteamTracker(name, engine) {
  LegacyTracker.call(this, name || "Steam", engine);
}
Object.setPrototypeOf(SteamTracker.prototype, LegacyTracker.prototype);

function SteamEngine(service) {
  SyncEngine.call(this, "steam", service);
}

SteamEngine.prototype = {
  _storeObj: SteamStore,
  _trackerObj: SteamTracker,
  _errToThrow: null,
  problemsToReport: null,
  async _sync() {
    if (this._errToThrow) {
      throw this._errToThrow;
    }
  },
  getValidator() {
    return new SteamValidator();
  },
};
Object.setPrototypeOf(SteamEngine.prototype, SyncEngine.prototype);

function BogusEngine(service) {
  SyncEngine.call(this, "bogus", service);
}

BogusEngine.prototype = Object.create(SteamEngine.prototype);

class SteamValidator {
  async canValidate() {
    return true;
  }

  async validate(engine) {
    return {
      problems: new SteamValidationProblemData(engine.problemsToReport),
      version: 1,
      duration: 0,
      recordCount: 0,
    };
  }
}

class SteamValidationProblemData {
  constructor(problemsToReport = []) {
    this.problemsToReport = problemsToReport;
  }

  getSummary() {
    return this.problemsToReport;
  }
}

async function cleanAndGo(engine, server) {
  await engine._tracker.clearChangedIDs();
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  syncTestLogging();
  Service.recordManager.clearCache();
  await promiseStopServer(server);
}

add_task(async function setup() {
  // Avoid addon manager complaining about not being initialized
  await Service.engineManager.unregister("addons");
  await Service.engineManager.unregister("extension-storage");
});

add_task(async function test_basic() {
  enableValidationPrefs();

  let helper = track_collections_helper();
  let upd = helper.with_updated_collection;

  let handlers = {
    "/1.1/johndoe/info/collections": helper.handler,
    "/1.1/johndoe/storage/crypto/keys": upd(
      "crypto",
      new ServerWBO("keys").handler()
    ),
    "/1.1/johndoe/storage/meta/global": upd(
      "meta",
      new ServerWBO("global").handler()
    ),
  };

  let collections = [
    "clients",
    "bookmarks",
    "forms",
    "history",
    "passwords",
    "prefs",
    "tabs",
  ];

  for (let coll of collections) {
    handlers["/1.1/johndoe/storage/" + coll] = upd(
      coll,
      new ServerCollection({}, true).handler()
    );
  }

  let server = httpd_setup(handlers);
  await configureIdentity({ username: "johndoe" }, server);

  await wait_for_ping(() => Service.sync(), true, true);

  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  await promiseStopServer(server);
});

add_task(async function test_processIncoming_error() {
  let engine = Service.engineManager.get("bookmarks");
  await engine.initialize();
  let store = engine._store;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("bookmarks");
  try {
    // Create a bogus record that when synced down will provoke a
    // network error which in turn provokes an exception in _processIncoming.
    const BOGUS_GUID = "zzzzzzzzzzzz";
    let bogus_record = collection.insert(BOGUS_GUID, "I'm a bogus record!");
    bogus_record.get = function get() {
      throw new Error("Sync this!");
    };
    // Make the 10 minutes old so it will only be synced in the toFetch phase.
    bogus_record.modified = Date.now() / 1000 - 60 * 10;
    await engine.setLastSync(Date.now() / 1000 - 60);
    engine.toFetch = new SerializableSet([BOGUS_GUID]);

    let error, pingPayload, fullPing;
    try {
      await sync_engine_and_validate_telem(
        engine,
        true,
        (errPing, fullErrPing) => {
          pingPayload = errPing;
          fullPing = fullErrPing;
        }
      );
    } catch (ex) {
      error = ex;
    }
    ok(!!error);
    ok(!!pingPayload);

    equal(fullPing.uid, "f".repeat(32)); // as setup by SyncTestingInfrastructure
    deepEqual(pingPayload.failureReason, {
      name: "httperror",
      code: 500,
    });

    equal(pingPayload.engines.length, 1);

    equal(pingPayload.engines[0].name, "bookmarks-buffered");
    deepEqual(pingPayload.engines[0].failureReason, {
      name: "httperror",
      code: 500,
    });
  } finally {
    await store.wipe();
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_uploading() {
  let engine = Service.engineManager.get("bookmarks");
  await engine.initialize();
  let store = engine._store;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let bmk = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.toolbarGuid,
    url: "http://getfirefox.com/",
    title: "Get Firefox!",
  });

  try {
    let ping = await sync_engine_and_validate_telem(engine, false);
    ok(!!ping);
    equal(ping.engines.length, 1);
    equal(ping.engines[0].name, "bookmarks-buffered");
    ok(!!ping.engines[0].outgoing);
    greater(ping.engines[0].outgoing[0].sent, 0);
    ok(!ping.engines[0].incoming);

    await PlacesUtils.bookmarks.update({
      guid: bmk.guid,
      title: "New Title",
    });

    await store.wipe();
    await engine.resetClient();
    // We don't sync via the service, so don't re-hit info/collections, so
    // lastModified remaning at zero breaks things subtly...
    engine.lastModified = null;

    ping = await sync_engine_and_validate_telem(engine, false);
    equal(ping.engines.length, 1);
    equal(ping.engines[0].name, "bookmarks-buffered");
    equal(ping.engines[0].outgoing.length, 1);
    ok(!!ping.engines[0].incoming);
  } finally {
    // Clean up.
    await store.wipe();
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_upload_failed() {
  let collection = new ServerCollection();
  collection._wbos.flying = new ServerWBO("flying");

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);
  await configureIdentity({ username: "foo" }, server);

  let engine = new RotaryEngine(Service);
  engine._store.items = {
    flying: "LNER Class A3 4472",
    scotsman: "Flying Scotsman",
    peppercorn: "Peppercorn Class",
  };
  const FLYING_CHANGED = 12345;
  const SCOTSMAN_CHANGED = 23456;
  const PEPPERCORN_CHANGED = 34567;
  await engine._tracker.addChangedID("flying", FLYING_CHANGED);
  await engine._tracker.addChangedID("scotsman", SCOTSMAN_CHANGED);
  await engine._tracker.addChangedID("peppercorn", PEPPERCORN_CHANGED);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  try {
    await engine.setLastSync(123); // needs to be non-zero so that tracker is queried
    let changes = await engine._tracker.getChangedIDs();
    _(
      `test_upload_failed: Rotary tracker contents at first sync: ${JSON.stringify(
        changes
      )}`
    );
    engine.enabled = true;
    let ping = await sync_engine_and_validate_telem(engine, true);
    ok(!!ping);
    equal(ping.engines.length, 1);
    equal(ping.engines[0].incoming, null);
    deepEqual(ping.engines[0].outgoing, [
      {
        sent: 3,
        failed: 2,
        failedReasons: [
          { name: "scotsman", count: 1 },
          { name: "peppercorn", count: 1 },
        ],
      },
    ]);
    await engine.setLastSync(123);

    changes = await engine._tracker.getChangedIDs();
    _(
      `test_upload_failed: Rotary tracker contents at second sync: ${JSON.stringify(
        changes
      )}`
    );
    ping = await sync_engine_and_validate_telem(engine, true);
    ok(!!ping);
    equal(ping.engines.length, 1);
    deepEqual(ping.engines[0].outgoing, [
      {
        sent: 2,
        failed: 2,
        failedReasons: [
          { name: "scotsman", count: 1 },
          { name: "peppercorn", count: 1 },
        ],
      },
    ]);
  } finally {
    await cleanAndGo(engine, server);
    await engine.finalize();
  }
});

add_task(async function test_sync_partialUpload() {
  let collection = new ServerCollection();
  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });
  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let engine = new RotaryEngine(Service);
  await engine.setLastSync(123);

  // Create a bunch of records (and server side handlers)
  for (let i = 0; i < 234; i++) {
    let id = "record-no-" + i;
    engine._store.items[id] = "Record No. " + i;
    await engine._tracker.addChangedID(id, i);
    // Let two items in the first upload batch fail.
    if (i != 23 && i != 42) {
      collection.insert(id);
    }
  }

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  try {
    let changes = await engine._tracker.getChangedIDs();
    _(
      `test_sync_partialUpload: Rotary tracker contents at first sync: ${JSON.stringify(
        changes
      )}`
    );
    engine.enabled = true;
    let ping = await sync_engine_and_validate_telem(engine, true);

    ok(!!ping);
    ok(!ping.failureReason);
    equal(ping.engines.length, 1);
    equal(ping.engines[0].name, "rotary");
    ok(!ping.engines[0].incoming);
    ok(!ping.engines[0].failureReason);
    deepEqual(ping.engines[0].outgoing, [
      {
        sent: 234,
        failed: 2,
        failedReasons: [
          { name: "record-no-23", count: 1 },
          { name: "record-no-42", count: 1 },
        ],
      },
    ]);
    collection.post = function () {
      throw new Error("Failure");
    };

    engine._store.items["record-no-1000"] = "Record No. 1000";
    await engine._tracker.addChangedID("record-no-1000", 1000);
    collection.insert("record-no-1000", 1000);

    await engine.setLastSync(123);
    ping = null;

    changes = await engine._tracker.getChangedIDs();
    _(
      `test_sync_partialUpload: Rotary tracker contents at second sync: ${JSON.stringify(
        changes
      )}`
    );
    try {
      // should throw
      await sync_engine_and_validate_telem(
        engine,
        true,
        errPing => (ping = errPing)
      );
    } catch (e) {}
    // It would be nice if we had a more descriptive error for this...
    let uploadFailureError = {
      name: "httperror",
      code: 500,
    };

    ok(!!ping);
    deepEqual(ping.failureReason, uploadFailureError);
    equal(ping.engines.length, 1);
    equal(ping.engines[0].name, "rotary");
    deepEqual(ping.engines[0].incoming, {
      failed: 1,
      failedReasons: [{ name: "No ciphertext: nothing to decrypt?", count: 1 }],
    });
    ok(!ping.engines[0].outgoing);
    deepEqual(ping.engines[0].failureReason, uploadFailureError);
  } finally {
    await cleanAndGo(engine, server);
    await engine.finalize();
  }
});

add_task(async function test_generic_engine_fail() {
  enableValidationPrefs();

  await Service.engineManager.register(SteamEngine);
  let engine = Service.engineManager.get("steam");
  engine.enabled = true;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  let e = new Error("generic failure message");
  engine._errToThrow = e;

  try {
    const changes = await engine._tracker.getChangedIDs();
    _(
      `test_generic_engine_fail: Steam tracker contents: ${JSON.stringify(
        changes
      )}`
    );
    await sync_and_validate_telem(ping => {
      equal(ping.status.service, SYNC_FAILED_PARTIAL);
      deepEqual(ping.engines.find(err => err.name === "steam").failureReason, {
        name: "unexpectederror",
        error: String(e),
      });
    });
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_engine_fail_weird_errors() {
  enableValidationPrefs();
  await Service.engineManager.register(SteamEngine);
  let engine = Service.engineManager.get("steam");
  engine.enabled = true;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  try {
    let msg = "Bad things happened!";
    engine._errToThrow = { message: msg };
    await sync_and_validate_telem(ping => {
      equal(ping.status.service, SYNC_FAILED_PARTIAL);
      deepEqual(ping.engines.find(err => err.name === "steam").failureReason, {
        name: "unexpectederror",
        error: "Bad things happened!",
      });
    });
    let e = { msg };
    engine._errToThrow = e;
    await sync_and_validate_telem(ping => {
      deepEqual(ping.engines.find(err => err.name === "steam").failureReason, {
        name: "unexpectederror",
        error: JSON.stringify(e),
      });
    });
  } finally {
    await cleanAndGo(engine, server);
    Service.engineManager.unregister(engine);
  }
});

add_task(async function test_overrideTelemetryName() {
  enableValidationPrefs(["steam"]);

  await Service.engineManager.register(SteamEngine);
  let engine = Service.engineManager.get("steam");
  engine.overrideTelemetryName = "steam-but-better";
  engine.enabled = true;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  const problemsToReport = [
    { name: "someProblem", count: 123 },
    { name: "anotherProblem", count: 456 },
  ];

  try {
    info("Sync with validation problems");
    engine.problemsToReport = problemsToReport;
    await sync_and_validate_telem(ping => {
      let enginePing = ping.engines.find(e => e.name === "steam-but-better");
      ok(enginePing);
      ok(!ping.engines.find(e => e.name === "steam"));
      delete enginePing.validation.took; // can't compare real times.
      deepEqual(
        enginePing.validation,
        {
          version: 1,
          checked: 0,
          problems: problemsToReport,
        },
        "Should include validation report with overridden name"
      );
    });

    info("Sync without validation problems");
    engine.problemsToReport = null;
    await sync_and_validate_telem(ping => {
      let enginePing = ping.engines.find(e => e.name === "steam-but-better");
      ok(enginePing);
      ok(!ping.engines.find(e => e.name === "steam"));
      ok(
        !enginePing.validation,
        "Should not include validation report when there are no problems"
      );
    });
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_engine_fail_ioerror() {
  enableValidationPrefs();

  await Service.engineManager.register(SteamEngine);
  let engine = Service.engineManager.get("steam");
  engine.enabled = true;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  // create an IOError to re-throw as part of Sync.
  try {
    // (Note that fakeservices.js has replaced Utils.jsonMove etc, but for
    // this test we need the real one so we get real exceptions from the
    // filesystem.)
    await Utils._real_jsonMove("file-does-not-exist", "anything", {});
  } catch (ex) {
    engine._errToThrow = ex;
  }
  ok(engine._errToThrow, "expecting exception");

  try {
    const changes = await engine._tracker.getChangedIDs();
    _(
      `test_engine_fail_ioerror: Steam tracker contents: ${JSON.stringify(
        changes
      )}`
    );
    await sync_and_validate_telem(ping => {
      equal(ping.status.service, SYNC_FAILED_PARTIAL);
      let failureReason = ping.engines.find(
        e => e.name === "steam"
      ).failureReason;
      equal(failureReason.name, "unexpectederror");
      // ensure the profile dir in the exception message has been stripped.
      ok(
        !failureReason.error.includes(PathUtils.profileDir),
        failureReason.error
      );
      ok(failureReason.error.includes("[profileDir]"), failureReason.error);
    });
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_error_detections() {
  let telem = get_sync_test_telemetry();

  // Non-network NS_ERROR_ codes get their own category.
  Assert.deepEqual(
    telem.transformError(Components.Exception("", Cr.NS_ERROR_FAILURE)),
    { name: "nserror", code: Cr.NS_ERROR_FAILURE }
  );

  // Some NS_ERROR_ code in the "network" module are treated as http errors.
  Assert.deepEqual(
    telem.transformError(Components.Exception("", Cr.NS_ERROR_UNKNOWN_HOST)),
    { name: "httperror", code: Cr.NS_ERROR_UNKNOWN_HOST }
  );
  // Some NS_ERROR_ABORT is treated as network by our telemetry.
  Assert.deepEqual(
    telem.transformError(Components.Exception("", Cr.NS_ERROR_ABORT)),
    { name: "httperror", code: Cr.NS_ERROR_ABORT }
  );
});

add_task(async function test_clean_urls() {
  enableValidationPrefs();

  await Service.engineManager.register(SteamEngine);
  let engine = Service.engineManager.get("steam");
  engine.enabled = true;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  engine._errToThrow = new TypeError(
    "http://www.google .com is not a valid URL."
  );

  try {
    const changes = await engine._tracker.getChangedIDs();
    _(`test_clean_urls: Steam tracker contents: ${JSON.stringify(changes)}`);
    await sync_and_validate_telem(ping => {
      equal(ping.status.service, SYNC_FAILED_PARTIAL);
      let failureReason = ping.engines.find(
        e => e.name === "steam"
      ).failureReason;
      equal(failureReason.name, "unexpectederror");
      equal(failureReason.error, "<URL> is not a valid URL.");
    });
    // Handle other errors that include urls.
    engine._errToThrow =
      "Other error message that includes some:url/foo/bar/ in it.";
    await sync_and_validate_telem(ping => {
      equal(ping.status.service, SYNC_FAILED_PARTIAL);
      let failureReason = ping.engines.find(
        e => e.name === "steam"
      ).failureReason;
      equal(failureReason.name, "unexpectederror");
      equal(
        failureReason.error,
        "Other error message that includes <URL> in it."
      );
    });
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

// Test sanitizing guid-related errors with the pattern of <guid: {guid}>
add_task(async function test_sanitize_bookmarks_guid() {
  let { ErrorSanitizer } = ChromeUtils.importESModule(
    "resource://services-sync/telemetry.sys.mjs"
  );

  for (let [original, expected] of [
    [
      "Can't insert Bookmark <guid: sknD84IdnSY2> into Folder <guid: odfninDdi93_3>",
      "Can't insert Bookmark <GUID> into Folder <GUID>",
    ],
    [
      "Merge Error: Item <guid: H6fmPA16gZs9> can't contain itself",
      "Merge Error: Item <GUID> can't contain itself",
    ],
  ]) {
    const sanitized = ErrorSanitizer.cleanErrorMessage(original);
    Assert.equal(sanitized, expected);
  }
});

// Test sanitization of some hard-coded error strings.
add_task(async function test_clean_errors() {
  let { ErrorSanitizer } = ChromeUtils.importESModule(
    "resource://services-sync/telemetry.sys.mjs"
  );

  for (let [message, name, expected] of [
    [
      `Could not open the file at ${PathUtils.join(
        PathUtils.profileDir,
        "weave",
        "addonsreconciler.json"
      )} for writing`,
      "NotFoundError",
      "OS error [File/Path not found] Could not open the file at [profileDir]/weave/addonsreconciler.json for writing",
    ],
    [
      `Could not get info for the file at ${PathUtils.join(
        PathUtils.profileDir,
        "weave",
        "addonsreconciler.json"
      )}`,
      "NotAllowedError",
      "OS error [Permission denied] Could not get info for the file at [profileDir]/weave/addonsreconciler.json",
    ],
  ]) {
    const error = new DOMException(message, name);
    const sanitized = ErrorSanitizer.cleanErrorMessage(message, error);
    Assert.equal(sanitized, expected);
  }
});

// Arrange for a sync to hit a "real" OS error during a sync and make sure it's sanitized.
add_task(async function test_clean_real_os_error() {
  enableValidationPrefs();

  // Simulate a real error.
  await Service.engineManager.register(SteamEngine);
  let engine = Service.engineManager.get("steam");
  engine.enabled = true;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  let path = PathUtils.join(PathUtils.profileDir, "no", "such", "path.json");
  try {
    await IOUtils.readJSON(path);
    throw new Error("should fail to read the file");
  } catch (ex) {
    engine._errToThrow = ex;
  }

  try {
    const changes = await engine._tracker.getChangedIDs();
    _(`test_clean_urls: Steam tracker contents: ${JSON.stringify(changes)}`);
    await sync_and_validate_telem(ping => {
      equal(ping.status.service, SYNC_FAILED_PARTIAL);
      let failureReason = ping.engines.find(
        e => e.name === "steam"
      ).failureReason;
      equal(failureReason.name, "unexpectederror");
      equal(
        failureReason.error,
        "OS error [File/Path not found] Could not open `[profileDir]/no/such/path.json': file does not exist"
      );
    });
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_initial_sync_engines() {
  enableValidationPrefs();

  await Service.engineManager.register(SteamEngine);
  let engine = Service.engineManager.get("steam");
  engine.enabled = true;
  // These are the only ones who actually have things to sync at startup.
  let telemetryEngineNames = ["clients", "prefs", "tabs", "bookmarks-buffered"];
  let server = await serverForEnginesWithKeys(
    { foo: "password" },
    ["bookmarks", "prefs", "tabs"].map(name => Service.engineManager.get(name))
  );
  await SyncTestingInfrastructure(server);
  try {
    const changes = await engine._tracker.getChangedIDs();
    _(
      `test_initial_sync_engines: Steam tracker contents: ${JSON.stringify(
        changes
      )}`
    );
    let ping = await wait_for_ping(() => Service.sync(), true);

    equal(ping.engines.find(e => e.name === "clients").outgoing[0].sent, 1);
    equal(ping.engines.find(e => e.name === "tabs").outgoing[0].sent, 1);

    // for the rest we don't care about specifics
    for (let e of ping.engines) {
      if (!telemetryEngineNames.includes(e.name)) {
        continue;
      }
      greaterOrEqual(e.took, 0);
      ok(!!e.outgoing);
      equal(e.outgoing.length, 1);
      notEqual(e.outgoing[0].sent, undefined);
      equal(e.outgoing[0].failed, undefined);
      equal(e.outgoing[0].failedReasons, undefined);
    }
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_nserror() {
  enableValidationPrefs();

  await Service.engineManager.register(SteamEngine);
  let engine = Service.engineManager.get("steam");
  engine.enabled = true;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  engine._errToThrow = Components.Exception(
    "NS_ERROR_UNKNOWN_HOST",
    Cr.NS_ERROR_UNKNOWN_HOST
  );
  try {
    const changes = await engine._tracker.getChangedIDs();
    _(`test_nserror: Steam tracker contents: ${JSON.stringify(changes)}`);
    await sync_and_validate_telem(ping => {
      deepEqual(ping.status, {
        service: SYNC_FAILED_PARTIAL,
        sync: LOGIN_FAILED_NETWORK_ERROR,
      });
      let enginePing = ping.engines.find(e => e.name === "steam");
      deepEqual(enginePing.failureReason, {
        name: "httperror",
        code: Cr.NS_ERROR_UNKNOWN_HOST,
      });
    });
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_sync_why() {
  enableValidationPrefs();

  await Service.engineManager.register(SteamEngine);
  let engine = Service.engineManager.get("steam");
  engine.enabled = true;
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  let e = new Error("generic failure message");
  engine._errToThrow = e;

  try {
    const changes = await engine._tracker.getChangedIDs();
    _(
      `test_generic_engine_fail: Steam tracker contents: ${JSON.stringify(
        changes
      )}`
    );
    let ping = await wait_for_ping(
      () => Service.sync({ why: "user" }),
      true,
      false
    );
    _(JSON.stringify(ping));
    equal(ping.why, "user");
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_discarding() {
  enableValidationPrefs();

  let helper = track_collections_helper();
  let upd = helper.with_updated_collection;
  let telem = get_sync_test_telemetry();
  telem.maxPayloadCount = 2;
  telem.submissionInterval = Infinity;
  let oldSubmit = telem.submit;

  let server;
  try {
    let handlers = {
      "/1.1/johndoe/info/collections": helper.handler,
      "/1.1/johndoe/storage/crypto/keys": upd(
        "crypto",
        new ServerWBO("keys").handler()
      ),
      "/1.1/johndoe/storage/meta/global": upd(
        "meta",
        new ServerWBO("global").handler()
      ),
    };

    let collections = [
      "clients",
      "bookmarks",
      "forms",
      "history",
      "passwords",
      "prefs",
      "tabs",
    ];

    for (let coll of collections) {
      handlers["/1.1/johndoe/storage/" + coll] = upd(
        coll,
        new ServerCollection({}, true).handler()
      );
    }

    server = httpd_setup(handlers);
    await configureIdentity({ username: "johndoe" }, server);
    telem.submit = p =>
      ok(
        false,
        "Submitted telemetry ping when we should not have" + JSON.stringify(p)
      );

    for (let i = 0; i < 5; ++i) {
      await Service.sync();
    }
    telem.submit = oldSubmit;
    telem.submissionInterval = -1;
    let ping = await wait_for_ping(() => Service.sync(), true, true); // with this we've synced 6 times
    equal(ping.syncs.length, 2);
    equal(ping.discarded, 4);
  } finally {
    telem.maxPayloadCount = 500;
    telem.submissionInterval = -1;
    telem.submit = oldSubmit;
    if (server) {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_no_foreign_engines_in_error_ping() {
  enableValidationPrefs();

  await Service.engineManager.register(BogusEngine);
  let engine = Service.engineManager.get("bogus");
  engine.enabled = true;
  let server = await serverForFoo(engine);
  engine._errToThrow = new Error("Oh no!");
  await SyncTestingInfrastructure(server);
  try {
    await sync_and_validate_telem(ping => {
      equal(ping.status.service, SYNC_FAILED_PARTIAL);
      ok(ping.engines.every(e => e.name !== "bogus"));
    });
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_no_foreign_engines_in_success_ping() {
  enableValidationPrefs();

  await Service.engineManager.register(BogusEngine);
  let engine = Service.engineManager.get("bogus");
  engine.enabled = true;
  let server = await serverForFoo(engine);

  await SyncTestingInfrastructure(server);
  try {
    await sync_and_validate_telem(ping => {
      ok(ping.engines.every(e => e.name !== "bogus"));
    });
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_no_ping_for_self_hosters() {
  enableValidationPrefs();

  let telem = get_sync_test_telemetry();
  let oldSubmit = telem.submit;

  await Service.engineManager.register(BogusEngine);
  let engine = Service.engineManager.get("bogus");
  engine.enabled = true;
  let server = await serverForFoo(engine);

  await SyncTestingInfrastructure(server);
  try {
    let submitPromise = new Promise(resolve => {
      telem.submit = function () {
        let result = oldSubmit.apply(this, arguments);
        resolve(result);
      };
    });
    await Service.sync();
    let pingSubmitted = await submitPromise;
    // The Sync testing infrastructure already sets up a custom token server,
    // so we don't need to do anything to simulate a self-hosted user.
    ok(!pingSubmitted, "Should not submit ping with custom token server URL");
  } finally {
    telem.submit = oldSubmit;
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_fxa_device_telem() {
  let t = get_sync_test_telemetry();
  let syncEnabled = true;
  let oldGetClientsEngineRecords = t.getClientsEngineRecords;
  let oldGetFxaDevices = t.getFxaDevices;
  let oldSyncIsEnabled = t.syncIsEnabled;
  let oldSanitizeFxaDeviceId = t.sanitizeFxaDeviceId;
  t.syncIsEnabled = () => syncEnabled;
  t.sanitizeFxaDeviceId = id => `So clean: ${id}`;
  try {
    let keep0 = Utils.makeGUID();
    let keep1 = Utils.makeGUID();
    let keep2 = Utils.makeGUID();
    let curdev = Utils.makeGUID();

    let keep1Sync = Utils.makeGUID();
    let keep2Sync = Utils.makeGUID();
    let curdevSync = Utils.makeGUID();
    let fxaDevices = [
      {
        id: curdev,
        isCurrentDevice: true,
        lastAccessTime: Date.now() - 1000 * 60 * 60 * 24 * 1,
        pushEndpointExpired: false,
        type: "desktop",
        name: "current device",
      },
      {
        id: keep0,
        isCurrentDevice: false,
        lastAccessTime: Date.now() - 1000 * 60 * 60 * 24 * 10,
        pushEndpointExpired: false,
        type: "mobile",
        name: "dupe",
      },
      // Valid 2
      {
        id: keep1,
        isCurrentDevice: false,
        lastAccessTime: Date.now() - 1000 * 60 * 60 * 24 * 1,
        pushEndpointExpired: false,
        type: "desktop",
        name: "valid2",
      },
      // Valid 3
      {
        id: keep2,
        isCurrentDevice: false,
        lastAccessTime: Date.now() - 1000 * 60 * 60 * 24 * 5,
        pushEndpointExpired: false,
        type: "desktop",
        name: "valid3",
      },
    ];
    let clientInfo = [
      {
        id: keep1Sync,
        fxaDeviceId: keep1,
        os: "Windows 30",
        version: "Firefox 1 million",
      },
      {
        id: keep2Sync,
        fxaDeviceId: keep2,
        os: "firefox, but an os",
        verison: "twelve",
      },
      {
        id: Utils.makeGUID(),
        fxaDeviceId: null,
        os: "apparently ios used to keep write these IDs as null.",
        version: "Doesn't seem to anymore",
      },
      {
        id: curdevSync,
        fxaDeviceId: curdev,
        os: "emacs",
        version: "22",
      },
      {
        id: Utils.makeGUID(),
        fxaDeviceId: Utils.makeGUID(),
        os: "not part of the fxa device set at all",
        version: "foo bar baz",
      },
      // keep0 intententionally omitted.
    ];
    t.getClientsEngineRecords = () => clientInfo;
    let devInfo = t.updateFxaDevices(fxaDevices);
    equal(devInfo.deviceID, t.sanitizeFxaDeviceId(curdev));
    for (let d of devInfo.devices) {
      ok(d.id.startsWith("So clean:"));
      if (d.syncID) {
        ok(d.syncID.startsWith("So clean:"));
      }
    }
    equal(devInfo.devices.length, 4);
    let k0 = devInfo.devices.find(d => d.id == t.sanitizeFxaDeviceId(keep0));
    let k1 = devInfo.devices.find(d => d.id == t.sanitizeFxaDeviceId(keep1));
    let k2 = devInfo.devices.find(d => d.id == t.sanitizeFxaDeviceId(keep2));

    deepEqual(k0, {
      id: t.sanitizeFxaDeviceId(keep0),
      type: "mobile",
      os: undefined,
      version: undefined,
      syncID: undefined,
    });
    deepEqual(k1, {
      id: t.sanitizeFxaDeviceId(keep1),
      type: "desktop",
      os: clientInfo[0].os,
      version: clientInfo[0].version,
      syncID: t.sanitizeFxaDeviceId(keep1Sync),
    });
    deepEqual(k2, {
      id: t.sanitizeFxaDeviceId(keep2),
      type: "desktop",
      os: clientInfo[1].os,
      version: clientInfo[1].version,
      syncID: t.sanitizeFxaDeviceId(keep2Sync),
    });
    let newCurId = Utils.makeGUID();
    // Update the ID
    fxaDevices[0].id = newCurId;

    let keep3 = Utils.makeGUID();
    fxaDevices.push({
      id: keep3,
      isCurrentDevice: false,
      lastAccessTime: Date.now() - 1000 * 60 * 60 * 24 * 1,
      pushEndpointExpired: false,
      type: "desktop",
      name: "valid 4",
    });
    devInfo = t.updateFxaDevices(fxaDevices);

    let afterSubmit = [keep0, keep1, keep2, keep3, newCurId]
      .map(id => t.sanitizeFxaDeviceId(id))
      .sort();
    deepEqual(devInfo.devices.map(d => d.id).sort(), afterSubmit);

    // Reset this, as our override doesn't check for sync being enabled.
    t.sanitizeFxaDeviceId = oldSanitizeFxaDeviceId;
    syncEnabled = false;
    fxAccounts.telemetry._setHashedUID(false);
    devInfo = t.updateFxaDevices(fxaDevices);
    equal(devInfo.deviceID, undefined);
    equal(devInfo.devices.length, 5);
    for (let d of devInfo.devices) {
      equal(d.os, undefined);
      equal(d.version, undefined);
      equal(d.syncID, undefined);
      // Type should still be present.
      notEqual(d.type, undefined);
    }
  } finally {
    t.getClientsEngineRecords = oldGetClientsEngineRecords;
    t.getFxaDevices = oldGetFxaDevices;
    t.syncIsEnabled = oldSyncIsEnabled;
    t.sanitizeFxaDeviceId = oldSanitizeFxaDeviceId;
  }
});

add_task(async function test_sanitize_fxa_device_id() {
  let t = get_sync_test_telemetry();
  fxAccounts.telemetry._setHashedUID(false);
  sinon.stub(t, "syncIsEnabled").callsFake(() => true);
  const rawDeviceId = "raw one two three";
  try {
    equal(t.sanitizeFxaDeviceId(rawDeviceId), null);
    fxAccounts.telemetry._setHashedUID("mock uid");
    const sanitizedDeviceId = t.sanitizeFxaDeviceId(rawDeviceId);
    ok(sanitizedDeviceId);
    notEqual(sanitizedDeviceId, rawDeviceId);
  } finally {
    t.syncIsEnabled.restore();
    fxAccounts.telemetry._setHashedUID(false);
  }
});

add_task(async function test_no_node_type() {
  let server = sync_httpd_setup({});
  await configureIdentity(null, server);

  await sync_and_validate_telem(ping => {
    Assert.strictEqual(ping.syncNodeType, undefined);
  }, true);
  await promiseStopServer(server);
});

add_task(async function test_node_type() {
  Service.identity.logout();
  let server = sync_httpd_setup({});
  await configureIdentity({ node_type: "the-node-type" }, server);

  await sync_and_validate_telem(ping => {
    equal(ping.syncNodeType, "the-node-type");
  }, true);
  await promiseStopServer(server);
});

add_task(async function test_node_type_change() {
  let pingPromise = wait_for_pings(2);

  Service.identity.logout();
  let server = sync_httpd_setup({});
  await configureIdentity({ node_type: "first-node-type" }, server);
  // Default to submitting each hour - we should still submit on node change.
  let telem = get_sync_test_telemetry();
  telem.submissionInterval = 60 * 60 * 1000;
  // reset the node type from previous test or our first sync will submit.
  telem.lastSyncNodeType = null;
  // do 2 syncs with the same node type.
  await Service.sync();
  await Service.sync();
  // then another with a different node type.
  Service.identity.logout();
  await configureIdentity({ node_type: "second-node-type" }, server);
  await Service.sync();
  telem.finish();

  let pings = await pingPromise;
  equal(pings.length, 2);
  equal(pings[0].syncs.length, 2, "2 syncs in first ping");
  equal(pings[0].syncNodeType, "first-node-type");
  equal(pings[1].syncs.length, 1, "1 sync in second ping");
  equal(pings[1].syncNodeType, "second-node-type");
  await promiseStopServer(server);
});

add_task(async function test_ids() {
  let telem = get_sync_test_telemetry();
  Assert.ok(!telem._shouldSubmitForDataChange());
  fxAccounts.telemetry._setHashedUID("new_uid");
  Assert.ok(telem._shouldSubmitForDataChange());
  telem.maybeSubmitForDataChange();
  // now it's been submitted the new uid is current.
  Assert.ok(!telem._shouldSubmitForDataChange());
});

add_task(async function test_deletion_request_ping() {
  async function assertRecordedSyncDeviceID(expected) {
    // The scalar gets updated asynchronously, so wait a tick before checking.
    await Promise.resolve();
    const scalars =
      Services.telemetry.getSnapshotForScalars("deletion-request").parent || {};
    equal(scalars["deletion.request.sync_device_id"], expected);
  }

  const MOCK_HASHED_UID = "00112233445566778899aabbccddeeff";
  const MOCK_DEVICE_ID1 = "ffeeddccbbaa99887766554433221100";
  const MOCK_DEVICE_ID2 = "aabbccddeeff99887766554433221100";

  // Calculated by hand using SHA256(DEVICE_ID + HASHED_UID)[:32]
  const SANITIZED_DEVICE_ID1 = "dd7c845006df9baa1c6d756926519c8c";
  const SANITIZED_DEVICE_ID2 = "0d06919a736fc029007e1786a091882c";

  let currentDeviceID = null;
  sinon.stub(fxAccounts.device, "getLocalId").callsFake(() => {
    return Promise.resolve(currentDeviceID);
  });
  let telem = get_sync_test_telemetry();
  sinon.stub(telem, "isProductionSyncUser").callsFake(() => true);
  fxAccounts.telemetry._setHashedUID(false);
  try {
    // The scalar should start out undefined, since no user is actually logged in.
    await assertRecordedSyncDeviceID(undefined);

    // If we start up without knowing the hashed UID, it should stay undefined.
    telem.observe(null, "weave:service:ready");
    await assertRecordedSyncDeviceID(undefined);

    // But now let's say we've discovered the hashed UID from the server.
    fxAccounts.telemetry._setHashedUID(MOCK_HASHED_UID);
    currentDeviceID = MOCK_DEVICE_ID1;

    // Now when we load up, we'll record the sync device id.
    telem.observe(null, "weave:service:ready");
    await assertRecordedSyncDeviceID(SANITIZED_DEVICE_ID1);

    // When the device-id changes we'll update it.
    currentDeviceID = MOCK_DEVICE_ID2;
    telem.observe(null, "fxaccounts:new_device_id");
    await assertRecordedSyncDeviceID(SANITIZED_DEVICE_ID2);

    // When the user signs out we'll clear it.
    telem.observe(null, "fxaccounts:onlogout");
    await assertRecordedSyncDeviceID("");
  } finally {
    fxAccounts.telemetry._setHashedUID(false);
    telem.isProductionSyncUser.restore();
    fxAccounts.device.getLocalId.restore();
  }
});
