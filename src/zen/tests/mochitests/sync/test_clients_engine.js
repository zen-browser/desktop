/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { ClientEngine, ClientsRec } = ChromeUtils.importESModule(
  "resource://services-sync/engines/clients.sys.mjs"
);
const { CryptoWrapper } = ChromeUtils.importESModule(
  "resource://services-sync/record.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

const MORE_THAN_CLIENTS_TTL_REFRESH = 691200; // 8 days
const LESS_THAN_CLIENTS_TTL_REFRESH = 86400; // 1 day

let engine;

/**
 * Unpack the record with this ID, and verify that it has the same version that
 * we should be putting into records.
 */
async function check_record_version(user, id) {
  let payload = user.collection("clients").wbo(id).data;

  let rec = new CryptoWrapper();
  rec.id = id;
  rec.collection = "clients";
  rec.ciphertext = payload.ciphertext;
  rec.hmac = payload.hmac;
  rec.IV = payload.IV;

  let cleartext = await rec.decrypt(
    Service.collectionKeys.keyForCollection("clients")
  );

  _("Payload is " + JSON.stringify(cleartext));
  equal(Services.appinfo.version, cleartext.version);
  equal(1, cleartext.protocols.length);
  equal("1.5", cleartext.protocols[0]);
}

// compare 2 different command arrays, taking into account that a flowID
// attribute must exist, be unique in the commands, but isn't specified in
// "expected" as the value isn't known.
function compareCommands(actual, expected, description) {
  let tweakedActual = JSON.parse(JSON.stringify(actual));
  tweakedActual.map(elt => delete elt.flowID);
  deepEqual(tweakedActual, expected, description);
  // each item must have a unique flowID.
  let allIDs = new Set(actual.map(elt => elt.flowID).filter(fid => !!fid));
  equal(allIDs.size, actual.length, "all items have unique IDs");
}

async function syncClientsEngine(server) {
  engine._lastFxADevicesFetch = 0;
  engine.lastModified = server.getCollection("foo", "clients").timestamp;
  await engine._sync();
}

add_setup(async function () {
  engine = Service.clientsEngine;

  do_get_profile(); // FOG requires a profile directory.
  Services.fog.initializeFOG();
});

async function cleanup() {
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  await engine._tracker.clearChangedIDs();
  await engine._resetClient();
  // un-cleanup the logs (the resetBranch will have reset their levels), since
  // not all the tests use SyncTestingInfrastructure, and it's cheap.
  syncTestLogging();
  // We don't finalize storage at cleanup, since we use the same clients engine
  // instance across all tests.
}

add_task(async function test_bad_hmac() {
  _("Ensure that Clients engine deletes corrupt records.");
  let deletedCollections = [];
  let deletedItems = [];
  let callback = {
    onItemDeleted(username, coll, wboID) {
      deletedItems.push(coll + "/" + wboID);
    },
    onCollectionDeleted(username, coll) {
      deletedCollections.push(coll);
    },
  };
  Object.setPrototypeOf(callback, SyncServerCallback);
  let server = await serverForFoo(engine, callback);
  let user = server.user("foo");

  function check_clients_count(expectedCount) {
    let coll = user.collection("clients");

    // Treat a non-existent collection as empty.
    equal(expectedCount, coll ? coll.count() : 0);
  }

  function check_client_deleted(id) {
    let coll = user.collection("clients");
    let wbo = coll.wbo(id);
    return !wbo || !wbo.payload;
  }

  async function uploadNewKeys() {
    await generateNewKeys(Service.collectionKeys);
    let serverKeys = Service.collectionKeys.asWBO("crypto", "keys");
    await serverKeys.encrypt(Service.identity.syncKeyBundle);
    ok(
      (await serverKeys.upload(Service.resource(Service.cryptoKeysURL))).success
    );
  }

  try {
    await configureIdentity({ username: "foo" }, server);
    await Service.login();

    await generateNewKeys(Service.collectionKeys);

    _("First sync, client record is uploaded");
    equal(engine.lastRecordUpload, 0);
    ok(engine.isFirstSync);
    check_clients_count(0);
    await syncClientsEngine(server);
    check_clients_count(1);
    Assert.greater(engine.lastRecordUpload, 0);
    ok(!engine.isFirstSync);

    // Our uploaded record has a version.
    await check_record_version(user, engine.localID);

    // Initial setup can wipe the server, so clean up.
    deletedCollections = [];
    deletedItems = [];

    _("Change our keys and our client ID, reupload keys.");
    let oldLocalID = engine.localID; // Preserve to test for deletion!
    engine.localID = Utils.makeGUID();
    await engine.resetClient();
    await generateNewKeys(Service.collectionKeys);
    let serverKeys = Service.collectionKeys.asWBO("crypto", "keys");
    await serverKeys.encrypt(Service.identity.syncKeyBundle);
    ok(
      (await serverKeys.upload(Service.resource(Service.cryptoKeysURL))).success
    );

    _("Sync.");
    await syncClientsEngine(server);

    _("Old record " + oldLocalID + " was deleted, new one uploaded.");
    check_clients_count(1);
    check_client_deleted(oldLocalID);

    _(
      "Now change our keys but don't upload them. " +
        "That means we get an HMAC error but redownload keys."
    );
    Service.lastHMACEvent = 0;
    engine.localID = Utils.makeGUID();
    await engine.resetClient();
    await generateNewKeys(Service.collectionKeys);
    deletedCollections = [];
    deletedItems = [];
    check_clients_count(1);
    await syncClientsEngine(server);

    _("Old record was not deleted, new one uploaded.");
    equal(deletedCollections.length, 0);
    equal(deletedItems.length, 0);
    check_clients_count(2);

    _(
      "Now try the scenario where our keys are wrong *and* there's a bad record."
    );
    // Clean up and start fresh.
    user.collection("clients")._wbos = {};
    Service.lastHMACEvent = 0;
    engine.localID = Utils.makeGUID();
    await engine.resetClient();
    deletedCollections = [];
    deletedItems = [];
    check_clients_count(0);

    await uploadNewKeys();

    // Sync once to upload a record.
    await syncClientsEngine(server);
    check_clients_count(1);

    // Generate and upload new keys, so the old client record is wrong.
    await uploadNewKeys();

    // Create a new client record and new keys. Now our keys are wrong, as well
    // as the object on the server. We'll download the new keys and also delete
    // the bad client record.
    oldLocalID = engine.localID; // Preserve to test for deletion!
    engine.localID = Utils.makeGUID();
    await engine.resetClient();
    await generateNewKeys(Service.collectionKeys);
    let oldKey = Service.collectionKeys.keyForCollection();

    equal(deletedCollections.length, 0);
    equal(deletedItems.length, 0);
    await syncClientsEngine(server);
    equal(deletedItems.length, 1);
    check_client_deleted(oldLocalID);
    check_clients_count(1);
    let newKey = Service.collectionKeys.keyForCollection();
    ok(!oldKey.equals(newKey));
  } finally {
    await cleanup();
    await promiseStopServer(server);
  }
});

add_task(async function test_properties() {
  _("Test lastRecordUpload property");
  try {
    equal(
      Svc.PrefBranch.getPrefType("clients.lastRecordUpload"),
      Ci.nsIPrefBranch.PREF_INVALID
    );
    equal(engine.lastRecordUpload, 0);

    let now = Date.now();
    engine.lastRecordUpload = now / 1000;
    equal(engine.lastRecordUpload, Math.floor(now / 1000));
  } finally {
    await cleanup();
  }
});

add_task(async function test_full_sync() {
  _("Ensure that Clients engine fetches all records for each sync.");

  let now = new_timestamp();
  let server = await serverForFoo(engine);
  let user = server.user("foo");

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let activeID = Utils.makeGUID();
  user.collection("clients").insertRecord(
    {
      id: activeID,
      name: "Active client",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  let deletedID = Utils.makeGUID();
  user.collection("clients").insertRecord(
    {
      id: deletedID,
      name: "Client to delete",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  try {
    let store = engine._store;

    _("First sync. 2 records downloaded; our record uploaded.");
    strictEqual(engine.lastRecordUpload, 0);
    ok(engine.isFirstSync);
    await syncClientsEngine(server);
    Assert.greater(engine.lastRecordUpload, 0);
    ok(!engine.isFirstSync);
    deepEqual(
      user.collection("clients").keys().sort(),
      [activeID, deletedID, engine.localID].sort(),
      "Our record should be uploaded on first sync"
    );
    let ids = await store.getAllIDs();
    deepEqual(
      Object.keys(ids).sort(),
      [activeID, deletedID, engine.localID].sort(),
      "Other clients should be downloaded on first sync"
    );

    _("Delete a record, then sync again");
    let collection = server.getCollection("foo", "clients");
    collection.remove(deletedID);
    // Simulate a timestamp update in info/collections.
    await syncClientsEngine(server);

    _("Record should be updated");
    ids = await store.getAllIDs();
    deepEqual(
      Object.keys(ids).sort(),
      [activeID, engine.localID].sort(),
      "Deleted client should be removed on next sync"
    );
  } finally {
    await cleanup();

    try {
      server.deleteCollections("foo");
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_sync() {
  _("Ensure that Clients engine uploads a new client record once a week.");

  let server = await serverForFoo(engine);
  let user = server.user("foo");

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  function clientWBO() {
    return user.collection("clients").wbo(engine.localID);
  }

  try {
    _("First sync. Client record is uploaded.");
    equal(clientWBO(), undefined);
    equal(engine.lastRecordUpload, 0);
    ok(engine.isFirstSync);
    await syncClientsEngine(server);
    ok(!!clientWBO().payload);
    Assert.greater(engine.lastRecordUpload, 0);
    ok(!engine.isFirstSync);

    _(
      "Let's time travel more than a week back, new record should've been uploaded."
    );
    engine.lastRecordUpload -= MORE_THAN_CLIENTS_TTL_REFRESH;
    let lastweek = engine.lastRecordUpload;
    clientWBO().payload = undefined;
    await syncClientsEngine(server);
    ok(!!clientWBO().payload);
    Assert.greater(engine.lastRecordUpload, lastweek);
    ok(!engine.isFirstSync);

    _("Remove client record.");
    await engine.removeClientData();
    equal(clientWBO().payload, undefined);

    _("Time travel one day back, no record uploaded.");
    engine.lastRecordUpload -= LESS_THAN_CLIENTS_TTL_REFRESH;
    let yesterday = engine.lastRecordUpload;
    await syncClientsEngine(server);
    equal(clientWBO().payload, undefined);
    equal(engine.lastRecordUpload, yesterday);
    ok(!engine.isFirstSync);
  } finally {
    await cleanup();
    await promiseStopServer(server);
  }
});

add_task(async function test_client_name_change() {
  _("Ensure client name change incurs a client record update.");

  let tracker = engine._tracker;

  engine.localID; // Needed to increase the tracker changedIDs count.
  let initialName = engine.localName;

  tracker.start();
  _("initial name: " + initialName);

  // Tracker already has data, so clear it.
  await tracker.clearChangedIDs();

  let initialScore = tracker.score;

  let changedIDs = await tracker.getChangedIDs();
  equal(Object.keys(changedIDs).length, 0);

  Services.prefs.setStringPref(
    "identity.fxaccounts.account.device.name",
    "new name"
  );
  await tracker.asyncObserver.promiseObserversComplete();

  _("new name: " + engine.localName);
  notEqual(initialName, engine.localName);
  changedIDs = await tracker.getChangedIDs();
  equal(Object.keys(changedIDs).length, 1);
  ok(engine.localID in changedIDs);
  Assert.greater(tracker.score, initialScore);
  Assert.greaterOrEqual(tracker.score, SCORE_INCREMENT_XLARGE);

  await tracker.stop();

  await cleanup();
});

add_task(async function test_fxa_device_id_change() {
  _("Ensure an FxA device ID change incurs a client record update.");

  let tracker = engine._tracker;

  engine.localID; // Needed to increase the tracker changedIDs count.

  tracker.start();

  // Tracker already has data, so clear it.
  await tracker.clearChangedIDs();

  let initialScore = tracker.score;

  let changedIDs = await tracker.getChangedIDs();
  equal(Object.keys(changedIDs).length, 0);

  Services.obs.notifyObservers(null, "fxaccounts:new_device_id");
  await tracker.asyncObserver.promiseObserversComplete();

  changedIDs = await tracker.getChangedIDs();
  equal(Object.keys(changedIDs).length, 1);
  ok(engine.localID in changedIDs);
  Assert.greater(tracker.score, initialScore);
  Assert.greaterOrEqual(tracker.score, SINGLE_USER_THRESHOLD);

  await tracker.stop();

  await cleanup();
});

add_task(async function test_last_modified() {
  _("Ensure that remote records have a sane serverLastModified attribute.");

  let now = new_timestamp();
  let server = await serverForFoo(engine);
  let user = server.user("foo");

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let activeID = Utils.makeGUID();
  user.collection("clients").insertRecord(
    {
      id: activeID,
      name: "Active client",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  try {
    let collection = user.collection("clients");

    _("Sync to download the record");
    await syncClientsEngine(server);

    equal(
      engine._store._remoteClients[activeID].serverLastModified,
      now - 10,
      "last modified in the local record is correctly the server last-modified"
    );

    _("Modify the record and re-upload it");
    // set a new name to make sure we really did upload.
    engine._store._remoteClients[activeID].name = "New name";
    engine._modified.set(activeID, 0);
    // The sync above also did a POST, so adjust our lastModified.
    engine.lastModified = server.getCollection("foo", "clients").timestamp;
    await engine._uploadOutgoing();

    _("Local record should have updated timestamp");
    Assert.greaterOrEqual(
      engine._store._remoteClients[activeID].serverLastModified,
      now
    );

    _("Record on the server should have new name but not serverLastModified");
    let payload = collection.cleartext(activeID);
    equal(payload.name, "New name");
    equal(payload.serverLastModified, undefined);
  } finally {
    await cleanup();
    server.deleteCollections("foo");
    await promiseStopServer(server);
  }
});

add_task(async function test_send_command() {
  _("Verifies _sendCommandToClient puts commands in the outbound queue.");

  let store = engine._store;
  let tracker = engine._tracker;
  let remoteId = Utils.makeGUID();
  let rec = new ClientsRec("clients", remoteId);

  await store.create(rec);
  await store.createRecord(remoteId, "clients");

  let action = "testCommand";
  let args = ["foo", "bar"];
  let extra = { flowID: "flowy" };

  await engine._sendCommandToClient(action, args, remoteId, extra);

  let newRecord = store._remoteClients[remoteId];
  let clientCommands = (await engine._readCommands())[remoteId];
  notEqual(newRecord, undefined);
  equal(clientCommands.length, 1);

  let command = clientCommands[0];
  equal(command.command, action);
  equal(command.args.length, 2);
  deepEqual(command.args, args);
  ok(command.flowID);

  const changes = await tracker.getChangedIDs();
  notEqual(changes[remoteId], undefined);

  await cleanup();
});

// The browser UI might call _addClientCommand indirectly without awaiting on the returned promise.
// We need to make sure this doesn't result on commands not being saved.
add_task(async function test_add_client_command_race() {
  let promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(
      engine._addClientCommand(`client-${i}`, { command: "cmd", args: [] })
    );
  }
  await Promise.all(promises);

  let localCommands = await engine._readCommands();
  for (let i = 0; i < 100; i++) {
    equal(localCommands[`client-${i}`].length, 1);
  }
});

add_task(async function test_command_validation() {
  _("Verifies that command validation works properly.");

  let store = engine._store;

  let testCommands = [
    ["resetAll", [], true],
    ["resetAll", ["foo"], false],
    ["resetEngine", ["tabs"], true],
    ["resetEngine", [], false],
    ["wipeEngine", ["tabs"], true],
    ["wipeEngine", [], false],
    ["logout", [], true],
    ["logout", ["foo"], false],
    ["__UNKNOWN__", [], false],
  ];

  for (let [action, args, expectedResult] of testCommands) {
    let remoteId = Utils.makeGUID();
    let rec = new ClientsRec("clients", remoteId);

    await store.create(rec);
    await store.createRecord(remoteId, "clients");

    await engine.sendCommand(action, args, remoteId);

    let newRecord = store._remoteClients[remoteId];
    notEqual(newRecord, undefined);

    let clientCommands = (await engine._readCommands())[remoteId];

    if (expectedResult) {
      _("Ensuring command is sent: " + action);
      equal(clientCommands.length, 1);

      let command = clientCommands[0];
      equal(command.command, action);
      deepEqual(command.args, args);

      notEqual(engine._tracker, undefined);
      const changes = await engine._tracker.getChangedIDs();
      notEqual(changes[remoteId], undefined);
    } else {
      _("Ensuring command is scrubbed: " + action);
      equal(clientCommands, undefined);

      if (store._tracker) {
        equal(engine._tracker[remoteId], undefined);
      }
    }
  }
  await cleanup();
});

add_task(async function test_command_duplication() {
  _("Ensures duplicate commands are detected and not added");

  let store = engine._store;
  let remoteId = Utils.makeGUID();
  let rec = new ClientsRec("clients", remoteId);
  await store.create(rec);
  await store.createRecord(remoteId, "clients");

  let action = "resetAll";
  let args = [];

  await engine.sendCommand(action, args, remoteId);
  await engine.sendCommand(action, args, remoteId);

  let clientCommands = (await engine._readCommands())[remoteId];
  equal(clientCommands.length, 1);

  _("Check variant args length");
  await engine._saveCommands({});

  action = "resetEngine";
  await engine.sendCommand(action, [{ x: "foo" }], remoteId);
  await engine.sendCommand(action, [{ x: "bar" }], remoteId);

  _("Make sure we spot a real dupe argument.");
  await engine.sendCommand(action, [{ x: "bar" }], remoteId);

  clientCommands = (await engine._readCommands())[remoteId];
  equal(clientCommands.length, 2);

  await cleanup();
});

add_task(async function test_command_invalid_client() {
  _("Ensures invalid client IDs are caught");

  let id = Utils.makeGUID();
  let error;

  try {
    await engine.sendCommand("wipeEngine", ["tabs"], id);
  } catch (ex) {
    error = ex;
  }

  equal(error.message.indexOf("Unknown remote client ID: "), 0);

  await cleanup();
});

add_task(async function test_process_incoming_commands() {
  _("Ensures local commands are executed");

  engine.localCommands = [{ command: "logout", args: [] }];

  let ev = "weave:service:logout:finish";

  let logoutPromise = new Promise(resolve => {
    var handler = function () {
      Svc.Obs.remove(ev, handler);

      resolve();
    };

    Svc.Obs.add(ev, handler);
  });

  // logout command causes processIncomingCommands to return explicit false.
  ok(!(await engine.processIncomingCommands()));

  await logoutPromise;

  await cleanup();
});

add_task(async function test_filter_duplicate_names() {
  _(
    "Ensure that we exclude clients with identical names that haven't synced in a week."
  );

  let now = new_timestamp();
  let server = await serverForFoo(engine);
  let user = server.user("foo");

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  // Synced recently.
  let recentID = Utils.makeGUID();
  user.collection("clients").insertRecord(
    {
      id: recentID,
      name: "My Phone",
      type: "mobile",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  // synced recently, but not as recent as the phone.
  let tabletID = Utils.makeGUID();
  user.collection("clients").insertRecord(
    {
      id: tabletID,
      name: "My Tablet",
      type: "tablet",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 100
  );

  // Dupe of our client, synced more than 1 week ago.
  let dupeID = Utils.makeGUID();
  user.collection("clients").insertRecord(
    {
      id: dupeID,
      name: engine.localName,
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 604820
  );

  // Synced more than 1 week ago, but not a dupe.
  let oldID = Utils.makeGUID();
  user.collection("clients").insertRecord(
    {
      id: oldID,
      name: "My old desktop",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 604820
  );

  try {
    let store = engine._store;

    _("First sync");
    strictEqual(engine.lastRecordUpload, 0);
    ok(engine.isFirstSync);
    await syncClientsEngine(server);
    Assert.greater(engine.lastRecordUpload, 0);
    ok(!engine.isFirstSync);
    deepEqual(
      user.collection("clients").keys().sort(),
      [recentID, tabletID, dupeID, oldID, engine.localID].sort(),
      "Our record should be uploaded on first sync"
    );

    let ids = await store.getAllIDs();
    deepEqual(
      Object.keys(ids).sort(),
      [recentID, tabletID, dupeID, oldID, engine.localID].sort(),
      "Duplicate ID should remain in getAllIDs"
    );
    ok(
      await engine._store.itemExists(dupeID),
      "Dupe ID should be considered as existing for Sync methods."
    );
    ok(
      !engine.remoteClientExists(dupeID),
      "Dupe ID should not be considered as existing for external methods."
    );

    // dupe desktop should not appear in .deviceTypes.
    equal(engine.deviceTypes.get("desktop"), 2);
    equal(engine.deviceTypes.get("mobile"), 2);

    // dupe desktop should not appear in stats
    deepEqual(engine.stats, {
      hasMobile: 1,
      names: [engine.localName, "My Phone", "My Tablet", "My old desktop"],
      numClients: 4,
    });

    ok(engine.remoteClientExists(oldID), "non-dupe ID should exist.");
    ok(!engine.remoteClientExists(dupeID), "dupe ID should not exist");
    equal(
      engine.remoteClients.length,
      3,
      "dupe should not be in remoteClients"
    );

    // Check that a subsequent Sync doesn't report anything as being processed.
    let counts;
    Svc.Obs.add("weave:engine:sync:applied", function observe(subject) {
      Svc.Obs.remove("weave:engine:sync:applied", observe);
      counts = subject;
    });

    await syncClientsEngine(server);
    equal(counts.applied, 0); // We didn't report applying any records.
    equal(counts.reconciled, 5); // We reported reconcilliation for all records
    equal(counts.succeeded, 0);
    equal(counts.failed, 0);
    equal(counts.newFailed, 0);

    _("Broadcast logout to all clients");
    await engine.sendCommand("logout", []);
    await syncClientsEngine(server);

    let collection = server.getCollection("foo", "clients");
    let recentPayload = collection.cleartext(recentID);
    compareCommands(
      recentPayload.commands,
      [{ command: "logout", args: [] }],
      "Should send commands to the recent client"
    );

    let oldPayload = collection.cleartext(oldID);
    compareCommands(
      oldPayload.commands,
      [{ command: "logout", args: [] }],
      "Should send commands to the week-old client"
    );

    let dupePayload = collection.cleartext(dupeID);
    deepEqual(
      dupePayload.commands,
      [],
      "Should not send commands to the dupe client"
    );

    _("Update the dupe client's modified time");
    collection.insertRecord(
      {
        id: dupeID,
        name: engine.localName,
        type: "desktop",
        commands: [],
        version: "48",
        protocols: ["1.5"],
      },
      now - 10
    );

    _("Second sync.");
    await syncClientsEngine(server);

    ids = await store.getAllIDs();
    deepEqual(
      Object.keys(ids).sort(),
      [recentID, tabletID, oldID, dupeID, engine.localID].sort(),
      "Stale client synced, so it should no longer be marked as a dupe"
    );

    ok(
      engine.remoteClientExists(dupeID),
      "Dupe ID should appear as it synced."
    );

    // Recently synced dupe desktop should appear in .deviceTypes.
    equal(engine.deviceTypes.get("desktop"), 3);

    // Recently synced dupe desktop should now appear in stats
    deepEqual(engine.stats, {
      hasMobile: 1,
      names: [
        engine.localName,
        "My Phone",
        "My Tablet",
        engine.localName,
        "My old desktop",
      ],
      numClients: 5,
    });

    ok(
      engine.remoteClientExists(dupeID),
      "recently synced dupe ID should now exist"
    );
    equal(
      engine.remoteClients.length,
      4,
      "recently synced dupe should now be in remoteClients"
    );
  } finally {
    await cleanup();

    try {
      server.deleteCollections("foo");
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_command_sync() {
  _("Ensure that commands are synced across clients.");

  await engine._store.wipe();
  await generateNewKeys(Service.collectionKeys);

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let user = server.user("foo");
  let remoteId = Utils.makeGUID();

  function clientWBO(id) {
    return user.collection("clients").wbo(id);
  }

  _("Create remote client record");
  user.collection("clients").insertRecord({
    id: remoteId,
    name: "Remote client",
    type: "desktop",
    commands: [],
    version: "48",
    protocols: ["1.5"],
  });

  try {
    _("Syncing.");
    await syncClientsEngine(server);

    _("Checking remote record was downloaded.");
    let clientRecord = engine._store._remoteClients[remoteId];
    notEqual(clientRecord, undefined);
    equal(clientRecord.commands.length, 0);

    _("Send a command to the remote client.");
    await engine.sendCommand("wipeEngine", ["tabs"]);
    let clientCommands = (await engine._readCommands())[remoteId];
    equal(clientCommands.length, 1);
    await syncClientsEngine(server);

    _("Checking record was uploaded.");
    notEqual(clientWBO(engine.localID).payload, undefined);
    Assert.greater(engine.lastRecordUpload, 0);
    ok(!engine.isFirstSync);

    notEqual(clientWBO(remoteId).payload, undefined);

    Svc.PrefBranch.setStringPref("client.GUID", remoteId);
    await engine._resetClient();
    equal(engine.localID, remoteId);
    _("Performing sync on resetted client.");
    await syncClientsEngine(server);
    notEqual(engine.localCommands, undefined);
    equal(engine.localCommands.length, 1);

    let command = engine.localCommands[0];
    equal(command.command, "wipeEngine");
    equal(command.args.length, 1);
    equal(command.args[0], "tabs");
  } finally {
    await cleanup();

    try {
      let collection = server.getCollection("foo", "clients");
      collection.remove(remoteId);
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_clients_not_in_fxa_list() {
  _("Ensure that clients not in the FxA devices list are marked as stale.");

  await engine._store.wipe();
  await generateNewKeys(Service.collectionKeys);

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let remoteId = Utils.makeGUID();
  let remoteId2 = Utils.makeGUID();
  let collection = server.getCollection("foo", "clients");

  _("Create remote client records");
  collection.insertRecord({
    id: remoteId,
    name: "Remote client",
    type: "desktop",
    commands: [],
    version: "48",
    fxaDeviceId: remoteId,
    protocols: ["1.5"],
  });

  collection.insertRecord({
    id: remoteId2,
    name: "Remote client 2",
    type: "desktop",
    commands: [],
    version: "48",
    fxaDeviceId: remoteId2,
    protocols: ["1.5"],
  });

  let fxAccounts = engine.fxAccounts;
  engine.fxAccounts = {
    notifyDevices() {
      return Promise.resolve(true);
    },
    device: {
      getLocalId() {
        return fxAccounts.device.getLocalId();
      },
      getLocalName() {
        return fxAccounts.device.getLocalName();
      },
      getLocalType() {
        return fxAccounts.device.getLocalType();
      },
      recentDeviceList: [{ id: remoteId }],
      refreshDeviceList() {
        return Promise.resolve(true);
      },
    },
    _internal: {
      now() {
        return Date.now();
      },
    },
  };

  try {
    _("Syncing.");
    await syncClientsEngine(server);

    ok(!engine._store._remoteClients[remoteId].stale);
    ok(engine._store._remoteClients[remoteId2].stale);
  } finally {
    engine.fxAccounts = fxAccounts;
    await cleanup();

    try {
      collection.remove(remoteId);
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_dupe_device_ids() {
  _(
    "Ensure that we mark devices with duplicate fxaDeviceIds but older lastModified as stale."
  );

  await engine._store.wipe();
  await generateNewKeys(Service.collectionKeys);

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let remoteId = Utils.makeGUID();
  let remoteId2 = Utils.makeGUID();
  let remoteDeviceId = Utils.makeGUID();

  let collection = server.getCollection("foo", "clients");

  _("Create remote client records");
  collection.insertRecord(
    {
      id: remoteId,
      name: "Remote client",
      type: "desktop",
      commands: [],
      version: "48",
      fxaDeviceId: remoteDeviceId,
      protocols: ["1.5"],
    },
    new_timestamp() - 3
  );
  collection.insertRecord({
    id: remoteId2,
    name: "Remote client",
    type: "desktop",
    commands: [],
    version: "48",
    fxaDeviceId: remoteDeviceId,
    protocols: ["1.5"],
  });

  let fxAccounts = engine.fxAccounts;
  engine.fxAccounts = {
    notifyDevices() {
      return Promise.resolve(true);
    },
    device: {
      getLocalId() {
        return fxAccounts.device.getLocalId();
      },
      getLocalName() {
        return fxAccounts.device.getLocalName();
      },
      getLocalType() {
        return fxAccounts.device.getLocalType();
      },
      recentDeviceList: [{ id: remoteDeviceId }],
      refreshDeviceList() {
        return Promise.resolve(true);
      },
    },
    _internal: {
      now() {
        return Date.now();
      },
    },
  };

  try {
    _("Syncing.");
    await syncClientsEngine(server);

    ok(engine._store._remoteClients[remoteId].stale);
    ok(!engine._store._remoteClients[remoteId2].stale);
  } finally {
    engine.fxAccounts = fxAccounts;
    await cleanup();

    try {
      collection.remove(remoteId);
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_refresh_fxa_device_list() {
  _("Ensure we refresh the fxa device list when we expect to.");

  await engine._store.wipe();
  engine._lastFxaDeviceRefresh = 0;
  await generateNewKeys(Service.collectionKeys);

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let numRefreshes = 0;
  let now = Date.now();
  let fxAccounts = engine.fxAccounts;
  engine.fxAccounts = {
    notifyDevices() {
      return Promise.resolve(true);
    },
    device: {
      getLocalId() {
        return fxAccounts.device.getLocalId();
      },
      getLocalName() {
        return fxAccounts.device.getLocalName();
      },
      getLocalType() {
        return fxAccounts.device.getLocalType();
      },
      recentDeviceList: [],
      refreshDeviceList() {
        numRefreshes += 1;
        return Promise.resolve(true);
      },
    },
    _internal: {
      now() {
        return now;
      },
    },
  };

  try {
    _("Syncing.");
    await syncClientsEngine(server);
    Assert.equal(numRefreshes, 1, "first sync should refresh");
    now += 1000; // a second later.
    await syncClientsEngine(server);
    Assert.equal(numRefreshes, 1, "next sync should not refresh");
    now += 60 * 60 * 2 * 1000; // 2 hours later
    await syncClientsEngine(server);
    Assert.equal(numRefreshes, 2, "2 hours later should refresh");
    now += 1000; // a second later.
    Assert.equal(numRefreshes, 2, "next sync should not refresh");
  } finally {
    await cleanup();
    await promiseStopServer(server);
  }
});

add_task(async function test_optional_client_fields() {
  _("Ensure that we produce records with the fields added in Bug 1097222.");

  const SUPPORTED_PROTOCOL_VERSIONS = ["1.5"];
  let local = await engine._store.createRecord(engine.localID, "clients");
  equal(local.name, engine.localName);
  equal(local.type, engine.localType);
  equal(local.version, Services.appinfo.version);
  deepEqual(local.protocols, SUPPORTED_PROTOCOL_VERSIONS);

  // Optional fields.
  // Make sure they're what they ought to be...
  equal(local.os, Services.appinfo.OS);
  equal(local.appPackage, Services.appinfo.ID);

  // ... and also that they're non-empty.
  ok(!!local.os);
  ok(!!local.appPackage);
  ok(!!local.application);

  // We don't currently populate device or formfactor.
  // See Bug 1100722, Bug 1100723.

  await cleanup();
});

add_task(async function test_merge_commands() {
  _("Verifies local commands for remote clients are merged with the server's");

  let now = new_timestamp();
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let collection = server.getCollection("foo", "clients");

  let desktopID = Utils.makeGUID();
  collection.insertRecord(
    {
      id: desktopID,
      name: "Desktop client",
      type: "desktop",
      commands: [
        {
          command: "wipeEngine",
          args: ["history"],
          flowID: Utils.makeGUID(),
        },
      ],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  let mobileID = Utils.makeGUID();
  collection.insertRecord(
    {
      id: mobileID,
      name: "Mobile client",
      type: "mobile",
      commands: [
        {
          command: "logout",
          args: [],
          flowID: Utils.makeGUID(),
        },
      ],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  try {
    _("First sync. 2 records downloaded.");
    strictEqual(engine.lastRecordUpload, 0);
    ok(engine.isFirstSync);
    await syncClientsEngine(server);

    _("Broadcast logout to all clients");
    await engine.sendCommand("logout", []);
    await syncClientsEngine(server);

    let desktopPayload = collection.cleartext(desktopID);
    compareCommands(
      desktopPayload.commands,
      [
        {
          command: "wipeEngine",
          args: ["history"],
        },
        {
          command: "logout",
          args: [],
        },
      ],
      "Should send the logout command to the desktop client"
    );

    let mobilePayload = collection.cleartext(mobileID);
    compareCommands(
      mobilePayload.commands,
      [{ command: "logout", args: [] }],
      "Should not send a duplicate logout to the mobile client"
    );
  } finally {
    await cleanup();

    try {
      server.deleteCollections("foo");
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_duplicate_remote_commands() {
  _(
    "Verifies local commands for remote clients are sent only once (bug 1289287)"
  );

  let now = new_timestamp();
  let server = await serverForFoo(engine);

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let collection = server.getCollection("foo", "clients");

  let desktopID = Utils.makeGUID();
  collection.insertRecord(
    {
      id: desktopID,
      name: "Desktop client",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  try {
    _("First sync. 1 record downloaded.");
    strictEqual(engine.lastRecordUpload, 0);
    ok(engine.isFirstSync);
    await syncClientsEngine(server);

    _("Send command to client to wipe history engine");
    await engine.sendCommand("wipeEngine", ["history"]);
    await syncClientsEngine(server);

    _(
      "Simulate the desktop client consuming the command and syncing to the server"
    );
    collection.insertRecord(
      {
        id: desktopID,
        name: "Desktop client",
        type: "desktop",
        commands: [],
        version: "48",
        protocols: ["1.5"],
      },
      now - 10
    );

    _("Send another command to the desktop client to wipe tabs engine");
    await engine.sendCommand("wipeEngine", ["tabs"], desktopID);
    await syncClientsEngine(server);

    let desktopPayload = collection.cleartext(desktopID);
    compareCommands(
      desktopPayload.commands,
      [
        {
          command: "wipeEngine",
          args: ["tabs"],
        },
      ],
      "Should only send the second command to the desktop client"
    );
  } finally {
    await cleanup();

    try {
      server.deleteCollections("foo");
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_upload_after_reboot() {
  _("Multiple downloads, reboot, then upload (bug 1289287)");

  let now = new_timestamp();
  let server = await serverForFoo(engine);

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let collection = server.getCollection("foo", "clients");

  let deviceBID = Utils.makeGUID();
  let deviceCID = Utils.makeGUID();
  collection.insertRecord(
    {
      id: deviceBID,
      name: "Device B",
      type: "desktop",
      commands: [
        {
          command: "wipeEngine",
          args: ["history"],
          flowID: Utils.makeGUID(),
        },
      ],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );
  collection.insertRecord(
    {
      id: deviceCID,
      name: "Device C",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  try {
    _("First sync. 2 records downloaded.");
    strictEqual(engine.lastRecordUpload, 0);
    ok(engine.isFirstSync);
    await syncClientsEngine(server);

    _("Send command to client to wipe tab engine");
    await engine.sendCommand("wipeEngine", ["tabs"], deviceBID);

    const oldUploadOutgoing = SyncEngine.prototype._uploadOutgoing;
    SyncEngine.prototype._uploadOutgoing = async () =>
      engine._onRecordsWritten([], [deviceBID]);
    await syncClientsEngine(server);

    let deviceBPayload = collection.cleartext(deviceBID);
    compareCommands(
      deviceBPayload.commands,
      [
        {
          command: "wipeEngine",
          args: ["history"],
        },
      ],
      "Should be the same because the upload failed"
    );

    _("Simulate the client B consuming the command and syncing to the server");
    collection.insertRecord(
      {
        id: deviceBID,
        name: "Device B",
        type: "desktop",
        commands: [],
        version: "48",
        protocols: ["1.5"],
      },
      now - 10
    );

    // Simulate reboot
    SyncEngine.prototype._uploadOutgoing = oldUploadOutgoing;
    engine = Service.clientsEngine = new ClientEngine(Service);
    await engine.initialize();

    await syncClientsEngine(server);

    deviceBPayload = collection.cleartext(deviceBID);
    compareCommands(
      deviceBPayload.commands,
      [
        {
          command: "wipeEngine",
          args: ["tabs"],
        },
      ],
      "Should only had written our outgoing command"
    );
  } finally {
    await cleanup();

    try {
      server.deleteCollections("foo");
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_keep_cleared_commands_after_reboot() {
  _(
    "Download commands, fail upload, reboot, then apply new commands (bug 1289287)"
  );

  let now = new_timestamp();
  let server = await serverForFoo(engine);

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let collection = server.getCollection("foo", "clients");

  let deviceBID = Utils.makeGUID();
  let deviceCID = Utils.makeGUID();
  collection.insertRecord(
    {
      id: engine.localID,
      name: "Device A",
      type: "desktop",
      commands: [
        {
          command: "wipeEngine",
          args: ["history"],
          flowID: Utils.makeGUID(),
        },
        {
          command: "wipeEngine",
          args: ["tabs"],
          flowID: Utils.makeGUID(),
        },
      ],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );
  collection.insertRecord(
    {
      id: deviceBID,
      name: "Device B",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );
  collection.insertRecord(
    {
      id: deviceCID,
      name: "Device C",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  try {
    _("First sync. Download remote and our record.");
    strictEqual(engine.lastRecordUpload, 0);
    ok(engine.isFirstSync);

    const oldUploadOutgoing = SyncEngine.prototype._uploadOutgoing;
    SyncEngine.prototype._uploadOutgoing = async () =>
      engine._onRecordsWritten([], [deviceBID]);
    let commandsProcessed = 0;
    engine.service.wipeClient = _engine => {
      commandsProcessed++;
    };

    await syncClientsEngine(server);
    await engine.processIncomingCommands(); // Not called by the engine.sync(), gotta call it ourselves
    equal(commandsProcessed, 2, "We processed 2 commands");

    let localRemoteRecord = collection.cleartext(engine.localID);
    compareCommands(
      localRemoteRecord.commands,
      [
        {
          command: "wipeEngine",
          args: ["history"],
        },
        {
          command: "wipeEngine",
          args: ["tabs"],
        },
      ],
      "Should be the same because the upload failed"
    );

    // Another client sends a wipe command
    collection.insertRecord(
      {
        id: engine.localID,
        name: "Device A",
        type: "desktop",
        commands: [
          {
            command: "wipeEngine",
            args: ["history"],
            flowID: Utils.makeGUID(),
          },
          {
            command: "wipeEngine",
            args: ["tabs"],
            flowID: Utils.makeGUID(),
          },
          {
            command: "wipeEngine",
            args: ["bookmarks"],
            flowID: Utils.makeGUID(),
          },
        ],
        version: "48",
        protocols: ["1.5"],
      },
      now - 5
    );

    // Simulate reboot
    SyncEngine.prototype._uploadOutgoing = oldUploadOutgoing;
    engine = Service.clientsEngine = new ClientEngine(Service);
    await engine.initialize();

    commandsProcessed = 0;
    engine.service.wipeClient = _engine => {
      commandsProcessed++;
    };
    await syncClientsEngine(server);
    await engine.processIncomingCommands();
    equal(
      commandsProcessed,
      1,
      "We processed one command (the other were cleared)"
    );

    localRemoteRecord = collection.cleartext(deviceBID);
    deepEqual(localRemoteRecord.commands, [], "Should be empty");
  } finally {
    await cleanup();

    // Reset service (remove mocks)
    engine = Service.clientsEngine = new ClientEngine(Service);
    await engine.initialize();
    await engine._resetClient();

    try {
      server.deleteCollections("foo");
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_deleted_commands() {
  _("Verifies commands for a deleted client are discarded");

  let now = new_timestamp();
  let server = await serverForFoo(engine);

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  let collection = server.getCollection("foo", "clients");

  let activeID = Utils.makeGUID();
  collection.insertRecord(
    {
      id: activeID,
      name: "Active client",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  let deletedID = Utils.makeGUID();
  collection.insertRecord(
    {
      id: deletedID,
      name: "Client to delete",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    },
    now - 10
  );

  try {
    _("First sync. 2 records downloaded.");
    await syncClientsEngine(server);

    _("Delete a record on the server.");
    collection.remove(deletedID);

    _("Broadcast a command to all clients");
    await engine.sendCommand("logout", []);
    await syncClientsEngine(server);

    deepEqual(
      collection.keys().sort(),
      [activeID, engine.localID].sort(),
      "Should not reupload deleted clients"
    );

    let activePayload = collection.cleartext(activeID);
    compareCommands(
      activePayload.commands,
      [{ command: "logout", args: [] }],
      "Should send the command to the active client"
    );
  } finally {
    await cleanup();

    try {
      server.deleteCollections("foo");
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function test_command_sync() {
  _("Notify other clients when writing their record.");

  await engine._store.wipe();
  await generateNewKeys(Service.collectionKeys);

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let collection = server.getCollection("foo", "clients");
  let remoteId = Utils.makeGUID();
  let remoteId2 = Utils.makeGUID();

  _("Create remote client record 1");
  collection.insertRecord({
    id: remoteId,
    name: "Remote client",
    type: "desktop",
    commands: [],
    version: "48",
    protocols: ["1.5"],
  });

  _("Create remote client record 2");
  collection.insertRecord({
    id: remoteId2,
    name: "Remote client 2",
    type: "mobile",
    commands: [],
    version: "48",
    protocols: ["1.5"],
  });

  try {
    equal(collection.count(), 2, "2 remote records written");
    await syncClientsEngine(server);
    equal(
      collection.count(),
      3,
      "3 remote records written (+1 for the synced local record)"
    );

    await engine.sendCommand("wipeEngine", ["tabs"]);
    await engine._tracker.addChangedID(engine.localID);
    const getClientFxaDeviceId = sinon
      .stub(engine, "getClientFxaDeviceId")
      .callsFake(id => "fxa-" + id);
    const engineMock = sinon.mock(engine);
    let _notifyCollectionChanged = engineMock
      .expects("_notifyCollectionChanged")
      .withArgs(["fxa-" + remoteId, "fxa-" + remoteId2]);
    _("Syncing.");
    await syncClientsEngine(server);
    _notifyCollectionChanged.verify();

    engineMock.restore();
    getClientFxaDeviceId.restore();
  } finally {
    await cleanup();
    await engine._tracker.clearChangedIDs();

    try {
      server.deleteCollections("foo");
    } finally {
      await promiseStopServer(server);
    }
  }
});

add_task(async function ensureSameFlowIDs() {
  // Clear events from other test cases.
  Services.fog.testResetFOG();

  let server = await serverForFoo(engine);
  try {
    // Setup 2 clients, send them a command, and ensure we get to events
    // written, both with the same flowID.
    await SyncTestingInfrastructure(server);
    let collection = server.getCollection("foo", "clients");

    let remoteId = Utils.makeGUID();
    let remoteId2 = Utils.makeGUID();

    _("Create remote client record 1");
    collection.insertRecord({
      id: remoteId,
      name: "Remote client",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    });

    _("Create remote client record 2");
    collection.insertRecord({
      id: remoteId2,
      name: "Remote client 2",
      type: "mobile",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    });

    await syncClientsEngine(server);
    await engine.sendCommand("wipeEngine", ["tabs"]);
    await syncClientsEngine(server);
    let wipeEvents = Glean.syncClient.sendcommand.testGetValue();
    equal(wipeEvents.length, 2);
    equal(wipeEvents[0].extra.flow_id, wipeEvents[1].extra.flow_id);
    Services.fog.testResetFOG();
    // Wipe remote clients to ensure deduping doesn't prevent us from adding the command.
    for (let client of Object.values(engine._store._remoteClients)) {
      client.commands = [];
    }
    // check it's correctly used when we specify a flow ID
    let flowID = Utils.makeGUID();
    await engine.sendCommand("wipeEngine", ["tabs"], null, { flowID });
    await syncClientsEngine(server);
    wipeEvents = Glean.syncClient.sendcommand.testGetValue();
    equal(wipeEvents.length, 2);
    equal(wipeEvents[0].extra.flow_id, flowID);
    equal(wipeEvents[1].extra.flow_id, flowID);
    Services.fog.testResetFOG();

    // Wipe remote clients to ensure deduping doesn't prevent us from adding the command.
    for (let client of Object.values(engine._store._remoteClients)) {
      client.commands = [];
    }

    // and that it works when something else is in "extra"
    await engine.sendCommand("wipeEngine", ["tabs"], null, {
      reason: "testing",
    });
    await syncClientsEngine(server);
    wipeEvents = Glean.syncClient.sendcommand.testGetValue();
    equal(wipeEvents.length, 2);
    equal(wipeEvents[0].extra.flow_id, wipeEvents[1].extra.flow_id);
    equal(wipeEvents[0].extra.reason, "testing");
    equal(wipeEvents[1].extra.reason, "testing");
    Services.fog.testResetFOG();
    // Wipe remote clients to ensure deduping doesn't prevent us from adding the command.
    for (let client of Object.values(engine._store._remoteClients)) {
      client.commands = [];
    }

    // and when both are specified.
    await engine.sendCommand("wipeEngine", ["tabs"], null, {
      reason: "testing",
      flowID,
    });
    await syncClientsEngine(server);
    wipeEvents = Glean.syncClient.sendcommand.testGetValue();
    equal(wipeEvents.length, 2);
    equal(wipeEvents[0].extra.flow_id, flowID);
    equal(wipeEvents[1].extra.flow_id, flowID);
    equal(wipeEvents[0].extra.reason, "testing");
    equal(wipeEvents[1].extra.reason, "testing");
    // Wipe remote clients to ensure deduping doesn't prevent us from adding the command.
    for (let client of Object.values(engine._store._remoteClients)) {
      client.commands = [];
    }
  } finally {
    cleanup();
    await promiseStopServer(server);
  }
});

add_task(async function test_duplicate_commands_telemetry() {
  // Clear events from other test cases.
  Services.fog.testResetFOG();

  let server = await serverForFoo(engine);
  try {
    await SyncTestingInfrastructure(server);
    let collection = server.getCollection("foo", "clients");

    let remoteId = Utils.makeGUID();
    let remoteId2 = Utils.makeGUID();

    _("Create remote client record 1");
    collection.insertRecord({
      id: remoteId,
      name: "Remote client",
      type: "desktop",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    });

    _("Create remote client record 2");
    collection.insertRecord({
      id: remoteId2,
      name: "Remote client 2",
      type: "mobile",
      commands: [],
      version: "48",
      protocols: ["1.5"],
    });

    await syncClientsEngine(server);
    // Make sure deduping works before syncing
    await engine.sendCommand("wipeEngine", ["history"], remoteId);
    await engine.sendCommand("wipeEngine", ["history"], remoteId);
    equal(Glean.syncClient.sendcommand.testGetValue().length, 1);
    await syncClientsEngine(server);
    // And after syncing.
    await engine.sendCommand("wipeEngine", ["history"], remoteId);
    equal(Glean.syncClient.sendcommand.testGetValue().length, 1);
    // Ensure we aren't deduping commands to different clients
    await engine.sendCommand("wipeEngine", ["history"], remoteId2);
    equal(Glean.syncClient.sendcommand.testGetValue().length, 2);
  } finally {
    cleanup();
    await promiseStopServer(server);
  }
});

add_task(async function test_other_clients_notified_on_first_sync() {
  _(
    "Ensure that other clients are notified when we upload our client record for the first time."
  );

  await engine.resetLastSync();
  await engine._store.wipe();
  await generateNewKeys(Service.collectionKeys);

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  const fxAccounts = engine.fxAccounts;
  let calls = 0;
  engine.fxAccounts = {
    device: {
      getLocalId() {
        return fxAccounts.device.getLocalId();
      },
      getLocalName() {
        return fxAccounts.device.getLocalName();
      },
      getLocalType() {
        return fxAccounts.device.getLocalType();
      },
    },
    notifyDevices() {
      calls++;
      return Promise.resolve(true);
    },
    _internal: {
      now() {
        return Date.now();
      },
    },
  };

  try {
    engine.lastRecordUpload = 0;
    _("First sync, should notify other clients");
    await syncClientsEngine(server);
    equal(calls, 1);

    _("Second sync, should not notify other clients");
    await syncClientsEngine(server);
    equal(calls, 1);
  } finally {
    engine.fxAccounts = fxAccounts;
    cleanup();
    await promiseStopServer(server);
  }
});

add_task(
  async function device_disconnected_notification_updates_known_stale_clients() {
    const spyUpdate = sinon.spy(engine, "updateKnownStaleClients");

    Services.obs.notifyObservers(
      null,
      "fxaccounts:device_disconnected",
      JSON.stringify({ isLocalDevice: false })
    );
    ok(spyUpdate.calledOnce, "updateKnownStaleClients should be called");
    spyUpdate.resetHistory();

    Services.obs.notifyObservers(
      null,
      "fxaccounts:device_disconnected",
      JSON.stringify({ isLocalDevice: true })
    );
    ok(spyUpdate.notCalled, "updateKnownStaleClients should not be called");

    spyUpdate.restore();
  }
);

add_task(async function update_known_stale_clients() {
  const makeFakeClient = id => ({ id, fxaDeviceId: `fxa-${id}` });
  const clients = [
    makeFakeClient("one"),
    makeFakeClient("two"),
    makeFakeClient("three"),
  ];
  const stubRemoteClients = sinon
    .stub(engine._store, "_remoteClients")
    .get(() => {
      return clients;
    });
  const stubFetchFxADevices = sinon
    .stub(engine, "_fetchFxADevices")
    .callsFake(() => {
      engine._knownStaleFxADeviceIds = ["fxa-one", "fxa-two"];
    });

  engine._knownStaleFxADeviceIds = null;
  await engine.updateKnownStaleClients();
  ok(clients[0].stale);
  ok(clients[1].stale);
  ok(!clients[2].stale);

  stubRemoteClients.restore();
  stubFetchFxADevices.restore();
});

add_task(async function test_create_record_command_limit() {
  await engine._store.wipe();
  await generateNewKeys(Service.collectionKeys);

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  const fakeLimit = 4 * 1024;

  let maxSizeStub = sinon
    .stub(Service, "getMemcacheMaxRecordPayloadSize")
    .callsFake(() => fakeLimit);

  let user = server.user("foo");
  let remoteId = Utils.makeGUID();

  _("Create remote client record");
  user.collection("clients").insertRecord({
    id: remoteId,
    name: "Remote client",
    type: "desktop",
    commands: [],
    version: "57",
    protocols: ["1.5"],
  });

  try {
    _("Initial sync.");
    await syncClientsEngine(server);

    _("Send a fairly sane number of commands.");

    for (let i = 0; i < 5; ++i) {
      await engine.sendCommand("wipeEngine", [`history: ${i}`], remoteId);
    }

    await syncClientsEngine(server);

    _("Make sure they all fit and weren't dropped.");
    let parsedServerRecord = user.collection("clients").cleartext(remoteId);

    equal(parsedServerRecord.commands.length, 5);

    await engine.sendCommand("wipeEngine", ["history"], remoteId);

    _("Send a not-sane number of commands.");
    // Much higher than the maximum number of commands we could actually fit.
    for (let i = 0; i < 500; ++i) {
      await engine.sendCommand("wipeEngine", [`tabs: ${i}`], remoteId);
    }

    await syncClientsEngine(server);

    _("Ensure we didn't overflow the server limit.");
    let wbo = user.collection("clients").wbo(remoteId);
    less(wbo.payload.length, fakeLimit);

    _(
      "And that the data we uploaded is both sane json and containing some commands."
    );
    let remoteCommands = wbo.getCleartext().commands;
    greater(remoteCommands.length, 2);
    let firstCommand = remoteCommands[0];
    _(
      "The first command should still be present, since it had a high priority"
    );
    equal(firstCommand.command, "wipeEngine");
    _("And the last command in the list should be the last command we sent.");
    let lastCommand = remoteCommands[remoteCommands.length - 1];
    equal(lastCommand.command, "wipeEngine");
    deepEqual(lastCommand.args, ["tabs: 499"]);
  } finally {
    maxSizeStub.restore();
    await cleanup();
    try {
      let collection = server.getCollection("foo", "clients");
      collection.remove(remoteId);
    } finally {
      await promiseStopServer(server);
    }
  }
});
