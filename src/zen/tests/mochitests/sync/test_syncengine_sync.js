/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Weave } = ChromeUtils.importESModule(
  "resource://services-sync/main.sys.mjs"
);
const { WBORecord } = ChromeUtils.importESModule(
  "resource://services-sync/record.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { RotaryEngine } = ChromeUtils.importESModule(
  "resource://testing-common/services/sync/rotaryengine.sys.mjs"
);

function makeRotaryEngine() {
  return new RotaryEngine(Service);
}

async function clean(engine) {
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  Svc.PrefBranch.setStringPref("log.logger.engine.rotary", "Trace");
  Service.recordManager.clearCache();
  await engine._tracker.clearChangedIDs();
  await engine.finalize();
}

async function cleanAndGo(engine, server) {
  await clean(engine);
  await promiseStopServer(server);
}

async function promiseClean(engine, server) {
  await clean(engine);
  await promiseStopServer(server);
}

async function createServerAndConfigureClient() {
  let engine = new RotaryEngine(Service);
  let syncID = await engine.resetLocalSyncID();

  let contents = {
    meta: {
      global: { engines: { rotary: { version: engine.version, syncID } } },
    },
    crypto: {},
    rotary: {},
  };

  const USER = "foo";
  let server = new SyncServer();
  server.registerUser(USER, "password");
  server.createContents(USER, contents);
  server.start();

  await SyncTestingInfrastructure(server, USER);
  Service._updateCachedURLs();

  return [engine, server, USER];
}

/*
 * Tests
 *
 * SyncEngine._sync() is divided into four rather independent steps:
 *
 * - _syncStartup()
 * - _processIncoming()
 * - _uploadOutgoing()
 * - _syncFinish()
 *
 * In the spirit of unit testing, these are tested individually for
 * different scenarios below.
 */

add_task(async function setup() {
  await generateNewKeys(Service.collectionKeys);
  Svc.PrefBranch.setStringPref("log.logger.engine.rotary", "Trace");
});

