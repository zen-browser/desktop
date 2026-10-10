/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

Svc.PrefBranch.setStringPref("registerEngines", "");
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

let scheduler;
let clientsEngine;

async function sync_httpd_setup() {
  let clientsSyncID = await clientsEngine.resetLocalSyncID();
  let global = new ServerWBO("global", {
    syncID: Service.syncID,
    storageVersion: STORAGE_VERSION,
    engines: {
      clients: { version: clientsEngine.version, syncID: clientsSyncID },
    },
  });
  let clientsColl = new ServerCollection({}, true);

  // Tracking info/collections.
  let collectionsHelper = track_collections_helper();
  let upd = collectionsHelper.with_updated_collection;

  return httpd_setup({
    "/1.1/johndoe/storage/meta/global": upd("meta", global.handler()),
    "/1.1/johndoe/info/collections": collectionsHelper.handler,
    "/1.1/johndoe/storage/crypto/keys": upd(
      "crypto",
      new ServerWBO("keys").handler()
    ),
    "/1.1/johndoe/storage/clients": upd("clients", clientsColl.handler()),
  });
}

async function setUp(server) {
  syncTestLogging();
  await configureIdentity({ username: "johndoe" }, server);
  await generateNewKeys(Service.collectionKeys);
  let serverKeys = Service.collectionKeys.asWBO("crypto", "keys");
  await serverKeys.encrypt(Service.identity.syncKeyBundle);
  await serverKeys.upload(Service.resource(Service.cryptoKeysURL));
}

add_task(async function setup() {
  scheduler = Service.scheduler;
  clientsEngine = Service.clientsEngine;

  // Don't remove stale clients when syncing. This is a test-only workaround
  // that lets us add clients directly to the store, without losing them on
  // the next sync.
  clientsEngine._removeRemoteClient = async () => {};
});

