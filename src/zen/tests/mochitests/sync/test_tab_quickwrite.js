/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.importESModule("resource://services-sync/engines/tabs.sys.mjs");
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

const { TabProvider } = ChromeUtils.importESModule(
  "resource://services-sync/engines/tabs.sys.mjs"
);

const FAR_FUTURE = 4102405200000; // 2100/01/01

add_task(async function setup() {
  // Since these are xpcshell tests, we'll need to mock ui features
  TabProvider.getOrderedNonPrivateWindows =
    mockGetOrderedNonPrivateWindows.bind(this, ["http://foo.com"]);
});

async function prepareServer() {
  _("Setting up Sync server");
  Service.serverConfiguration = {
    max_post_records: 100,
  };

  let server = new SyncServer();
  server.start();
  await SyncTestingInfrastructure(server, "username");
  server.registerUser("username");

  let collection = server.createCollection("username", "tabs");
  await generateNewKeys(Service.collectionKeys);

  let engine = Service.engineManager.get("tabs");
  await engine.initialize();

  return { server, collection, engine };
}

async function withPatchedValue(object, name, patchedVal, fn) {
  _(`patching ${name}=${patchedVal}`);
  let old = object[name];
  object[name] = patchedVal;
  try {
    await fn();
  } finally {
    object[name] = old;
  }
}

add_task(async function test_tab_quickwrite_works() {
  _("Ensure a simple quickWrite works.");
  let { server, collection, engine } = await prepareServer();
  Assert.equal(collection.count(), 0, "starting with 0 tab records");
  Assert.ok(await engine.quickWrite());
  // Validate we didn't bork lastSync
  let lastSync = await engine.getLastSync();
  Assert.less(lastSync, FAR_FUTURE);
  Assert.equal(collection.count(), 1, "tab record was written");

  await promiseStopServer(server);
});

add_task(async function test_tab_bad_status() {
  _("Ensure quickWrite silently aborts when we aren't setup correctly.");
  let { server, engine } = await prepareServer();
  // Store the original lock to reset it back after this test
  let lock = engine.lock;
  // Arrange for this test to fail if it tries to take the lock.
  engine.lock = function () {
    throw new Error("this test should abort syncing before locking");
  };
  let quickWrite = engine.quickWrite.bind(engine); // lol javascript.

  await withPatchedValue(engine, "enabled", false, quickWrite);
  await withPatchedValue(Service, "serverConfiguration", null, quickWrite);

  Services.prefs.clearUserPref("services.sync.username");
  await quickWrite();
  // Validate we didn't bork lastSync
  let lastSync = await engine.getLastSync();
  Assert.less(lastSync, FAR_FUTURE);
  Service.status.resetSync();
  engine.lock = lock;
  await promiseStopServer(server);
});

add_task(async function test_tab_quickwrite_lock() {
  _("Ensure we fail to quickWrite if the engine is locked.");
  let { server, collection, engine } = await prepareServer();

  Assert.equal(collection.count(), 0, "starting with 0 tab records");
  engine.lock();
  Assert.ok(!(await engine.quickWrite()));
  Assert.equal(collection.count(), 0, "didn't sync due to being locked");
  engine.unlock();

  await promiseStopServer(server);
});

add_task(async function test_tab_quickwrite_keeps_old_tabs() {
  _("Ensure we don't delete other tabs on quickWrite (bug 1801295).");
  let { server, engine } = await prepareServer();

  // The ID of another device.
  const id = "fake-guid-99";

  // The clients engine is always going to tell us there are no other clients,
  // but we need other clients, so we trick it.
  // (We can't just stick this on the server, because we treat it as stale because it
  // doesn't appear in the fxa list - but tricking it this way works)
  let observeClientsFinished = (_subject, _topic, data) => {
    if (data == "clients") {
      engine.service.clientsEngine.fxAccounts.device._deviceListCache = {
        devices: [],
      };
      // trick the clients engine into thinking it has a remote client with the same guid.
      engine.service.clientsEngine._store._remoteClients = {};
      engine.service.clientsEngine._store._remoteClients[id] = {
        id,
        fxaDeviceId: id,
      };
    }
  };
  Services.obs.addObserver(observeClientsFinished, "weave:engine:sync:finish");

  // need a first sync to ensure everything is setup correctly.
  await Service.sync({ engines: ["tabs"] });

  let remoteRecord = encryptPayload({
    id,
    clientName: "not local",
    tabs: [
      {
        title: "title2",
        urlHistory: ["http://bar.com/"],
        icon: "",
        lastUsed: 3000,
      },
    ],
  });

  let collection = server.getCollection("username", "tabs");
  collection.insert(id, remoteRecord);

  // This test can be flakey because sometimes we are so fast we think there is nothing to do.
  // Resetting the last sync time here ensures we always fetch records from the server.
  engine.setLastSync(0);
  await Service.sync({ engines: ["tabs"] });

  // collection should now have 2 records - ours and the pretend remote one we inserted.
  Assert.equal(collection.count(), 2, "starting with 2 tab records");

  let clients = await engine.getAllClients();
  Assert.equal(clients.length, 1);

  _("Doing a quick-write");
  Assert.ok(await engine.quickWrite());

  // Should still have our client after a quickWrite.
  _("Grabbing clients after the quick-write");
  clients = await engine.getAllClients();
  Assert.equal(clients.length, 1);

  engine.service.clientsEngine._store._remoteClients = {};

  Services.obs.removeObserver(
    observeClientsFinished,
    "weave:engine:sync:finish"
  );

  await promiseStopServer(server);
});

add_task(async function test_tab_lastSync() {
  _("Ensure we restore the lastSync timestamp after a quick-write.");
  let { server, collection, engine } = await prepareServer();

  await engine.initialize();
  await engine.service.clientsEngine.initialize();

  let origLastSync = engine.lastSync;
  Assert.ok(await engine.quickWrite());
  Assert.equal(engine.lastSync, origLastSync);
  Assert.equal(collection.count(), 1, "successful sync");
  engine.unlock();

  await promiseStopServer(server);
});

add_task(async function test_tab_quickWrite_telemetry() {
  _("Ensure we record the telemetry we expect.");
  // hook into telemetry
  let telem = get_sync_test_telemetry();
  telem.payloads = [];
  let oldSubmit = telem.submit;
  let submitPromise = new Promise(resolve => {
    telem.submit = function (ping) {
      telem.submit = oldSubmit;
      resolve(ping);
    };
  });

  let { server, collection, engine } = await prepareServer();

  Assert.equal(collection.count(), 0, "starting with 0 tab records");
  Assert.ok(await engine.quickWrite());
  Assert.equal(collection.count(), 1, "tab record was written");

  let ping = await submitPromise;
  let syncs = ping.syncs;
  Assert.equal(syncs.length, 1);
  let sync = syncs[0];
  Assert.equal(sync.why, "quick-write");
  Assert.equal(sync.engines.length, 1);
  Assert.equal(sync.engines[0].name, "tabs");

  await promiseStopServer(server);
});