add_task(async function test_syncStartup_emptyOrOutdatedGlobalsResetsSync() {
  _(
    "SyncEngine._syncStartup resets sync and wipes server data if there's no or an outdated global record"
  );

  // Some server side data that's going to be wiped
  let collection = new ServerCollection();
  collection.insert(
    "flying",
    encryptPayload({ id: "flying", denomination: "LNER Class A3 4472" })
  );
  collection.insert(
    "scotsman",
    encryptPayload({ id: "scotsman", denomination: "Flying Scotsman" })
  );

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let engine = makeRotaryEngine();
  engine._store.items = { rekolok: "Rekonstruktionslokomotive" };
  try {
    // Confirm initial environment
    const changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.rekolok, undefined);
    let metaGlobal = await Service.recordManager.get(engine.metaURL);
    Assert.equal(metaGlobal.payload.engines, undefined);
    Assert.ok(!!collection.payload("flying"));
    Assert.ok(!!collection.payload("scotsman"));

    await engine.setLastSync(Date.now() / 1000);

    // Trying to prompt a wipe -- we no longer track CryptoMeta per engine,
    // so it has nothing to check.
    await engine._syncStartup();

    // The meta/global WBO has been filled with data about the engine
    let engineData = metaGlobal.payload.engines.rotary;
    Assert.equal(engineData.version, engine.version);
    Assert.equal(engineData.syncID, await engine.getSyncID());

    // Sync was reset and server data was wiped
    Assert.equal(await engine.getLastSync(), 0);
    Assert.equal(collection.payload("flying"), undefined);
    Assert.equal(collection.payload("scotsman"), undefined);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_syncStartup_serverHasNewerVersion() {
  _("SyncEngine._syncStartup ");

  let global = new ServerWBO("global", {
    engines: { rotary: { version: 23456 } },
  });
  let server = httpd_setup({
    "/1.1/foo/storage/meta/global": global.handler(),
  });

  await SyncTestingInfrastructure(server);

  let engine = makeRotaryEngine();
  try {
    // The server has a newer version of the data and our engine can
    // handle.  That should give us an exception.
    let error;
    try {
      await engine._syncStartup();
    } catch (ex) {
      error = ex;
    }
    Assert.equal(error.failureCode, VERSION_OUT_OF_DATE);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_syncStartup_syncIDMismatchResetsClient() {
  _("SyncEngine._syncStartup resets sync if syncIDs don't match");

  let server = sync_httpd_setup({});

  await SyncTestingInfrastructure(server);

  // global record with a different syncID than our engine has
  let engine = makeRotaryEngine();
  let global = new ServerWBO("global", {
    engines: { rotary: { version: engine.version, syncID: "foobar" } },
  });
  server.registerPathHandler("/1.1/foo/storage/meta/global", global.handler());

  try {
    // Confirm initial environment
    Assert.equal(await engine.getSyncID(), "");
    const changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.rekolok, undefined);

    await engine.setLastSync(Date.now() / 1000);
    await engine._syncStartup();

    // The engine has assumed the server's syncID
    Assert.equal(await engine.getSyncID(), "foobar");

    // Sync was reset
    Assert.equal(await engine.getLastSync(), 0);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_processIncoming_emptyServer() {
  _("SyncEngine._processIncoming working with an empty server backend");

  let collection = new ServerCollection();
  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let engine = makeRotaryEngine();
  try {
    // Merely ensure that this code path is run without any errors
    await engine._processIncoming();
    Assert.equal(await engine.getLastSync(), 0);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_processIncoming_createFromServer() {
  _("SyncEngine._processIncoming creates new records from server data");

  // Some server records that will be downloaded
  let collection = new ServerCollection();
  collection.insert(
    "flying",
    encryptPayload({ id: "flying", denomination: "LNER Class A3 4472" })
  );
  collection.insert(
    "scotsman",
    encryptPayload({ id: "scotsman", denomination: "Flying Scotsman" })
  );

  // Two pathological cases involving relative URIs gone wrong.
  let pathologicalPayload = encryptPayload({
    id: "../pathological",
    denomination: "Pathological Case",
  });
  collection.insert("../pathological", pathologicalPayload);

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
    "/1.1/foo/storage/rotary/flying": collection.wbo("flying").handler(),
    "/1.1/foo/storage/rotary/scotsman": collection.wbo("scotsman").handler(),
  });

  await SyncTestingInfrastructure(server);

  await generateNewKeys(Service.collectionKeys);

  let engine = makeRotaryEngine();
  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  try {
    // Confirm initial environment
    Assert.equal(await engine.getLastSync(), 0);
    Assert.equal(engine.lastModified, null);
    Assert.equal(engine._store.items.flying, undefined);
    Assert.equal(engine._store.items.scotsman, undefined);
    Assert.equal(engine._store.items["../pathological"], undefined);

    await engine._syncStartup();
    await engine._processIncoming();

    // Timestamps of last sync and last server modification are set.
    Assert.greater(await engine.getLastSync(), 0);
    Assert.greater(engine.lastModified, 0);

    // Local records have been created from the server data.
    Assert.equal(engine._store.items.flying, "LNER Class A3 4472");
    Assert.equal(engine._store.items.scotsman, "Flying Scotsman");
    Assert.equal(engine._store.items["../pathological"], "Pathological Case");
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_processIncoming_reconcile() {
  _("SyncEngine._processIncoming updates local records");

  let collection = new ServerCollection();

  // This server record is newer than the corresponding client one,
  // so it'll update its data.
  collection.insert(
    "newrecord",
    encryptPayload({ id: "newrecord", denomination: "New stuff..." })
  );

  // This server record is newer than the corresponding client one,
  // so it'll update its data.
  collection.insert(
    "newerserver",
    encryptPayload({ id: "newerserver", denomination: "New data!" })
  );

  // This server record is 2 mins older than the client counterpart
  // but identical to it, so we're expecting the client record's
  // changedID to be reset.
  collection.insert(
    "olderidentical",
    encryptPayload({
      id: "olderidentical",
      denomination: "Older but identical",
    })
  );
  collection._wbos.olderidentical.modified -= 120;

  // This item simply has different data than the corresponding client
  // record (which is unmodified), so it will update the client as well
  collection.insert(
    "updateclient",
    encryptPayload({ id: "updateclient", denomination: "Get this!" })
  );

  // This is a dupe of 'original'.
  collection.insert(
    "duplication",
    encryptPayload({ id: "duplication", denomination: "Original Entry" })
  );

  // This record is marked as deleted, so we're expecting the client
  // record to be removed.
  collection.insert(
    "nukeme",
    encryptPayload({ id: "nukeme", denomination: "Nuke me!", deleted: true })
  );

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let engine = makeRotaryEngine();
  engine._store.items = {
    newerserver: "New data, but not as new as server!",
    olderidentical: "Older but identical",
    updateclient: "Got data?",
    original: "Original Entry",
    long_original: "Long Original Entry",
    nukeme: "Nuke me!",
  };
  // Make this record 1 min old, thus older than the one on the server
  await engine._tracker.addChangedID("newerserver", Date.now() / 1000 - 60);
  // This record has been changed 2 mins later than the one on the server
  await engine._tracker.addChangedID("olderidentical", Date.now() / 1000);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  try {
    // Confirm initial environment
    Assert.equal(engine._store.items.newrecord, undefined);
    Assert.equal(
      engine._store.items.newerserver,
      "New data, but not as new as server!"
    );
    Assert.equal(engine._store.items.olderidentical, "Older but identical");
    Assert.equal(engine._store.items.updateclient, "Got data?");
    Assert.equal(engine._store.items.nukeme, "Nuke me!");
    let changes = await engine._tracker.getChangedIDs();
    Assert.greater(changes.olderidentical, 0);

    await engine._syncStartup();
    await engine._processIncoming();

    // Timestamps of last sync and last server modification are set.
    Assert.greater(await engine.getLastSync(), 0);
    Assert.greater(engine.lastModified, 0);

    // The new record is created.
    Assert.equal(engine._store.items.newrecord, "New stuff...");

    // The 'newerserver' record is updated since the server data is newer.
    Assert.equal(engine._store.items.newerserver, "New data!");

    // The data for 'olderidentical' is identical on the server, so
    // it's no longer marked as changed anymore.
    Assert.equal(engine._store.items.olderidentical, "Older but identical");
    changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.olderidentical, undefined);

    // Updated with server data.
    Assert.equal(engine._store.items.updateclient, "Get this!");

    // The incoming ID is preferred.
    Assert.equal(engine._store.items.original, undefined);
    Assert.equal(engine._store.items.duplication, "Original Entry");
    Assert.notEqual(engine._delete.ids.indexOf("original"), -1);

    // The 'nukeme' record marked as deleted is removed.
    Assert.equal(engine._store.items.nukeme, undefined);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_processIncoming_reconcile_local_deleted() {
  _("Ensure local, duplicate ID is deleted on server.");

  // When a duplicate is resolved, the local ID (which is never taken) should
  // be deleted on the server.
  let [engine, server, user] = await createServerAndConfigureClient();

  let now = Date.now() / 1000 - 10;
  await engine.setLastSync(now);
  engine.lastModified = now + 1;

  let record = encryptPayload({
    id: "DUPE_INCOMING",
    denomination: "incoming",
  });
  let wbo = new ServerWBO("DUPE_INCOMING", record, now + 2);
  server.insertWBO(user, "rotary", wbo);

  record = encryptPayload({ id: "DUPE_LOCAL", denomination: "local" });
  wbo = new ServerWBO("DUPE_LOCAL", record, now - 1);
  server.insertWBO(user, "rotary", wbo);

  await engine._store.create({ id: "DUPE_LOCAL", denomination: "local" });
  Assert.ok(await engine._store.itemExists("DUPE_LOCAL"));
  Assert.equal("DUPE_LOCAL", await engine._findDupe({ id: "DUPE_INCOMING" }));

  await engine._sync();

  do_check_attribute_count(engine._store.items, 1);
  Assert.ok("DUPE_INCOMING" in engine._store.items);

  let collection = server.getCollection(user, "rotary");
  Assert.equal(1, collection.count());
  Assert.notEqual(undefined, collection.wbo("DUPE_INCOMING"));

  await cleanAndGo(engine, server);
});

add_task(async function test_processIncoming_reconcile_equivalent() {
  _("Ensure proper handling of incoming records that match local.");

  let [engine, server, user] = await createServerAndConfigureClient();

  let now = Date.now() / 1000 - 10;
  await engine.setLastSync(now);
  engine.lastModified = now + 1;

  let record = encryptPayload({ id: "entry", denomination: "denomination" });
  let wbo = new ServerWBO("entry", record, now + 2);
  server.insertWBO(user, "rotary", wbo);

  engine._store.items = { entry: "denomination" };
  Assert.ok(await engine._store.itemExists("entry"));

  await engine._sync();

  do_check_attribute_count(engine._store.items, 1);

  await cleanAndGo(engine, server);
});

add_task(
  async function test_processIncoming_reconcile_locally_deleted_dupe_new() {
    _(
      "Ensure locally deleted duplicate record newer than incoming is handled."
    );

    // This is a somewhat complicated test. It ensures that if a client receives
    // a modified record for an item that is deleted locally but with a different
    // ID that the incoming record is ignored. This is a corner case for record
    // handling, but it needs to be supported.
    let [engine, server, user] = await createServerAndConfigureClient();

    let now = Date.now() / 1000 - 10;
    await engine.setLastSync(now);
    engine.lastModified = now + 1;

    let record = encryptPayload({
      id: "DUPE_INCOMING",
      denomination: "incoming",
    });
    let wbo = new ServerWBO("DUPE_INCOMING", record, now + 2);
    server.insertWBO(user, "rotary", wbo);

    // Simulate a locally-deleted item.
    engine._store.items = {};
    await engine._tracker.addChangedID("DUPE_LOCAL", now + 3);
    Assert.equal(false, await engine._store.itemExists("DUPE_LOCAL"));
    Assert.equal(false, await engine._store.itemExists("DUPE_INCOMING"));
    Assert.equal("DUPE_LOCAL", await engine._findDupe({ id: "DUPE_INCOMING" }));

    engine.lastModified = server.getCollection(user, engine.name).timestamp;
    await engine._sync();

    // After the sync, the server's payload for the original ID should be marked
    // as deleted.
    do_check_empty(engine._store.items);
    let collection = server.getCollection(user, "rotary");
    Assert.equal(1, collection.count());
    wbo = collection.wbo("DUPE_INCOMING");
    Assert.notEqual(null, wbo);
    let payload = wbo.getCleartext();
    Assert.ok(payload.deleted);

    await cleanAndGo(engine, server);
  }
);

add_task(
  async function test_processIncoming_reconcile_locally_deleted_dupe_old() {
    _(
      "Ensure locally deleted duplicate record older than incoming is restored."
    );

    // This is similar to the above test except it tests the condition where the
    // incoming record is newer than the local deletion, therefore overriding it.

    let [engine, server, user] = await createServerAndConfigureClient();

    let now = Date.now() / 1000 - 10;
    await engine.setLastSync(now);
    engine.lastModified = now + 1;

    let record = encryptPayload({
      id: "DUPE_INCOMING",
      denomination: "incoming",
    });
    let wbo = new ServerWBO("DUPE_INCOMING", record, now + 2);
    server.insertWBO(user, "rotary", wbo);

    // Simulate a locally-deleted item.
    engine._store.items = {};
    await engine._tracker.addChangedID("DUPE_LOCAL", now + 1);
    Assert.equal(false, await engine._store.itemExists("DUPE_LOCAL"));
    Assert.equal(false, await engine._store.itemExists("DUPE_INCOMING"));
    Assert.equal("DUPE_LOCAL", await engine._findDupe({ id: "DUPE_INCOMING" }));

    await engine._sync();

    // Since the remote change is newer, the incoming item should exist locally.
    do_check_attribute_count(engine._store.items, 1);
    Assert.ok("DUPE_INCOMING" in engine._store.items);
    Assert.equal("incoming", engine._store.items.DUPE_INCOMING);

    let collection = server.getCollection(user, "rotary");
    Assert.equal(1, collection.count());
    wbo = collection.wbo("DUPE_INCOMING");
    let payload = wbo.getCleartext();
    Assert.equal("incoming", payload.denomination);

    await cleanAndGo(engine, server);
  }
);

add_task(async function test_processIncoming_reconcile_changed_dupe() {
  _("Ensure that locally changed duplicate record is handled properly.");

  let [engine, server, user] = await createServerAndConfigureClient();

  let now = Date.now() / 1000 - 10;
  await engine.setLastSync(now);
  engine.lastModified = now + 1;

  // The local record is newer than the incoming one, so it should be retained.
  let record = encryptPayload({
    id: "DUPE_INCOMING",
    denomination: "incoming",
  });
  let wbo = new ServerWBO("DUPE_INCOMING", record, now + 2);
  server.insertWBO(user, "rotary", wbo);

  await engine._store.create({ id: "DUPE_LOCAL", denomination: "local" });
  await engine._tracker.addChangedID("DUPE_LOCAL", now + 3);
  Assert.ok(await engine._store.itemExists("DUPE_LOCAL"));
  Assert.equal("DUPE_LOCAL", await engine._findDupe({ id: "DUPE_INCOMING" }));

  engine.lastModified = server.getCollection(user, engine.name).timestamp;
  await engine._sync();

  // The ID should have been changed to incoming.
  do_check_attribute_count(engine._store.items, 1);
  Assert.ok("DUPE_INCOMING" in engine._store.items);

  // On the server, the local ID should be deleted and the incoming ID should
  // have its payload set to what was in the local record.
  let collection = server.getCollection(user, "rotary");
  Assert.equal(1, collection.count());
  wbo = collection.wbo("DUPE_INCOMING");
  Assert.notEqual(undefined, wbo);
  let payload = wbo.getCleartext();
  Assert.equal("local", payload.denomination);

  await cleanAndGo(engine, server);
});

add_task(async function test_processIncoming_reconcile_changed_dupe_new() {
  _("Ensure locally changed duplicate record older than incoming is ignored.");

  // This test is similar to the above except the incoming record is younger
  // than the local record. The incoming record should be authoritative.
  let [engine, server, user] = await createServerAndConfigureClient();

  let now = Date.now() / 1000 - 10;
  await engine.setLastSync(now);
  engine.lastModified = now + 1;

  let record = encryptPayload({
    id: "DUPE_INCOMING",
    denomination: "incoming",
  });
  let wbo = new ServerWBO("DUPE_INCOMING", record, now + 2);
  server.insertWBO(user, "rotary", wbo);

  await engine._store.create({ id: "DUPE_LOCAL", denomination: "local" });
  await engine._tracker.addChangedID("DUPE_LOCAL", now + 1);
  Assert.ok(await engine._store.itemExists("DUPE_LOCAL"));
  Assert.equal("DUPE_LOCAL", await engine._findDupe({ id: "DUPE_INCOMING" }));

  engine.lastModified = server.getCollection(user, engine.name).timestamp;
  await engine._sync();

  // The ID should have been changed to incoming.
  do_check_attribute_count(engine._store.items, 1);
  Assert.ok("DUPE_INCOMING" in engine._store.items);

  // On the server, the local ID should be deleted and the incoming ID should
  // have its payload retained.
  let collection = server.getCollection(user, "rotary");
  Assert.equal(1, collection.count());
  wbo = collection.wbo("DUPE_INCOMING");
  Assert.notEqual(undefined, wbo);
  let payload = wbo.getCleartext();
  Assert.equal("incoming", payload.denomination);
  await cleanAndGo(engine, server);
});

add_task(async function test_processIncoming_resume_toFetch() {
  _(
    "toFetch and previousFailed items left over from previous syncs are fetched on the next sync, along with new items."
  );

  const LASTSYNC = Date.now() / 1000;

  // Server records that will be downloaded
  let collection = new ServerCollection();
  collection.insert(
    "flying",
    encryptPayload({ id: "flying", denomination: "LNER Class A3 4472" })
  );
  collection.insert(
    "scotsman",
    encryptPayload({ id: "scotsman", denomination: "Flying Scotsman" })
  );
  collection.insert(
    "rekolok",
    encryptPayload({ id: "rekolok", denomination: "Rekonstruktionslokomotive" })
  );
  for (let i = 0; i < 3; i++) {
    let id = "failed" + i;
    let payload = encryptPayload({ id, denomination: "Record No. " + i });
    let wbo = new ServerWBO(id, payload);
    wbo.modified = LASTSYNC - 10;
    collection.insertWBO(wbo);
  }

  collection.wbo("flying").modified = collection.wbo("scotsman").modified =
    LASTSYNC - 10;
  collection._wbos.rekolok.modified = LASTSYNC + 10;

  // Time travel 10 seconds into the future but still download the above WBOs.
  let engine = makeRotaryEngine();
  await engine.setLastSync(LASTSYNC);
  engine.toFetch = new SerializableSet(["flying", "scotsman"]);
  engine.previousFailedIn = new SerializableSet([
    "failed0",
    "failed1",
    "failed2",
  ]);

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };
  try {
    // Confirm initial environment
    Assert.equal(engine._store.items.flying, undefined);
    Assert.equal(engine._store.items.scotsman, undefined);
    Assert.equal(engine._store.items.rekolok, undefined);

    await engine._syncStartup();
    await engine._processIncoming();

    // Local records have been created from the server data.
    Assert.equal(engine._store.items.flying, "LNER Class A3 4472");
    Assert.equal(engine._store.items.scotsman, "Flying Scotsman");
    Assert.equal(engine._store.items.rekolok, "Rekonstruktionslokomotive");
    Assert.equal(engine._store.items.failed0, "Record No. 0");
    Assert.equal(engine._store.items.failed1, "Record No. 1");
    Assert.equal(engine._store.items.failed2, "Record No. 2");
    Assert.equal(engine.previousFailedIn.size, 0);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_processIncoming_notify_count() {
  _("Ensure that failed records are reported only once.");

  const NUMBER_OF_RECORDS = 15;

  // Engine that fails every 5 records.
  let engine = makeRotaryEngine();
  engine._store._applyIncomingBatch = engine._store.applyIncomingBatch;
  engine._store.applyIncomingBatch = async function (records, countTelemetry) {
    let sortedRecords = records.sort((a, b) => (a.id > b.id ? 1 : -1));
    let recordsToApply = [],
      recordsToFail = [];
    for (let i = 0; i < sortedRecords.length; i++) {
      (i % 5 === 0 ? recordsToFail : recordsToApply).push(sortedRecords[i]);
    }
    recordsToFail.forEach(() => {
      countTelemetry.addIncomingFailedReason("failed message");
    });
    await engine._store._applyIncomingBatch(recordsToApply, countTelemetry);

    return recordsToFail.map(record => record.id);
  };

  // Create a batch of server side records.
  let collection = new ServerCollection();
  for (var i = 0; i < NUMBER_OF_RECORDS; i++) {
    let id = "record-no-" + i.toString(10).padStart(2, "0");
    let payload = encryptPayload({ id, denomination: "Record No. " + id });
    collection.insert(id, payload);
  }

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };
  try {
    // Confirm initial environment.
    Assert.equal(await engine.getLastSync(), 0);
    Assert.equal(engine.toFetch.size, 0);
    Assert.equal(engine.previousFailedIn.size, 0);
    do_check_empty(engine._store.items);

    let called = 0;
    let counts;
    function onApplied(count) {
      _("Called with " + JSON.stringify(counts));
      counts = count;
      called++;
    }
    Svc.Obs.add("weave:engine:sync:applied", onApplied);

    // Do sync.
    await engine._syncStartup();
    await engine._processIncoming();

    // Confirm failures.
    do_check_attribute_count(engine._store.items, 12);
    Assert.deepEqual(
      Array.from(engine.previousFailedIn).sort(),
      ["record-no-00", "record-no-05", "record-no-10"].sort()
    );

    // There are newly failed records and they are reported.
    Assert.equal(called, 1);
    Assert.equal(counts.failed, 3);
    Assert.equal(counts.failedReasons[0].count, 3);
    Assert.equal(counts.failedReasons[0].name, "failed message");
    Assert.equal(counts.applied, 15);
    Assert.equal(counts.newFailed, 3);
    Assert.equal(counts.succeeded, 12);

    // Sync again, 1 of the failed items are the same, the rest didn't fail.
    await engine._processIncoming();

    // Confirming removed failures.
    do_check_attribute_count(engine._store.items, 14);
    // After failing twice the record that failed again [record-no-00]
    // should NOT be stored to try again
    Assert.deepEqual(Array.from(engine.previousFailedIn), []);

    Assert.equal(called, 2);
    Assert.equal(counts.failed, 1);
    Assert.equal(counts.failedReasons[0].count, 1);
    Assert.equal(counts.failedReasons[0].name, "failed message");
    Assert.equal(counts.applied, 3);
    Assert.equal(counts.newFailed, 0);
    Assert.equal(counts.succeeded, 2);

    Svc.Obs.remove("weave:engine:sync:applied", onApplied);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_processIncoming_previousFailed() {
  _("Ensure that failed records are retried.");

  const NUMBER_OF_RECORDS = 14;

  // Engine that alternates between failing and applying every 2 records.
  let engine = makeRotaryEngine();
  engine._store._applyIncomingBatch = engine._store.applyIncomingBatch;
  engine._store.applyIncomingBatch = async function (records, countTelemetry) {
    let sortedRecords = records.sort((a, b) => (a.id > b.id ? 1 : -1));
    let recordsToApply = [],
      recordsToFail = [];
    let chunks = Array.from(PlacesUtils.chunkArray(sortedRecords, 2));
    for (let i = 0; i < chunks.length; i++) {
      (i % 2 === 0 ? recordsToFail : recordsToApply).push(...chunks[i]);
    }
    await engine._store._applyIncomingBatch(recordsToApply, countTelemetry);
    return recordsToFail.map(record => record.id);
  };

  // Create a batch of server side records.
  let collection = new ServerCollection();
  for (var i = 0; i < NUMBER_OF_RECORDS; i++) {
    let id = "record-no-" + i.toString(10).padStart(2, "0");
    let payload = encryptPayload({ id, denomination: "Record No. " + i });
    collection.insert(id, payload);
  }

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };
  try {
    // Confirm initial environment.
    Assert.equal(await engine.getLastSync(), 0);
    Assert.equal(engine.toFetch.size, 0);
    Assert.equal(engine.previousFailedIn.size, 0);
    do_check_empty(engine._store.items);

    // Initial failed items in previousFailedIn to be reset.
    let previousFailedIn = new SerializableSet([
      Utils.makeGUID(),
      Utils.makeGUID(),
      Utils.makeGUID(),
    ]);
    engine.previousFailedIn = previousFailedIn;
    Assert.equal(engine.previousFailedIn, previousFailedIn);

    // Do sync.
    await engine._syncStartup();
    await engine._processIncoming();

    // Expected result: 4 sync batches with 2 failures each => 8 failures
    do_check_attribute_count(engine._store.items, 6);
    Assert.deepEqual(
      Array.from(engine.previousFailedIn).sort(),
      [
        "record-no-00",
        "record-no-01",
        "record-no-04",
        "record-no-05",
        "record-no-08",
        "record-no-09",
        "record-no-12",
        "record-no-13",
      ].sort()
    );

    // Sync again with the same failed items (records 0, 1, 8, 9).
    await engine._processIncoming();

    do_check_attribute_count(engine._store.items, 10);
    // A second sync with the same failed items should NOT add the same items again.
    // Items that did not fail a second time should no longer be in previousFailedIn.
    Assert.deepEqual(Array.from(engine.previousFailedIn).sort(), []);

    // Refetched items that didn't fail the second time are in engine._store.items.
    Assert.equal(engine._store.items["record-no-04"], "Record No. 4");
    Assert.equal(engine._store.items["record-no-05"], "Record No. 5");
    Assert.equal(engine._store.items["record-no-12"], "Record No. 12");
    Assert.equal(engine._store.items["record-no-13"], "Record No. 13");
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_processIncoming_failed_records() {
  _(
    "Ensure that failed records from _reconcile and applyIncomingBatch are refetched."
  );

  // Let's create three and a bit batches worth of server side records.
  let APPLY_BATCH_SIZE = 50;
  let collection = new ServerCollection();
  const NUMBER_OF_RECORDS = APPLY_BATCH_SIZE * 3 + 5;
  for (let i = 0; i < NUMBER_OF_RECORDS; i++) {
    let id = "record-no-" + i;
    let payload = encryptPayload({ id, denomination: "Record No. " + id });
    let wbo = new ServerWBO(id, payload);
    wbo.modified = Date.now() / 1000 + 60 * (i - APPLY_BATCH_SIZE * 3);
    collection.insertWBO(wbo);
  }

  // Engine that batches but likes to throw on a couple of records,
  // two in each batch: the even ones fail in reconcile, the odd ones
  // in applyIncoming.
  const BOGUS_RECORDS = [
    "record-no-" + 42,
    "record-no-" + 23,
    "record-no-" + (42 + APPLY_BATCH_SIZE),
    "record-no-" + (23 + APPLY_BATCH_SIZE),
    "record-no-" + (42 + APPLY_BATCH_SIZE * 2),
    "record-no-" + (23 + APPLY_BATCH_SIZE * 2),
    "record-no-" + (2 + APPLY_BATCH_SIZE * 3),
    "record-no-" + (1 + APPLY_BATCH_SIZE * 3),
  ];
  let engine = makeRotaryEngine();

  engine.__reconcile = engine._reconcile;
  engine._reconcile = async function _reconcile(record) {
    if (BOGUS_RECORDS.indexOf(record.id) % 2 == 0) {
      throw new Error("I don't like this record! Baaaaaah!");
    }
    return this.__reconcile.apply(this, arguments);
  };
  engine._store._applyIncoming = engine._store.applyIncoming;
  engine._store.applyIncoming = async function (record) {
    if (BOGUS_RECORDS.indexOf(record.id) % 2 == 1) {
      throw new Error("I don't like this record! Baaaaaah!");
    }
    return this._applyIncoming.apply(this, arguments);
  };

  // Keep track of requests made of a collection.
  let count = 0;
  let uris = [];
  function recording_handler(recordedCollection) {
    let h = recordedCollection.handler();
    return function (req, res) {
      ++count;
      uris.push(req.path + "?" + req.queryString);
      return h(req, res);
    };
  }
  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": recording_handler(collection),
  });

  await SyncTestingInfrastructure(server);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  try {
    // Confirm initial environment
    Assert.equal(await engine.getLastSync(), 0);
    Assert.equal(engine.toFetch.size, 0);
    Assert.equal(engine.previousFailedIn.size, 0);
    do_check_empty(engine._store.items);

    let observerSubject;
    let observerData;
    Svc.Obs.add("weave:engine:sync:applied", function onApplied(subject, data) {
      Svc.Obs.remove("weave:engine:sync:applied", onApplied);
      observerSubject = subject;
      observerData = data;
    });

    await engine._syncStartup();
    await engine._processIncoming();

    // Ensure that all records but the bogus 4 have been applied.
    do_check_attribute_count(
      engine._store.items,
      NUMBER_OF_RECORDS - BOGUS_RECORDS.length
    );

    // Ensure that the bogus records will be fetched again on the next sync.
    Assert.equal(engine.previousFailedIn.size, BOGUS_RECORDS.length);
    Assert.deepEqual(
      Array.from(engine.previousFailedIn).sort(),
      BOGUS_RECORDS.sort()
    );

    // Ensure the observer was notified
    Assert.equal(observerData, engine.name);
    Assert.equal(observerSubject.failed, BOGUS_RECORDS.length);
    Assert.equal(observerSubject.newFailed, BOGUS_RECORDS.length);

    // Testing batching of failed item fetches.
    // Try to sync again. Ensure that we split the request into chunks to avoid
    // URI length limitations.
    async function batchDownload(batchSize) {
      count = 0;
      uris = [];
      engine.guidFetchBatchSize = batchSize;
      await engine._processIncoming();
      _("Tried again. Requests: " + count + "; URIs: " + JSON.stringify(uris));
      return count;
    }

    // There are 8 bad records, so this needs 3 fetches.
    _("Test batching with ID batch size 3, normal mobile batch size.");
    Assert.equal(await batchDownload(3), 3);

    // Since there the previous batch failed again, there should be
    // no more records to fetch
    _("Test that the second time a record failed to sync, gets ignored");
    Assert.equal(await batchDownload(BOGUS_RECORDS.length), 0);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_processIncoming_decrypt_failed() {
  _("Ensure that records failing to decrypt are either replaced or refetched.");

  // Some good and some bogus records. One doesn't contain valid JSON,
  // the other will throw during decrypt.
  let collection = new ServerCollection();
  collection._wbos.flying = new ServerWBO(
    "flying",
    encryptPayload({ id: "flying", denomination: "LNER Class A3 4472" })
  );
  collection._wbos.nojson = new ServerWBO("nojson", "This is invalid JSON");
  collection._wbos.nojson2 = new ServerWBO("nojson2", "This is invalid JSON");
  collection._wbos.scotsman = new ServerWBO(
    "scotsman",
    encryptPayload({ id: "scotsman", denomination: "Flying Scotsman" })
  );
  collection._wbos.nodecrypt = new ServerWBO("nodecrypt", "Decrypt this!");
  collection._wbos.nodecrypt2 = new ServerWBO("nodecrypt2", "Decrypt this!");

  // Patch the fake crypto service to throw on the record above.
  Weave.Crypto._decrypt = Weave.Crypto.decrypt;
  Weave.Crypto.decrypt = function (ciphertext) {
    if (ciphertext == "Decrypt this!") {
      throw new Error(
        "Derp! Cipher finalized failed. Im ur crypto destroyin ur recordz."
      );
    }
    return this._decrypt.apply(this, arguments);
  };

  // Some broken records also exist locally.
  let engine = makeRotaryEngine();
  engine.enabled = true;
  engine._store.items = { nojson: "Valid JSON", nodecrypt: "Valid ciphertext" };

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };
  try {
    // Confirm initial state
    Assert.equal(engine.toFetch.size, 0);
    Assert.equal(engine.previousFailedIn.size, 0);

    let observerSubject;
    let observerData;
    Svc.Obs.add("weave:engine:sync:applied", function onApplied(subject, data) {
      Svc.Obs.remove("weave:engine:sync:applied", onApplied);
      observerSubject = subject;
      observerData = data;
    });

    await engine.setLastSync(collection.wbo("nojson").modified - 1);
    let ping = await sync_engine_and_validate_telem(engine, true);
    Assert.equal(ping.engines[0].incoming.applied, 2);
    Assert.equal(ping.engines[0].incoming.failed, 4);
    console.log("incoming telem: ", ping.engines[0].incoming);
    Assert.equal(
      ping.engines[0].incoming.failedReasons[0].name,
      "No ciphertext: nothing to decrypt?"
    );
    // There should be 4 of the same error
    Assert.equal(ping.engines[0].incoming.failedReasons[0].count, 4);

    Assert.equal(engine.previousFailedIn.size, 4);
    Assert.ok(engine.previousFailedIn.has("nojson"));
    Assert.ok(engine.previousFailedIn.has("nojson2"));
    Assert.ok(engine.previousFailedIn.has("nodecrypt"));
    Assert.ok(engine.previousFailedIn.has("nodecrypt2"));

    // Ensure the observer was notified
    Assert.equal(observerData, engine.name);
    Assert.equal(observerSubject.applied, 2);
    Assert.equal(observerSubject.failed, 4);
    Assert.equal(observerSubject.failedReasons[0].count, 4);
  } finally {
    await promiseClean(engine, server);
  }
});

add_task(async function test_uploadOutgoing_toEmptyServer() {
  _("SyncEngine._uploadOutgoing uploads new records to server");

  let collection = new ServerCollection();
  collection._wbos.flying = new ServerWBO("flying");
  collection._wbos.scotsman = new ServerWBO("scotsman");
  collection._wbos.failed = new ServerWBO("failed");

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
    "/1.1/foo/storage/rotary/flying": collection.wbo("flying").handler(),
    "/1.1/foo/storage/rotary/scotsman": collection.wbo("scotsman").handler(),
    "/1.1/foo/storage/rotary/failed": collection.wbo("failed").handler(),
  });

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let engine = makeRotaryEngine();
  engine._store.items = {
    flying: "LNER Class A3 4472",
    scotsman: "Flying Scotsman",
    failed: "Previously Failed Item",
    failagain: "Item that failed and will fail again",
  };
  // Mark some of these records as changed
  await engine._tracker.addChangedID("scotsman", 0);
  await engine._tracker.addChangedID("failed", 0);
  await engine._tracker.addChangedID("failagain", 0);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  try {
    await engine.setLastSync(123); // needs to be non-zero so that tracker is queried
    engine.previousFailedOut = new SerializableSet(["failed", "failagain"]);

    // Confirm initial environment
    Assert.equal(collection.payload("flying"), undefined);
    Assert.equal(collection.payload("scotsman"), undefined);
    Assert.equal(collection.payload("failed"), undefined);

    await engine._syncStartup();
    await engine._uploadOutgoing();

    // Ensure the marked record ('scotsman') and previously failed record
    // ('failed') have been uploaded and are no longer marked.
    Assert.equal(collection.payload("flying"), undefined);
    Assert.ok(!!collection.payload("scotsman"));
    Assert.equal(collection.cleartext("scotsman").id, "scotsman");
    const changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.scotsman, undefined);
    Assert.ok(!!collection.payload("failed"));
    Assert.equal(collection.cleartext("failed").id, "failed");
    Assert.equal(changes.failed, undefined);

    // The 'flying' record wasn't marked and 'failagain' failed, so they
    // weren't uploaded
    Assert.equal(collection.payload("flying"), undefined);
    Assert.equal(changes.flying, undefined);
    Assert.equal(changes.failagain, undefined);

    // Nothing failed on this run except failagain' which we already retried,
    // so this should be empty.
    Assert.equal(engine.previousFailedOut.size, 0);
  } finally {
    await cleanAndGo(engine, server);
  }
});

async function test_uploadOutgoing_max_record_payload_bytes(
  allowSkippedRecord
) {
  _(
    "SyncEngine._uploadOutgoing throws when payload is bigger than max_record_payload_bytes"
  );
  let collection = new ServerCollection();
  collection._wbos.flying = new ServerWBO("flying");
  collection._wbos.scotsman = new ServerWBO("scotsman");

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
    "/1.1/foo/storage/rotary/flying": collection.wbo("flying").handler(),
    "/1.1/foo/storage/rotary/scotsman": collection.wbo("scotsman").handler(),
  });

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let engine = makeRotaryEngine();
  engine.allowSkippedRecord = allowSkippedRecord;
  engine._store.items = { flying: "a".repeat(1024 * 1024), scotsman: "abcd" };

  await engine._tracker.addChangedID("flying", 1000);
  await engine._tracker.addChangedID("scotsman", 1000);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  try {
    await engine.setLastSync(1); // needs to be non-zero so that tracker is queried

    // Confirm initial environment
    Assert.equal(collection.payload("flying"), undefined);
    Assert.equal(collection.payload("scotsman"), undefined);

    await engine._syncStartup();
    await engine._uploadOutgoing();

    if (!allowSkippedRecord) {
      do_throw("should not get here");
    }

    await engine.trackRemainingChanges();

    // Check we uploaded the other record to the server
    Assert.ok(collection.payload("scotsman"));
    // And that we won't try to upload the huge record next time.
    const changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.flying, undefined);
  } catch (e) {
    if (allowSkippedRecord) {
      do_throw("should not get here");
    }

    await engine.trackRemainingChanges();

    // Check that we will try to upload the huge record next time
    const changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.flying, 1000);
  } finally {
    // Check we didn't upload the oversized record to the server
    Assert.equal(collection.payload("flying"), undefined);
    await cleanAndGo(engine, server);
  }
}

add_task(
  async function test_uploadOutgoing_max_record_payload_bytes_disallowSkippedRecords() {
    return test_uploadOutgoing_max_record_payload_bytes(false);
  }
);

add_task(
  async function test_uploadOutgoing_max_record_payload_bytes_allowSkippedRecords() {
    return test_uploadOutgoing_max_record_payload_bytes(true);
  }
);

add_task(async function test_uploadOutgoing_failed() {
  _(
    "SyncEngine._uploadOutgoing doesn't clear the tracker of objects that failed to upload."
  );

  let collection = new ServerCollection();
  // We only define the "flying" WBO on the server, not the "scotsman"
  // and "peppercorn" ones.
  collection._wbos.flying = new ServerWBO("flying");

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let engine = makeRotaryEngine();
  engine._store.items = {
    flying: "LNER Class A3 4472",
    scotsman: "Flying Scotsman",
    peppercorn: "Peppercorn Class",
  };
  // Mark these records as changed
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

    // Confirm initial environment
    Assert.equal(collection.payload("flying"), undefined);
    let changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.flying, FLYING_CHANGED);
    Assert.equal(changes.scotsman, SCOTSMAN_CHANGED);
    Assert.equal(changes.peppercorn, PEPPERCORN_CHANGED);

    engine.enabled = true;
    await sync_engine_and_validate_telem(engine, true);

    // Ensure the 'flying' record has been uploaded and is no longer marked.
    Assert.ok(!!collection.payload("flying"));
    changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.flying, undefined);

    // The 'scotsman' and 'peppercorn' records couldn't be uploaded so
    // they were added to `previousFailedOut` and weren't cleared from the
    // tracker.
    Assert.equal(changes.scotsman, SCOTSMAN_CHANGED);
    Assert.equal(changes.peppercorn, PEPPERCORN_CHANGED);
    Assert.equal(engine.previousFailedOut.size, 2);
    Assert.ok(engine.previousFailedOut.has("scotsman"));
    Assert.ok(engine.previousFailedOut.has("peppercorn"));
  } finally {
    await promiseClean(engine, server);
  }
});