add_task(async function test_successful_sync_adjustSyncInterval() {
  enableValidationPrefs();

  _("Test successful sync calling adjustSyncInterval");
  let syncSuccesses = 0;
  function onSyncFinish() {
    _("Sync success.");
    syncSuccesses++;
  }
  Svc.Obs.add("weave:service:sync:finish", onSyncFinish);

  let server = await sync_httpd_setup();
  await setUp(server);

  // Confirm defaults
  Assert.ok(!scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
  Assert.ok(!scheduler.hasIncomingItems);

  _("Test as long as numClients <= 1 our sync interval is SINGLE_USER.");
  // idle == true && numClients <= 1 && hasIncomingItems == false
  scheduler.idle = true;
  await Service.sync();
  Assert.equal(syncSuccesses, 1);
  Assert.ok(scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(!scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  // idle == false && numClients <= 1 && hasIncomingItems == false
  scheduler.idle = false;
  await Service.sync();
  Assert.equal(syncSuccesses, 2);
  Assert.ok(!scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(!scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  // idle == false && numClients <= 1 && hasIncomingItems == true
  scheduler.hasIncomingItems = true;
  await Service.sync();
  Assert.equal(syncSuccesses, 3);
  Assert.ok(!scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  // idle == true && numClients <= 1 && hasIncomingItems == true
  scheduler.idle = true;
  await Service.sync();
  Assert.equal(syncSuccesses, 4);
  Assert.ok(scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  _(
    "Test as long as idle && numClients > 1 our sync interval is idleInterval."
  );
  // idle == true && numClients > 1 && hasIncomingItems == true
  await Service.clientsEngine._store.create({
    id: "foo",
    cleartext: { name: "bar", type: "mobile" },
  });
  await Service.sync();
  Assert.equal(syncSuccesses, 5);
  Assert.ok(scheduler.idle);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.idleInterval);

  // idle == true && numClients > 1 && hasIncomingItems == false
  scheduler.hasIncomingItems = false;
  await Service.sync();
  Assert.equal(syncSuccesses, 6);
  Assert.ok(scheduler.idle);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(!scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.idleInterval);

  _("Test non-idle, numClients > 1, no incoming items => activeInterval.");
  // idle == false && numClients > 1 && hasIncomingItems == false
  scheduler.idle = false;
  await Service.sync();
  Assert.equal(syncSuccesses, 7);
  Assert.ok(!scheduler.idle);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(!scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);

  _("Test non-idle, numClients > 1, incoming items => immediateInterval.");
  // idle == false && numClients > 1 && hasIncomingItems == true
  scheduler.hasIncomingItems = true;
  await Service.sync();
  Assert.equal(syncSuccesses, 8);
  Assert.ok(!scheduler.idle);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(!scheduler.hasIncomingItems); // gets reset to false
  Assert.equal(scheduler.syncInterval, scheduler.immediateInterval);

  Svc.Obs.remove("weave:service:sync:finish", onSyncFinish);
  await Service.startOver();
  await promiseStopServer(server);
});

add_task(async function test_unsuccessful_sync_adjustSyncInterval() {
  enableValidationPrefs();

  _("Test unsuccessful sync calling adjustSyncInterval");

  let syncFailures = 0;
  function onSyncError() {
    _("Sync error.");
    syncFailures++;
  }
  Svc.Obs.add("weave:service:sync:error", onSyncError);

  _("Test unsuccessful sync calls adjustSyncInterval");
  // Force sync to fail.
  Svc.PrefBranch.setStringPref("firstSync", "notReady");

  let server = await sync_httpd_setup();
  await setUp(server);

  // Confirm defaults
  Assert.ok(!scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
  Assert.ok(!scheduler.hasIncomingItems);

  _("Test as long as numClients <= 1 our sync interval is SINGLE_USER.");
  // idle == true && numClients <= 1 && hasIncomingItems == false
  scheduler.idle = true;
  await Service.sync();
  Assert.equal(syncFailures, 1);
  Assert.ok(scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(!scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  // idle == false && numClients <= 1 && hasIncomingItems == false
  scheduler.idle = false;
  await Service.sync();
  Assert.equal(syncFailures, 2);
  Assert.ok(!scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(!scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  // idle == false && numClients <= 1 && hasIncomingItems == true
  scheduler.hasIncomingItems = true;
  await Service.sync();
  Assert.equal(syncFailures, 3);
  Assert.ok(!scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  // idle == true && numClients <= 1 && hasIncomingItems == true
  scheduler.idle = true;
  await Service.sync();
  Assert.equal(syncFailures, 4);
  Assert.ok(scheduler.idle);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  _(
    "Test as long as idle && numClients > 1 our sync interval is idleInterval."
  );
  // idle == true && numClients > 1 && hasIncomingItems == true
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 2);
  scheduler.updateClientMode();

  await Service.sync();
  Assert.equal(syncFailures, 5);
  Assert.ok(scheduler.idle);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.idleInterval);

  // idle == true && numClients > 1 && hasIncomingItems == false
  scheduler.hasIncomingItems = false;
  await Service.sync();
  Assert.equal(syncFailures, 6);
  Assert.ok(scheduler.idle);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(!scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.idleInterval);

  _("Test non-idle, numClients > 1, no incoming items => activeInterval.");
  // idle == false && numClients > 1 && hasIncomingItems == false
  scheduler.idle = false;
  await Service.sync();
  Assert.equal(syncFailures, 7);
  Assert.ok(!scheduler.idle);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(!scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);

  _("Test non-idle, numClients > 1, incoming items => immediateInterval.");
  // idle == false && numClients > 1 && hasIncomingItems == true
  scheduler.hasIncomingItems = true;
  await Service.sync();
  Assert.equal(syncFailures, 8);
  Assert.ok(!scheduler.idle);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(!scheduler.hasIncomingItems); // gets reset to false
  Assert.equal(scheduler.syncInterval, scheduler.immediateInterval);

  await Service.startOver();
  Svc.Obs.remove("weave:service:sync:error", onSyncError);
  await promiseStopServer(server);
});

add_task(async function test_back_triggers_sync() {
  enableValidationPrefs();

  let server = await sync_httpd_setup();
  await setUp(server);

  // Single device: no sync triggered.
  scheduler.idle = true;
  scheduler.observe(
    null,
    "active",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  Assert.ok(!scheduler.idle);

  // Multiple devices: sync is triggered.
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 2);
  scheduler.updateClientMode();

  let promiseDone = promiseOneObserver("weave:service:sync:finish");

  scheduler.idle = true;
  scheduler.observe(
    null,
    "active",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  Assert.ok(!scheduler.idle);
  await promiseDone;

  Service.recordManager.clearCache();
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  scheduler.setDefaults();
  await clientsEngine.resetClient();

  await Service.startOver();
  await promiseStopServer(server);
});

add_task(async function test_adjust_interval_on_sync_error() {
  enableValidationPrefs();

  let server = await sync_httpd_setup();
  await setUp(server);

  let syncFailures = 0;
  function onSyncError() {
    _("Sync error.");
    syncFailures++;
  }
  Svc.Obs.add("weave:service:sync:error", onSyncError);

  _("Test unsuccessful sync updates client mode & sync intervals");
  // Force a sync fail.
  Svc.PrefBranch.setStringPref("firstSync", "notReady");

  Assert.equal(syncFailures, 0);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  Svc.PrefBranch.setIntPref("clients.devices.mobile", 2);
  await Service.sync();

  Assert.equal(syncFailures, 1);
  Assert.greater(scheduler.numClients, 1);
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);

  Svc.Obs.remove("weave:service:sync:error", onSyncError);
  await Service.startOver();
  await promiseStopServer(server);
});

add_task(async function test_bug671378_scenario() {
  enableValidationPrefs();

  // Test scenario similar to bug 671378. This bug appeared when a score
  // update occurred that wasn't large enough to trigger a sync so
  // scheduleNextSync() was called without a time interval parameter,
  // setting nextSync to a non-zero value and preventing the timer from
  // being adjusted in the next call to scheduleNextSync().
  let server = await sync_httpd_setup();
  await setUp(server);

  let syncSuccesses = 0;
  function onSyncFinish() {
    _("Sync success.");
    syncSuccesses++;
  }
  Svc.Obs.add("weave:service:sync:finish", onSyncFinish);

  // After first sync call, syncInterval & syncTimer are singleDeviceInterval.
  await Service.sync();
  Assert.equal(syncSuccesses, 1);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
  Assert.equal(scheduler.syncTimer.delay, scheduler.singleDeviceInterval);

  let promiseDone = new Promise(resolve => {
    // Wrap scheduleNextSync so we are notified when it is finished.
    scheduler._scheduleNextSync = scheduler.scheduleNextSync;
    scheduler.scheduleNextSync = function () {
      scheduler._scheduleNextSync();

      // Check on sync:finish scheduleNextSync sets the appropriate
      // syncInterval and syncTimer values.
      if (syncSuccesses == 2) {
        Assert.notEqual(scheduler.nextSync, 0);
        Assert.equal(scheduler.syncInterval, scheduler.activeInterval);
        Assert.lessOrEqual(scheduler.syncTimer.delay, scheduler.activeInterval);

        scheduler.scheduleNextSync = scheduler._scheduleNextSync;
        Svc.Obs.remove("weave:service:sync:finish", onSyncFinish);
        Service.startOver().then(() => {
          server.stop(resolve);
        });
      }
    };
  });

  // Set nextSync != 0
  // syncInterval still hasn't been set by call to updateClientMode.
  // Explicitly trying to invoke scheduleNextSync during a sync
  // (to immitate a score update that isn't big enough to trigger a sync).
  Svc.Obs.add("weave:service:sync:start", function onSyncStart() {
    // Wait for other sync:start observers to be called so that
    // nextSync is set to 0.
    CommonUtils.nextTick(function () {
      Svc.Obs.remove("weave:service:sync:start", onSyncStart);

      scheduler.scheduleNextSync();
      Assert.notEqual(scheduler.nextSync, 0);
      Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
      Assert.equal(scheduler.syncTimer.delay, scheduler.singleDeviceInterval);
    });
  });

  await Service.clientsEngine._store.create({
    id: "foo",
    cleartext: { name: "bar", type: "mobile" },
  });
  await Service.sync();
  await promiseDone;
});

add_task(async function test_adjust_timer_larger_syncInterval() {
  _(
    "Test syncInterval > current timout period && nextSync != 0, syncInterval is NOT used."
  );
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 2);
  scheduler.updateClientMode();
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);

  scheduler.scheduleNextSync();

  // Ensure we have a small interval.
  Assert.notEqual(scheduler.nextSync, 0);
  Assert.equal(scheduler.syncTimer.delay, scheduler.activeInterval);

  // Make interval large again
  await clientsEngine._wipeClient();
  Svc.PrefBranch.clearUserPref("clients.devices.mobile");
  scheduler.updateClientMode();
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  scheduler.scheduleNextSync();

  // Ensure timer delay remains as the small interval.
  Assert.notEqual(scheduler.nextSync, 0);
  Assert.lessOrEqual(scheduler.syncTimer.delay, scheduler.activeInterval);

  // SyncSchedule.
  await Service.startOver();
});

add_task(async function test_adjust_timer_smaller_syncInterval() {
  _(
    "Test current timout > syncInterval period && nextSync != 0, syncInterval is used."
  );
  scheduler.scheduleNextSync();

  // Ensure we have a large interval.
  Assert.notEqual(scheduler.nextSync, 0);
  Assert.equal(scheduler.syncTimer.delay, scheduler.singleDeviceInterval);

  // Make interval smaller
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 2);
  scheduler.updateClientMode();
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);

  scheduler.scheduleNextSync();

  // Ensure smaller timer delay is used.
  Assert.notEqual(scheduler.nextSync, 0);
  Assert.lessOrEqual(scheduler.syncTimer.delay, scheduler.activeInterval);

  // SyncSchedule.
  await Service.startOver();
});
