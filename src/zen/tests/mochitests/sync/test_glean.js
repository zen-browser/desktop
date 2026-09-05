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

async function sync_engine(engine, errorRegex = undefined) {
  // Clear out status so failures from previous syncs won't show in the record.
  let { Status } = ChromeUtils.importESModule(
    "resource://services-sync/status.sys.mjs"
  );
  Status._engines = {};
  Status.partial = false;
  // Neuter the scheduler as it interacts badly with some of the tests - the
  // engine being synced usually isn't the registered engine, so we see
  // scored incremented and not removed, which schedules unexpected syncs.
  let oldObserve = Service.scheduler.observe;
  Service.scheduler.observe = () => {};
  try {
    Svc.Obs.notify("weave:service:sync:start");
    let caughtError;
    try {
      await engine.sync();
    } catch (e) {
      caughtError = e;
    }
    if (caughtError) {
      ok(
        errorRegex.test(JSON.stringify(caughtError)),
        "Engine sync error expected."
      );
      Svc.Obs.notify("weave:service:sync:error", caughtError);
    } else {
      ok(!errorRegex, "No engine sync error expected.");
      Svc.Obs.notify("weave:service:sync:finish");
    }
  } finally {
    Service.scheduler.observe = oldObserve;
  }
}

add_setup(async function () {
  // Avoid addon manager complaining about not being initialized
  await Service.engineManager.unregister("addons");
  await Service.engineManager.unregister("extension-storage");

  do_get_profile(); // FOG requires a profile dir.
  Services.fog.initializeFOG();

  // We're not using `wait_for_ping` which means we aren't implicitly calling
  // get_sync_test_telemetry() so often. So call it here for its side effects.
  let telem = get_sync_test_telemetry();
  // Unlike the telemetry tests, we actually want the Glean APIs to be called.
  // So pretend we're in production.
  telem.isProductionSyncUser = () => true;
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

  // Test that a basic batch can make it.
  await GleanPings.sync.testSubmission(
    reason => {
      equal(reason, "schedule");
      Glean.syncs.syncs.testGetValue().forEach(assert_success_sync);
    },
    async () => {
      await Service.sync();
    }
  );

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
    // Make it 10 minutes old so it will only be synced in the toFetch phase.
    bogus_record.modified = Date.now() / 1000 - 60 * 10;
    await engine.setLastSync(Date.now() / 1000 - 60);
    engine.toFetch = new SerializableSet([BOGUS_GUID]);

    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        deepEqual(sync.failureReason, { name: "httperror", code: 500 });
        equal(sync.engines.length, 1);

        const e = sync.engines[0];
        equal(e.name, "bookmarks-buffered");
        deepEqual(e.failureReason, { name: "httperror", code: 500 });
      },
      async () => {
        await sync_engine(engine, /500 Internal Server Error/);
      }
    );
  } finally {
    await store.wipe();
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_uploading() {
  // Clear out status, so failures from previous syncs won't show up in the
  // telemetry ping.
  let { Status } = ChromeUtils.importESModule(
    "resource://services-sync/status.sys.mjs"
  );
  Status._engines = {};
  Status.partial = false;

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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.engines.length, 1);

        const e = sync.engines[0];
        equal(e.name, "bookmarks-buffered");
        greater(e.outgoing[0].sent, 0);
        ok(!e.incoming);
      },
      async () => {
        await sync_engine(engine);
      }
    );

    await PlacesUtils.bookmarks.update({
      guid: bmk.guid,
      title: "New Title",
    });

    await store.wipe();
    await engine.resetClient();
    // We don't sync via the service, so don't re-hit info/collections, so
    // lastModified remaning at zero breaks things subtly...
    engine.lastModified = null;

    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.engines.length, 1);

        const e = sync.engines[0];
        equal(e.name, "bookmarks-buffered");
        equal(e.outgoing.length, 1);
        ok(!!e.incoming);
      },
      async () => {
        await sync_engine(engine);
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.engines.length, 1);

        const e = sync.engines[0];
        equal(e.incoming, null);
        deepEqual(e.outgoing, [
          {
            sent: 3,
            failed: 2,
            failedReasons: [
              { name: "scotsman", count: 1 },
              { name: "peppercorn", count: 1 },
            ],
          },
        ]);
      },
      async () => {
        await sync_engine(engine);
      }
    );

    await engine.setLastSync(123);

    changes = await engine._tracker.getChangedIDs();
    _(
      `test_upload_failed: Rotary tracker contents at second sync: ${JSON.stringify(
        changes
      )}`
    );
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.engines.length, 1);

        const e = sync.engines[0];
        deepEqual(e.outgoing, [
          {
            sent: 2,
            failed: 2,
            failedReasons: [
              { name: "scotsman", count: 1 },
              { name: "peppercorn", count: 1 },
            ],
          },
        ]);
      },
      async () => {
        await sync_engine(engine);
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        ok(!sync.failureReason);
        equal(sync.engines.length, 1);

        const e = sync.engines[0];
        equal(e.name, "rotary");
        ok(!e.incoming);
        ok(!e.failureReason);
        deepEqual(e.outgoing, [
          {
            sent: 234,
            failed: 2,
            failedReasons: [
              { name: "record-no-23", count: 1 },
              { name: "record-no-42", count: 1 },
            ],
          },
        ]);
      },
      async () => {
        await sync_engine(engine);
      }
    );

    collection.post = function () {
      throw new Error("Failure");
    };

    engine._store.items["record-no-1000"] = "Record No. 1000";
    await engine._tracker.addChangedID("record-no-1000", 1000);
    collection.insert("record-no-1000", 1000);

    await engine.setLastSync(123);

    changes = await engine._tracker.getChangedIDs();
    _(
      `test_sync_partialUpload: Rotary tracker contents at second sync: ${JSON.stringify(
        changes
      )}`
    );
    // It would be nice if we had a more descriptive error for this...
    const uploadFailureError = {
      name: "httperror",
      code: 500,
    };
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        deepEqual(sync.failureReason, uploadFailureError);
        equal(sync.engines.length, 1);

        const e = sync.engines[0];
        equal(e.name, "rotary");
        deepEqual(e.incoming, {
          failed: 1,
          failedReasons: [
            { name: "No ciphertext: nothing to decrypt?", count: 1 },
          ],
        });
        ok(!e.outgoing);
        deepEqual(e.failureReason, uploadFailureError);
      },
      async () => {
        await sync_engine(engine, /500 Internal Server Error/);
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.status.service, SYNC_FAILED_PARTIAL);
        deepEqual(
          sync.engines.find(err => err.name === "steam").failureReason,
          {
            name: "unexpectederror",
            error: String(e),
          }
        );
      },
      async () => {
        await Service.sync();
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.status.service, SYNC_FAILED_PARTIAL);
        deepEqual(
          sync.engines.find(err => err.name === "steam").failureReason,
          {
            name: "unexpectederror",
            error: msg,
          }
        );
      },
      async () => {
        await Service.sync();
      }
    );
    let e = { msg };
    engine._errToThrow = e;
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.status.service, SYNC_FAILED_PARTIAL);
        deepEqual(
          sync.engines.find(err => err.name === "steam").failureReason,
          {
            name: "unexpectederror",
            error: JSON.stringify(e),
          }
        );
      },
      async () => {
        await Service.sync();
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        ok(!sync.engines.find(e => e.name === "steam"));
        const eng = sync.engines.find(e => e.name === "steam-but-better");
        ok(eng);
        delete eng.validation.took; // can't compare real times.
        deepEqual(
          eng.validation,
          {
            version: 1,
            checked: 0,
            problems: problemsToReport,
          },
          "Should include validation report with overridden name"
        );
      },
      async () => {
        await Service.sync();
      }
    );

    info("Sync without validation problems");
    engine.problemsToReport = null;
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        ok(!sync.engines.find(e => e.name === "steam"));
        const eng = sync.engines.find(e => e.name === "steam-but-better");
        ok(eng);
        ok(
          !eng.validation,
          "Should not include validation report when there are no problems"
        );
      },
      async () => {
        await Service.sync();
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.status.service, SYNC_FAILED_PARTIAL);
        const failureReason = sync.engines.find(
          e => e.name === "steam"
        ).failureReason;
        equal(failureReason.name, "unexpectederror");
        // ensure the profile dir in the exception message has been stripped.
        ok(
          !failureReason.error.includes(PathUtils.profileDir),
          failureReason.error
        );
        ok(failureReason.error.includes("[profileDir]"), failureReason.error);
      },
      async () => {
        await Service.sync();
      }
    );
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.status.service, SYNC_FAILED_PARTIAL);
        const failureReason = sync.engines.find(
          e => e.name === "steam"
        ).failureReason;
        equal(failureReason.name, "unexpectederror");
        equal(failureReason.error, "<URL> is not a valid URL.");
      },
      async () => {
        await Service.sync();
      }
    );
    // Handle other errors that include urls.
    engine._errToThrow =
      "Other error message that includes some:url/foo/bar/ in it.";
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.status.service, SYNC_FAILED_PARTIAL);
        const failureReason = sync.engines.find(
          e => e.name === "steam"
        ).failureReason;
        equal(failureReason.name, "unexpectederror");
        equal(
          failureReason.error,
          "Other error message that includes <URL> in it."
        );
      },
      async () => {
        await Service.sync();
      }
    );
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.status.service, SYNC_FAILED_PARTIAL);
        const failureReason = sync.engines.find(
          e => e.name === "steam"
        ).failureReason;
        equal(failureReason.name, "unexpectederror");
        equal(
          failureReason.error,
          "OS error [File/Path not found] Could not open `[profileDir]/no/such/path.json': file does not exist"
        );
      },
      async () => {
        await Service.sync();
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.engines.find(e => e.name === "clients").outgoing[0].sent, 1);
        equal(sync.engines.find(e => e.name === "tabs").outgoing[0].sent, 1);

        sync.engines
          .filter(e => telemetryEngineNames.includes(e.name))
          .forEach(e => {
            greaterOrEqual(e.took, 0);
            ok(!!e.outgoing);
            equal(e.outgoing.length, 1);
            notEqual(e.outgoing[0].sent, undefined);
            equal(e.outgoing[0].failed, undefined);
            equal(e.outgoing[0].failedReasons, undefined);
          });
      },
      async () => {
        await Service.sync();
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        deepEqual(sync.status, {
          service: SYNC_FAILED_PARTIAL,
          sync: LOGIN_FAILED_NETWORK_ERROR,
        });
        const eng = sync.engines.find(e => e.name === "steam");
        deepEqual(eng.failureReason, {
          name: "httperror",
          code: Cr.NS_ERROR_UNKNOWN_HOST,
        });
      },
      async () => {
        await Service.sync();
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.hashedFxaUid.testGetValue(), "f".repeat(32));

        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);

        const sync = syncs[0];
        equal(sync.why, "user");
      },
      async () => {
        await Service.sync({ why: "user" });
      }
    );
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
    GleanPings.sync.testBeforeNextSubmit(() => {
      ok(false, "Submitted telemetry ping when we should not have.");
    });

    for (let i = 0; i < 5; ++i) {
      await Service.sync();
    }
    telem.submissionInterval = -1;

    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        equal(Glean.syncs.discarded.testGetValue(), 4);
        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 2);
        syncs.forEach(assert_success_sync);
      },
      async () => {
        await Service.sync(); // Sixth time's the charm.
      }
    );
  } finally {
    telem.maxPayloadCount = 500;
    telem.submissionInterval = -1;
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);
        const sync = syncs[0];
        equal(sync.status.service, SYNC_FAILED_PARTIAL);
        ok(sync.engines.every(e => e.name !== "bogus"));
      },
      async () => {
        await Service.sync();
      }
    );
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
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "schedule");
        const syncs = Glean.syncs.syncs.testGetValue();
        equal(syncs.length, 1);
        const sync = syncs[0];
        ok(sync.engines.every(e => e.name !== "bogus"));
      },
      async () => {
        await Service.sync();
      }
    );
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_no_node_type() {
  let server = sync_httpd_setup({});
  await configureIdentity(null, server);

  await GleanPings.sync.testSubmission(
    reason => {
      equal(reason, "schedule");
      Assert.strictEqual(Glean.syncs.syncNodeType.testGetValue(), null);
    },
    async () => {
      await Service.sync();
    }
  );
  await promiseStopServer(server);
});