async function createRecordFailTelemetry(allowSkippedRecord) {
  Services.prefs.setStringPref("services.sync.username", "foo");
  let collection = new ServerCollection();
  collection._wbos.flying = new ServerWBO("flying");
  collection._wbos.scotsman = new ServerWBO("scotsman");

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let engine = makeRotaryEngine();
  engine.allowSkippedRecord = allowSkippedRecord;
  let oldCreateRecord = engine._store.createRecord;
  engine._store.createRecord = async (id, col) => {
    if (id != "flying") {
      throw new Error("oops");
    }
    return oldCreateRecord.call(engine._store, id, col);
  };
  engine._store.items = {
    flying: "LNER Class A3 4472",
    scotsman: "Flying Scotsman",
  };
  // Mark these records as changed
  const FLYING_CHANGED = 12345;
  const SCOTSMAN_CHANGED = 23456;
  await engine._tracker.addChangedID("flying", FLYING_CHANGED);
  await engine._tracker.addChangedID("scotsman", SCOTSMAN_CHANGED);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  let ping;
  try {
    await engine.setLastSync(123); // needs to be non-zero so that tracker is queried

    // Confirm initial environment
    Assert.equal(collection.payload("flying"), undefined);
    let changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.flying, FLYING_CHANGED);
    Assert.equal(changes.scotsman, SCOTSMAN_CHANGED);

    engine.enabled = true;
    ping = await sync_engine_and_validate_telem(engine, true, onErrorPing => {
      ping = onErrorPing;
    });

    if (!allowSkippedRecord) {
      do_throw("should not get here");
    }

    // Ensure the 'flying' record has been uploaded and is no longer marked.
    Assert.ok(!!collection.payload("flying"));
    changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.flying, undefined);
  } catch (err) {
    if (allowSkippedRecord) {
      do_throw("should not get here");
    }

    // Ensure the 'flying' record has not been uploaded and is still marked
    Assert.ok(!collection.payload("flying"));
    const changes = await engine._tracker.getChangedIDs();
    Assert.ok(changes.flying);
  } finally {
    // We reported in telemetry that we failed a record
    Assert.equal(ping.engines[0].outgoing[0].failed, 1);
    Assert.equal(ping.engines[0].outgoing[0].failedReasons[0].name, "oops");

    // In any case, the 'scotsman' record couldn't be created so it wasn't
    // uploaded nor it was not cleared from the tracker.
    Assert.ok(!collection.payload("scotsman"));
    const changes = await engine._tracker.getChangedIDs();
    Assert.equal(changes.scotsman, SCOTSMAN_CHANGED);

    engine._store.createRecord = oldCreateRecord;
    await promiseClean(engine, server);
  }
}