add_task(async function test_node_type() {
  Service.identity.logout();
  let server = sync_httpd_setup({});
  await configureIdentity({ node_type: "the-node-type" }, server);

  await GleanPings.sync.testSubmission(
    reason => {
      equal(reason, "schedule");
      equal(Glean.syncs.syncNodeType.testGetValue(), "the-node-type");
    },
    async () => {
      await Service.sync();
    }
  );
  await promiseStopServer(server);
});

add_task(async function test_node_type_change() {
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
  await GleanPings.sync.testSubmission(
    () => {
      equal(
        Glean.syncs.syncs.testGetValue().length,
        2,
        "2 syncs in first ping"
      );
      equal(Glean.syncs.syncNodeType.testGetValue(), "first-node-type");
    },
    async () => {
      await Service.sync();
    }
  );
  await GleanPings.sync.testSubmission(
    () => {
      equal(
        Glean.syncs.syncs.testGetValue().length,
        1,
        "1 sync in second ping"
      );
      equal(Glean.syncs.syncNodeType.testGetValue(), "second-node-type");
    },
    async () => {
      telem.finish();
    }
  );
  await promiseStopServer(server);
});

add_task(async function test_uid_change() {
  enableValidationPrefs();

  await Service.engineManager.register(BogusEngine);
  let engine = Service.engineManager.get("bogus");
  engine.enabled = true;
  let server = await serverForFoo(engine);

  await SyncTestingInfrastructure(server);
  let telem = get_sync_test_telemetry();
  telem.maxPayloadCount = 500;
  telem.submissionInterval = Infinity;

  // a sync with the "old" uid.
  await Service.sync();

  fxAccounts.telemetry._setHashedUID("deadbeef");

  try {
    await GleanPings.sync.testSubmission(
      reason => {
        equal(reason, "idchange");
        equal(
          Glean.syncs.syncs.testGetValue().length,
          1,
          "first sync in its own ping"
        );
      },
      async () => {
        await Service.sync();
      }
    );
    await GleanPings.sync.testSubmission(
      () => {
        equal(
          Glean.syncs.syncs.testGetValue().length,
          1,
          "second sync in its own ping"
        );
      },
      async () => {
        telem.finish();
      }
    );
  } finally {
    await cleanAndGo(engine, server);
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_deletion_request_ping() {
  async function assertRecordedSyncDeviceID(expected) {
    // `onAccountInitOrChange` sets the id asynchronously, so wait a tick.
    await Promise.resolve();
    equal(Glean.deletionRequest.syncDeviceId.testGetValue(), expected);
  }
  Services.fog.testResetFOG();

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
    await assertRecordedSyncDeviceID(null);

    // If we start up without knowing the hashed UID, it should stay undefined.
    telem.observe(null, "weave:service:ready");
    await assertRecordedSyncDeviceID(null);

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

// TODO: Is the topic `"weave:telemetry:migration"` presently hooked up?
add_task(async function test_migration() {
  let telem = get_sync_test_telemetry();
  const migrationInfo = {
    entries: 42,
    entries_successful: 42,
    extensions: 84,
    extensions_successful: 83,
    openFailure: false,
  };
  telem._addMigrationRecord("webext-storage", migrationInfo);
  await GleanPings.sync.testSubmission(
    () => {
      const migrations = Glean.syncs.migrations.testGetValue();
      equal(migrations.length, 1);
      deepEqual(migrations[0], {
        migration_type: "webext-storage",
        entries: 42,
        entriesSuccessful: 42,
        extensions: 84,
        extensionsSuccessful: 83,
        openFailure: false,
      });
    },
    () => {
      telem.finish();
    }
  );
});