add_task(
  async function test_uploadOutgoing_createRecord_throws_reported_telemetry() {
    _(
      "SyncEngine._uploadOutgoing reports a failed record to telemetry if createRecord throws"
    );
    await createRecordFailTelemetry(true);
  }
);

add_task(
  async function test_uploadOutgoing_createRecord_throws_dontAllowSkipRecord() {
    _(
      "SyncEngine._uploadOutgoing will throw if createRecord throws and allowSkipRecord is set to false"
    );
    await createRecordFailTelemetry(false);
  }
);

add_task(async function test_uploadOutgoing_largeRecords() {
  _(
    "SyncEngine._uploadOutgoing throws on records larger than the max record payload size"
  );

  let collection = new ServerCollection();

  let engine = makeRotaryEngine();
  engine.allowSkippedRecord = false;
  engine._store.items["large-item"] = "Y".repeat(
    Service.getMaxRecordPayloadSize() * 2
  );
  await engine._tracker.addChangedID("large-item", 0);
  collection.insert("large-item");

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  try {
    await engine._syncStartup();
    let error = null;
    try {
      await engine._uploadOutgoing();
    } catch (e) {
      error = e;
    }
    ok(!!error);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_syncFinish_deleteByIds() {
  _(
    "SyncEngine._syncFinish deletes server records slated for deletion (list of record IDs)."
  );

  let collection = new ServerCollection();
  collection._wbos.flying = new ServerWBO(
    "flying",
    encryptPayload({ id: "flying", denomination: "LNER Class A3 4472" })
  );
  collection._wbos.scotsman = new ServerWBO(
    "scotsman",
    encryptPayload({ id: "scotsman", denomination: "Flying Scotsman" })
  );
  collection._wbos.rekolok = new ServerWBO(
    "rekolok",
    encryptPayload({ id: "rekolok", denomination: "Rekonstruktionslokomotive" })
  );

  let server = httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });
  await SyncTestingInfrastructure(server);

  let engine = makeRotaryEngine();
  try {
    engine._delete = { ids: ["flying", "rekolok"] };
    await engine._syncFinish();

    // The 'flying' and 'rekolok' records were deleted while the
    // 'scotsman' one wasn't.
    Assert.equal(collection.payload("flying"), undefined);
    Assert.ok(!!collection.payload("scotsman"));
    Assert.equal(collection.payload("rekolok"), undefined);

    // The deletion todo list has been reset.
    Assert.equal(engine._delete.ids, undefined);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_syncFinish_deleteLotsInBatches() {
  _(
    "SyncEngine._syncFinish deletes server records in batches of 100 (list of record IDs)."
  );

  let collection = new ServerCollection();

  // Let's count how many times the client does a DELETE request to the server
  var noOfUploads = 0;
  collection.delete = (function (orig) {
    return function () {
      noOfUploads++;
      return orig.apply(this, arguments);
    };
  })(collection.delete);

  // Create a bunch of records on the server
  let now = Date.now();
  for (var i = 0; i < 234; i++) {
    let id = "record-no-" + i;
    let payload = encryptPayload({ id, denomination: "Record No. " + i });
    let wbo = new ServerWBO(id, payload);
    wbo.modified = now / 1000 - 60 * (i + 110);
    collection.insertWBO(wbo);
  }

  let server = httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let engine = makeRotaryEngine();
  try {
    // Confirm initial environment
    Assert.equal(noOfUploads, 0);

    // Declare what we want to have deleted: all records no. 100 and
    // up and all records that are less than 200 mins old (which are
    // records 0 thru 90).
    engine._delete = { ids: [], newer: now / 1000 - 60 * 200.5 };
    for (i = 100; i < 234; i++) {
      engine._delete.ids.push("record-no-" + i);
    }

    await engine._syncFinish();

    // Ensure that the appropriate server data has been wiped while
    // preserving records 90 thru 200.
    for (i = 0; i < 234; i++) {
      let id = "record-no-" + i;
      if (i <= 90 || i >= 100) {
        Assert.equal(collection.payload(id), undefined);
      } else {
        Assert.ok(!!collection.payload(id));
      }
    }

    // The deletion was done in batches
    Assert.equal(noOfUploads, 2 + 1);

    // The deletion todo list has been reset.
    Assert.equal(engine._delete.ids, undefined);
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_sync_partialUpload() {
  _("SyncEngine.sync() keeps changedIDs that couldn't be uploaded.");

  let collection = new ServerCollection();
  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });
  let oldServerConfiguration = Service.serverConfiguration;
  Service.serverConfiguration = {
    max_post_records: 100,
  };
  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let engine = makeRotaryEngine();

  // Let the third upload fail completely
  var noOfUploads = 0;
  collection.post = (function (orig) {
    return function () {
      if (noOfUploads == 2) {
        throw new Error("FAIL!");
      }
      noOfUploads++;
      return orig.apply(this, arguments);
    };
  })(collection.post);

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
    await engine.setLastSync(123); // needs to be non-zero so that tracker is queried

    engine.enabled = true;
    let error;
    try {
      await sync_engine_and_validate_telem(engine, true);
    } catch (ex) {
      error = ex;
    }

    ok(!!error);

    const changes = await engine._tracker.getChangedIDs();
    for (let i = 0; i < 234; i++) {
      let id = "record-no-" + i;
      // Ensure that failed records are back in the tracker and failures have
      // been added to `previousFailedOut`.
      if (i < 200) {
        // Records no. 23 and 42 were rejected by the server,
        if (i == 23 || i == 42) {
          Assert.equal(changes[id], i);
          Assert.ok(engine.previousFailedOut.has(id));
        } else {
          Assert.equal(false, id in changes);
          Assert.ok(!engine.previousFailedOut.has(id));
        }
      } else {
        // Records after the third batch and higher couldn't be uploaded because
        // we failed hard on the 3rd upload.
        Assert.equal(changes[id], i);
        Assert.ok(!engine.previousFailedOut.has(id));
      }
    }
  } finally {
    Service.serverConfiguration = oldServerConfiguration;
    await promiseClean(engine, server);
  }
});

add_task(async function test_canDecrypt_noCryptoKeys() {
  _(
    "SyncEngine.canDecrypt returns false if the engine fails to decrypt items on the server, e.g. due to a missing crypto key collection."
  );

  // Wipe collection keys so we can test the desired scenario.
  Service.collectionKeys.clear();

  let collection = new ServerCollection();
  collection._wbos.flying = new ServerWBO(
    "flying",
    encryptPayload({ id: "flying", denomination: "LNER Class A3 4472" })
  );

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);
  let engine = makeRotaryEngine();
  try {
    Assert.equal(false, await engine.canDecrypt());
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_canDecrypt_true() {
  _(
    "SyncEngine.canDecrypt returns true if the engine can decrypt the items on the server."
  );

  await generateNewKeys(Service.collectionKeys);

  let collection = new ServerCollection();
  collection._wbos.flying = new ServerWBO(
    "flying",
    encryptPayload({ id: "flying", denomination: "LNER Class A3 4472" })
  );

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);
  let engine = makeRotaryEngine();
  try {
    Assert.ok(await engine.canDecrypt());
  } finally {
    await cleanAndGo(engine, server);
  }
});

add_task(async function test_syncapplied_observer() {
  const NUMBER_OF_RECORDS = 10;

  let engine = makeRotaryEngine();

  // Create a batch of server side records.
  let collection = new ServerCollection();
  for (var i = 0; i < NUMBER_OF_RECORDS; i++) {
    let id = "record-no-" + i;
    let payload = encryptPayload({ id, denomination: "Record No. " + id });
    collection.insert(id, payload);
  }

  let server = httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);

  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };

  let numApplyCalls = 0;
  let engine_name;
  let count;
  function onApplied(subject, data) {
    numApplyCalls++;
    engine_name = data;
    count = subject;
  }

  Svc.Obs.add("weave:engine:sync:applied", onApplied);

  try {
    Service.scheduler.hasIncomingItems = false;

    // Do sync.
    await engine._syncStartup();
    await engine._processIncoming();

    do_check_attribute_count(engine._store.items, 10);

    Assert.equal(numApplyCalls, 1);
    Assert.equal(engine_name, "rotary");
    Assert.equal(count.applied, 10);

    Assert.ok(Service.scheduler.hasIncomingItems);
  } finally {
    await cleanAndGo(engine, server);
    Service.scheduler.hasIncomingItems = false;
    Svc.Obs.remove("weave:engine:sync:applied", onApplied);
  }
});
