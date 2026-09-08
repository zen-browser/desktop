/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { FxAccounts } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccounts.sys.mjs"
);
const { SyncAuthManager } = ChromeUtils.importESModule(
  "resource://services-sync/sync_auth.sys.mjs"
);
const { SyncScheduler } = ChromeUtils.importESModule(
  "resource://services-sync/policies.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { Status } = ChromeUtils.importESModule(
  "resource://services-sync/status.sys.mjs"
);

function CatapultEngine() {
  SyncEngine.call(this, "Catapult", Service);
}
CatapultEngine.prototype = {
  exception: null, // tests fill this in
  async _sync() {
    throw this.exception;
  },
};
Object.setPrototypeOf(CatapultEngine.prototype, SyncEngine.prototype);

var scheduler = new SyncScheduler(Service);
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
    "/1.1/johndoe@mozilla.com/storage/meta/global": upd(
      "meta",
      global.handler()
    ),
    "/1.1/johndoe@mozilla.com/info/collections": collectionsHelper.handler,
    "/1.1/johndoe@mozilla.com/storage/crypto/keys": upd(
      "crypto",
      new ServerWBO("keys").handler()
    ),
    "/1.1/johndoe@mozilla.com/storage/clients": upd(
      "clients",
      clientsColl.handler()
    ),
  });
}

async function setUp(server) {
  await configureIdentity({ username: "johndoe@mozilla.com" }, server);

  await generateNewKeys(Service.collectionKeys);
  let serverKeys = Service.collectionKeys.asWBO("crypto", "keys");
  await serverKeys.encrypt(Service.identity.syncKeyBundle);
  let result = (
    await serverKeys.upload(Service.resource(Service.cryptoKeysURL))
  ).success;
  return result;
}

async function cleanUpAndGo(server) {
  await Async.promiseYield();
  await clientsEngine._store.wipe();
  await Service.startOver();
  // Re-enable logging, which we just disabled.
  syncTestLogging();
  if (server) {
    await promiseStopServer(server);
  }
}

add_task(async function setup() {
  await Service.promiseInitialized;
  clientsEngine = Service.clientsEngine;
  // Don't remove stale clients when syncing. This is a test-only workaround
  // that lets us add clients directly to the store, without losing them on
  // the next sync.
  clientsEngine._removeRemoteClient = async () => {};
  await Service.engineManager.clear();

  validate_all_future_pings();

  scheduler.setDefaults();

  await Service.engineManager.register(CatapultEngine);
});

add_test(function test_prefAttributes() {
  _("Test various attributes corresponding to preferences.");

  const INTERVAL = 42 * 60 * 1000; // 42 minutes
  const THRESHOLD = 3142;
  const SCORE = 2718;
  const TIMESTAMP1 = 1275493471649;

  _(
    "The 'nextSync' attribute stores a millisecond timestamp rounded down to the nearest second."
  );
  Assert.equal(scheduler.nextSync, 0);
  scheduler.nextSync = TIMESTAMP1;
  Assert.equal(scheduler.nextSync, Math.floor(TIMESTAMP1 / 1000) * 1000);

  _("'syncInterval' defaults to singleDeviceInterval.");
  Assert.equal(
    Svc.PrefBranch.getPrefType("syncInterval"),
    Ci.nsIPrefBranch.PREF_INVALID
  );
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  _("'syncInterval' corresponds to a preference setting.");
  scheduler.syncInterval = INTERVAL;
  Assert.equal(scheduler.syncInterval, INTERVAL);
  Assert.equal(Svc.PrefBranch.getIntPref("syncInterval"), INTERVAL);

  _(
    "'syncThreshold' corresponds to preference, defaults to SINGLE_USER_THRESHOLD"
  );
  Assert.equal(
    Svc.PrefBranch.getPrefType("syncThreshold"),
    Ci.nsIPrefBranch.PREF_INVALID
  );
  Assert.equal(scheduler.syncThreshold, SINGLE_USER_THRESHOLD);
  scheduler.syncThreshold = THRESHOLD;
  Assert.equal(scheduler.syncThreshold, THRESHOLD);

  _("'globalScore' corresponds to preference, defaults to zero.");
  Assert.equal(Svc.PrefBranch.getIntPref("globalScore"), 0);
  Assert.equal(scheduler.globalScore, 0);
  scheduler.globalScore = SCORE;
  Assert.equal(scheduler.globalScore, SCORE);
  Assert.equal(Svc.PrefBranch.getIntPref("globalScore"), SCORE);

  _("Intervals correspond to default preferences.");
  Assert.equal(
    scheduler.singleDeviceInterval,
    Svc.PrefBranch.getIntPref("scheduler.fxa.singleDeviceInterval") * 1000
  );
  Assert.equal(
    scheduler.idleInterval,
    Svc.PrefBranch.getIntPref("scheduler.idleInterval") * 1000
  );
  Assert.equal(
    scheduler.activeInterval,
    Svc.PrefBranch.getIntPref("scheduler.activeInterval") * 1000
  );
  Assert.equal(
    scheduler.immediateInterval,
    Svc.PrefBranch.getIntPref("scheduler.immediateInterval") * 1000
  );

  _("Custom values for prefs will take effect after a restart.");
  Svc.PrefBranch.setIntPref("scheduler.fxa.singleDeviceInterval", 420);
  Svc.PrefBranch.setIntPref("scheduler.idleInterval", 230);
  Svc.PrefBranch.setIntPref("scheduler.activeInterval", 180);
  Svc.PrefBranch.setIntPref("scheduler.immediateInterval", 31415);
  scheduler.setDefaults();
  Assert.equal(scheduler.idleInterval, 230000);
  Assert.equal(scheduler.singleDeviceInterval, 420000);
  Assert.equal(scheduler.activeInterval, 180000);
  Assert.equal(scheduler.immediateInterval, 31415000);

  _("Custom values for interval prefs can't be less than 60 seconds.");
  Svc.PrefBranch.setIntPref("scheduler.fxa.singleDeviceInterval", 42);
  Svc.PrefBranch.setIntPref("scheduler.idleInterval", 50);
  Svc.PrefBranch.setIntPref("scheduler.activeInterval", 50);
  Svc.PrefBranch.setIntPref("scheduler.immediateInterval", 10);
  scheduler.setDefaults();
  Assert.equal(scheduler.idleInterval, 60000);
  Assert.equal(scheduler.singleDeviceInterval, 60000);
  Assert.equal(scheduler.activeInterval, 60000);
  Assert.equal(scheduler.immediateInterval, 60000);

  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  scheduler.setDefaults();
  run_next_test();
});

add_task(async function test_sync_skipped_low_score_no_resync() {
  enableValidationPrefs();
  let server = await sync_httpd_setup();

  function SkipEngine() {
    SyncEngine.call(this, "Skip", Service);
    this.syncs = 0;
  }

  SkipEngine.prototype = {
    _sync() {
      do_throw("Should have been skipped");
    },
    shouldSkipSync() {
      return true;
    },
  };
  Object.setPrototypeOf(SkipEngine.prototype, SyncEngine.prototype);
  await Service.engineManager.register(SkipEngine);

  let engine = Service.engineManager.get("skip");
  engine.enabled = true;
  engine._tracker._score = 30;

  Assert.equal(Status.sync, SYNC_SUCCEEDED);

  Assert.ok(await setUp(server));

  let resyncDoneObserver = promiseOneObserver("weave:service:resyncs-finished");

  let synced = false;
  function onSyncStarted() {
    Assert.ok(!synced, "Only should sync once");
    synced = true;
  }

  await Service.sync();

  Assert.equal(Status.sync, SYNC_SUCCEEDED);

  Svc.Obs.add("weave:service:sync:start", onSyncStarted);
  await resyncDoneObserver;

  Svc.Obs.remove("weave:service:sync:start", onSyncStarted);
  engine._tracker._store = 0;
  await cleanUpAndGo(server);
});

add_task(async function test_updateClientMode() {
  _(
    "Test updateClientMode adjusts scheduling attributes based on # of clients appropriately"
  );
  Assert.equal(scheduler.syncThreshold, SINGLE_USER_THRESHOLD);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(!scheduler.idle);

  // Trigger a change in interval & threshold by noting there are multiple clients.
  Svc.PrefBranch.setIntPref("clients.devices.desktop", 1);
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 1);
  scheduler.updateClientMode();

  Assert.equal(scheduler.syncThreshold, MULTI_DEVICE_THRESHOLD);
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(!scheduler.idle);

  // Resets the number of clients to 0.
  await clientsEngine.resetClient();
  Svc.PrefBranch.clearUserPref("clients.devices.mobile");
  scheduler.updateClientMode();

  // Goes back to single user if # clients is 1.
  Assert.equal(scheduler.numClients, 1);
  Assert.equal(scheduler.syncThreshold, SINGLE_USER_THRESHOLD);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(!scheduler.idle);

  await cleanUpAndGo();
});

add_task(async function test_masterpassword_locked_retry_interval() {
  enableValidationPrefs();

  _(
    "Test Status.login = MASTER_PASSWORD_LOCKED results in reschedule at MASTER_PASSWORD interval"
  );
  let loginFailed = false;
  Svc.Obs.add("weave:service:login:error", function onLoginError() {
    Svc.Obs.remove("weave:service:login:error", onLoginError);
    loginFailed = true;
  });

  let rescheduleInterval = false;

  let oldScheduleAtInterval = SyncScheduler.prototype.scheduleAtInterval;
  SyncScheduler.prototype.scheduleAtInterval = function (interval) {
    rescheduleInterval = true;
    Assert.equal(interval, MASTER_PASSWORD_LOCKED_RETRY_INTERVAL);
  };

  let oldVerifyLogin = Service.verifyLogin;
  Service.verifyLogin = async function () {
    Status.login = MASTER_PASSWORD_LOCKED;
    return false;
  };

  let server = await sync_httpd_setup();
  await setUp(server);

  await Service.sync();

  Assert.ok(loginFailed);
  Assert.equal(Status.login, MASTER_PASSWORD_LOCKED);
  Assert.ok(rescheduleInterval);

  Service.verifyLogin = oldVerifyLogin;
  SyncScheduler.prototype.scheduleAtInterval = oldScheduleAtInterval;

  await cleanUpAndGo(server);
});

add_task(async function test_calculateBackoff() {
  Assert.equal(Status.backoffInterval, 0);

  // Test no interval larger than the maximum backoff is used if
  // Status.backoffInterval is smaller.
  Status.backoffInterval = 5;
  let backoffInterval = Utils.calculateBackoff(
    50,
    MAXIMUM_BACKOFF_INTERVAL,
    Status.backoffInterval
  );

  Assert.equal(backoffInterval, MAXIMUM_BACKOFF_INTERVAL);

  // Test Status.backoffInterval is used if it is
  // larger than MAXIMUM_BACKOFF_INTERVAL.
  Status.backoffInterval = MAXIMUM_BACKOFF_INTERVAL + 10;
  backoffInterval = Utils.calculateBackoff(
    50,
    MAXIMUM_BACKOFF_INTERVAL,
    Status.backoffInterval
  );

  Assert.equal(backoffInterval, MAXIMUM_BACKOFF_INTERVAL + 10);

  await cleanUpAndGo();
});

add_task(async function test_scheduleNextSync_nowOrPast() {
  enableValidationPrefs();

  let promiseObserved = promiseOneObserver("weave:service:sync:finish");

  let server = await sync_httpd_setup();
  await setUp(server);

  // We're late for a sync...
  scheduler.scheduleNextSync(-1);
  await promiseObserved;
  await cleanUpAndGo(server);
});

add_task(async function test_scheduleNextSync_future_noBackoff() {
  enableValidationPrefs();

  _(
    "scheduleNextSync() uses the current syncInterval if no interval is provided."
  );
  // Test backoffInterval is 0 as expected.
  Assert.equal(Status.backoffInterval, 0);

  _("Test setting sync interval when nextSync == 0");
  scheduler.nextSync = 0;
  scheduler.scheduleNextSync();

  // nextSync - Date.now() might be smaller than expectedInterval
  // since some time has passed since we called scheduleNextSync().
  Assert.lessOrEqual(scheduler.nextSync - Date.now(), scheduler.syncInterval);
  Assert.equal(scheduler.syncTimer.delay, scheduler.syncInterval);

  _("Test setting sync interval when nextSync != 0");
  scheduler.nextSync = Date.now() + scheduler.singleDeviceInterval;
  scheduler.scheduleNextSync();

  // nextSync - Date.now() might be smaller than expectedInterval
  // since some time has passed since we called scheduleNextSync().
  Assert.lessOrEqual(scheduler.nextSync - Date.now(), scheduler.syncInterval);
  Assert.lessOrEqual(scheduler.syncTimer.delay, scheduler.syncInterval);

  _(
    "Scheduling requests for intervals larger than the current one will be ignored."
  );
  // Request a sync at a longer interval. The sync that's already scheduled
  // for sooner takes precedence.
  let nextSync = scheduler.nextSync;
  let timerDelay = scheduler.syncTimer.delay;
  let requestedInterval = scheduler.syncInterval * 10;
  scheduler.scheduleNextSync(requestedInterval);
  Assert.equal(scheduler.nextSync, nextSync);
  Assert.equal(scheduler.syncTimer.delay, timerDelay);

  // We can schedule anything we want if there isn't a sync scheduled.
  scheduler.nextSync = 0;
  scheduler.scheduleNextSync(requestedInterval);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + requestedInterval);
  Assert.equal(scheduler.syncTimer.delay, requestedInterval);

  // Request a sync at the smallest possible interval (0 triggers now).
  scheduler.scheduleNextSync(1);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + 1);
  Assert.equal(scheduler.syncTimer.delay, 1);

  await cleanUpAndGo();
});

add_task(async function test_scheduleNextSync_future_backoff() {
  enableValidationPrefs();

  _("scheduleNextSync() will honour backoff in all scheduling requests.");
  // Let's take a backoff interval that's bigger than the default sync interval.
  const BACKOFF = 7337;
  Status.backoffInterval = scheduler.syncInterval + BACKOFF;

  _("Test setting sync interval when nextSync == 0");
  scheduler.nextSync = 0;
  scheduler.scheduleNextSync();

  // nextSync - Date.now() might be smaller than expectedInterval
  // since some time has passed since we called scheduleNextSync().
  Assert.lessOrEqual(scheduler.nextSync - Date.now(), Status.backoffInterval);
  Assert.equal(scheduler.syncTimer.delay, Status.backoffInterval);

  _("Test setting sync interval when nextSync != 0");
  scheduler.nextSync = Date.now() + scheduler.singleDeviceInterval;
  scheduler.scheduleNextSync();

  // nextSync - Date.now() might be smaller than expectedInterval
  // since some time has passed since we called scheduleNextSync().
  Assert.lessOrEqual(scheduler.nextSync - Date.now(), Status.backoffInterval);
  Assert.lessOrEqual(scheduler.syncTimer.delay, Status.backoffInterval);

  // Request a sync at a longer interval. The sync that's already scheduled
  // for sooner takes precedence.
  let nextSync = scheduler.nextSync;
  let timerDelay = scheduler.syncTimer.delay;
  let requestedInterval = scheduler.syncInterval * 10;
  Assert.greater(requestedInterval, Status.backoffInterval);
  scheduler.scheduleNextSync(requestedInterval);
  Assert.equal(scheduler.nextSync, nextSync);
  Assert.equal(scheduler.syncTimer.delay, timerDelay);

  // We can schedule anything we want if there isn't a sync scheduled.
  scheduler.nextSync = 0;
  scheduler.scheduleNextSync(requestedInterval);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + requestedInterval);
  Assert.equal(scheduler.syncTimer.delay, requestedInterval);

  // Request a sync at the smallest possible interval (0 triggers now).
  scheduler.scheduleNextSync(1);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + Status.backoffInterval);
  Assert.equal(scheduler.syncTimer.delay, Status.backoffInterval);

  await cleanUpAndGo();
});

add_task(async function test_handleSyncError() {
  enableValidationPrefs();

  let server = await sync_httpd_setup();
  await setUp(server);

  // Force sync to fail.
  Svc.PrefBranch.setStringPref("firstSync", "notReady");

  _("Ensure expected initial environment.");
  Assert.equal(scheduler._syncErrors, 0);
  Assert.ok(!Status.enforceBackoff);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
  Assert.equal(Status.backoffInterval, 0);

  // Trigger sync with an error several times & observe
  // functionality of handleSyncError()
  _("Test first error calls scheduleNextSync on default interval");
  await Service.sync();
  Assert.lessOrEqual(
    scheduler.nextSync,
    Date.now() + scheduler.singleDeviceInterval
  );
  Assert.equal(scheduler.syncTimer.delay, scheduler.singleDeviceInterval);
  Assert.equal(scheduler._syncErrors, 1);
  Assert.ok(!Status.enforceBackoff);
  scheduler.syncTimer.clear();

  _("Test second error still calls scheduleNextSync on default interval");
  await Service.sync();
  Assert.lessOrEqual(
    scheduler.nextSync,
    Date.now() + scheduler.singleDeviceInterval
  );
  Assert.equal(scheduler.syncTimer.delay, scheduler.singleDeviceInterval);
  Assert.equal(scheduler._syncErrors, 2);
  Assert.ok(!Status.enforceBackoff);
  scheduler.syncTimer.clear();

  _("Test third error sets Status.enforceBackoff and calls scheduleAtInterval");
  await Service.sync();
  let maxInterval = scheduler._syncErrors * (2 * MINIMUM_BACKOFF_INTERVAL);
  Assert.equal(Status.backoffInterval, 0);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + maxInterval);
  Assert.lessOrEqual(scheduler.syncTimer.delay, maxInterval);
  Assert.equal(scheduler._syncErrors, 3);
  Assert.ok(Status.enforceBackoff);

  // Status.enforceBackoff is false but there are still errors.
  Status.resetBackoff();
  Assert.ok(!Status.enforceBackoff);
  Assert.equal(scheduler._syncErrors, 3);
  scheduler.syncTimer.clear();

  _(
    "Test fourth error still calls scheduleAtInterval even if enforceBackoff was reset"
  );
  await Service.sync();
  maxInterval = scheduler._syncErrors * (2 * MINIMUM_BACKOFF_INTERVAL);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + maxInterval);
  Assert.lessOrEqual(scheduler.syncTimer.delay, maxInterval);
  Assert.equal(scheduler._syncErrors, 4);
  Assert.ok(Status.enforceBackoff);
  scheduler.syncTimer.clear();

  _("Arrange for a successful sync to reset the scheduler error count");
  let promiseObserved = promiseOneObserver("weave:service:sync:finish");
  Svc.PrefBranch.setStringPref("firstSync", "wipeRemote");
  scheduler.scheduleNextSync(-1);
  await promiseObserved;
  await cleanUpAndGo(server);
});

add_task(async function test_client_sync_finish_updateClientMode() {
  enableValidationPrefs();

  let server = await sync_httpd_setup();
  await setUp(server);

  // Confirm defaults.
  Assert.equal(scheduler.syncThreshold, SINGLE_USER_THRESHOLD);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
  Assert.ok(!scheduler.idle);

  // Trigger a change in interval & threshold by adding a client.
  await clientsEngine._store.create({
    id: "foo",
    cleartext: { os: "mobile", version: "0.01", type: "desktop" },
  });
  Assert.equal(false, scheduler.numClients > 1);
  scheduler.updateClientMode();
  await Service.sync();

  Assert.equal(scheduler.syncThreshold, MULTI_DEVICE_THRESHOLD);
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);
  Assert.greater(scheduler.numClients, 1);
  Assert.ok(!scheduler.idle);

  // Resets the number of clients to 0.
  await clientsEngine.resetClient();
  // Also re-init the server, or we suck our "foo" client back down.
  await setUp(server);

  await Service.sync();

  // Goes back to single user if # clients is 1.
  Assert.equal(scheduler.numClients, 1);
  Assert.equal(scheduler.syncThreshold, SINGLE_USER_THRESHOLD);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
  Assert.equal(false, scheduler.numClients > 1);
  Assert.ok(!scheduler.idle);

  await cleanUpAndGo(server);
});

add_task(async function test_autoconnect_nextSync_past() {
  enableValidationPrefs();

  let promiseObserved = promiseOneObserver("weave:service:sync:finish");
  // nextSync will be 0 by default, so it's way in the past.

  let server = await sync_httpd_setup();
  await setUp(server);

  scheduler.autoConnect();
  await promiseObserved;
  await cleanUpAndGo(server);
});

add_task(async function test_autoconnect_nextSync_future() {
  enableValidationPrefs();

  let previousSync = Date.now() + scheduler.syncInterval / 2;
  scheduler.nextSync = previousSync;
  // nextSync rounds to the nearest second.
  let expectedSync = scheduler.nextSync;
  let expectedInterval = expectedSync - Date.now() - 1000;

  // Ensure we don't actually try to sync (or log in for that matter).
  function onLoginStart() {
    do_throw("Should not get here!");
  }
  Svc.Obs.add("weave:service:login:start", onLoginStart);

  await configureIdentity({ username: "johndoe@mozilla.com" });
  scheduler.autoConnect();
  await promiseZeroTimer();

  Assert.equal(scheduler.nextSync, expectedSync);
  Assert.greaterOrEqual(scheduler.syncTimer.delay, expectedInterval);

  Svc.Obs.remove("weave:service:login:start", onLoginStart);
  await cleanUpAndGo();
});

add_task(async function test_autoconnect_mp_locked() {
  let server = await sync_httpd_setup();
  await setUp(server);

  // Pretend user did not unlock master password.
  let origLocked = Utils.mpLocked;
  Utils.mpLocked = () => true;

  let origEnsureMPUnlocked = Utils.ensureMPUnlocked;
  Utils.ensureMPUnlocked = () => {
    _("Faking Master Password entry cancelation.");
    return false;
  };
  let origFxA = Service.identity._fxaService;
  Service.identity._fxaService = new FxAccounts({
    currentAccountState: {
      getUserAccountData(...args) {
        return origFxA._internal.currentAccountState.getUserAccountData(
          ...args
        );
      },
    },
    keys: {
      canGetKeyForScope() {
        return false;
      },
    },
  });
  // A locked master password will still trigger a sync, but then we'll hit
  // MASTER_PASSWORD_LOCKED and hence MASTER_PASSWORD_LOCKED_RETRY_INTERVAL.
  let promiseObserved = promiseOneObserver("weave:service:login:error");

  scheduler.autoConnect();
  await promiseObserved;

  await Async.promiseYield();

  Assert.equal(Status.login, MASTER_PASSWORD_LOCKED);

  Utils.mpLocked = origLocked;
  Utils.ensureMPUnlocked = origEnsureMPUnlocked;
  Service.identity._fxaService = origFxA;

  await cleanUpAndGo(server);
});

add_task(async function test_no_autoconnect_during_wizard() {
  let server = await sync_httpd_setup();
  await setUp(server);

  // Simulate the Sync setup wizard.
  Svc.PrefBranch.setStringPref("firstSync", "notReady");

  // Ensure we don't actually try to sync (or log in for that matter).
  function onLoginStart() {
    do_throw("Should not get here!");
  }
  Svc.Obs.add("weave:service:login:start", onLoginStart);

  scheduler.autoConnect(0);
  await promiseZeroTimer();
  Svc.Obs.remove("weave:service:login:start", onLoginStart);
  await cleanUpAndGo(server);
});

add_task(async function test_no_autoconnect_status_not_ok() {
  let server = await sync_httpd_setup();
  Status.__authManager = Service.identity = new SyncAuthManager();

  // Ensure we don't actually try to sync (or log in for that matter).
  function onLoginStart() {
    do_throw("Should not get here!");
  }
  Svc.Obs.add("weave:service:login:start", onLoginStart);

  scheduler.autoConnect();
  await promiseZeroTimer();
  Svc.Obs.remove("weave:service:login:start", onLoginStart);

  Assert.equal(Status.service, CLIENT_NOT_CONFIGURED);
  Assert.equal(Status.login, LOGIN_FAILED_NO_USERNAME);

  await cleanUpAndGo(server);
});

add_task(async function test_idle_adjustSyncInterval() {
  // Confirm defaults.
  Assert.equal(scheduler.idle, false);

  // Single device: nothing changes.
  scheduler.observe(
    null,
    "idle",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  Assert.equal(scheduler.idle, true);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);

  // Multiple devices: switch to idle interval.
  scheduler.idle = false;
  Svc.PrefBranch.setIntPref("clients.devices.desktop", 1);
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 1);
  scheduler.updateClientMode();
  scheduler.observe(
    null,
    "idle",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  Assert.equal(scheduler.idle, true);
  Assert.equal(scheduler.syncInterval, scheduler.idleInterval);

  await cleanUpAndGo();
});

add_task(async function test_back_triggersSync() {
  // Confirm defaults.
  Assert.ok(!scheduler.idle);
  Assert.equal(Status.backoffInterval, 0);

  // Set up: Define 2 clients and put the system in idle.
  Svc.PrefBranch.setIntPref("clients.devices.desktop", 1);
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 1);
  scheduler.observe(
    null,
    "idle",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  Assert.ok(scheduler.idle);

  // We don't actually expect the sync (or the login, for that matter) to
  // succeed. We just want to ensure that it was attempted.
  let promiseObserved = promiseOneObserver("weave:service:login:error");

  // Send an 'active' event to trigger sync soonish.
  scheduler.observe(
    null,
    "active",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  await promiseObserved;
  await cleanUpAndGo();
});

add_task(async function test_active_triggersSync_observesBackoff() {
  // Confirm defaults.
  Assert.ok(!scheduler.idle);

  // Set up: Set backoff, define 2 clients and put the system in idle.
  const BACKOFF = 7337;
  Status.backoffInterval = scheduler.idleInterval + BACKOFF;
  Svc.PrefBranch.setIntPref("clients.devices.desktop", 1);
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 1);
  scheduler.observe(
    null,
    "idle",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  Assert.equal(scheduler.idle, true);

  function onLoginStart() {
    do_throw("Shouldn't have kicked off a sync!");
  }
  Svc.Obs.add("weave:service:login:start", onLoginStart);

  let promiseTimer = promiseNamedTimer(
    IDLE_OBSERVER_BACK_DELAY * 1.5,
    {},
    "timer"
  );

  // Send an 'active' event to try to trigger sync soonish.
  scheduler.observe(
    null,
    "active",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  await promiseTimer;
  Svc.Obs.remove("weave:service:login:start", onLoginStart);

  Assert.lessOrEqual(scheduler.nextSync, Date.now() + Status.backoffInterval);
  Assert.equal(scheduler.syncTimer.delay, Status.backoffInterval);

  await cleanUpAndGo();
});

add_task(async function test_back_debouncing() {
  _(
    "Ensure spurious back-then-idle events, as observed on OS X, don't trigger a sync."
  );

  // Confirm defaults.
  Assert.equal(scheduler.idle, false);

  // Set up: Define 2 clients and put the system in idle.
  Svc.PrefBranch.setIntPref("clients.devices.desktop", 1);
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 1);
  scheduler.observe(
    null,
    "idle",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  Assert.equal(scheduler.idle, true);

  function onLoginStart() {
    do_throw("Shouldn't have kicked off a sync!");
  }
  Svc.Obs.add("weave:service:login:start", onLoginStart);

  // Create spurious back-then-idle events as observed on OS X:
  scheduler.observe(
    null,
    "active",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );
  scheduler.observe(
    null,
    "idle",
    Svc.PrefBranch.getIntPref("scheduler.idleTime")
  );

  await promiseNamedTimer(IDLE_OBSERVER_BACK_DELAY * 1.5, {}, "timer");
  Svc.Obs.remove("weave:service:login:start", onLoginStart);
  await cleanUpAndGo();
});

add_task(async function test_no_sync_node() {
  enableValidationPrefs();

  // Test when Status.sync == NO_SYNC_NODE_FOUND
  // it is not overwritten on sync:finish
  let server = await sync_httpd_setup();
  await setUp(server);

  let oldfc = Service.identity._findCluster;
  Service.identity._findCluster = () => null;
  Service.clusterURL = "";
  try {
    await Service.sync();
    Assert.equal(Status.sync, NO_SYNC_NODE_FOUND);
    Assert.equal(scheduler.syncTimer.delay, NO_SYNC_NODE_INTERVAL);

    await cleanUpAndGo(server);
  } finally {
    Service.identity._findCluster = oldfc;
  }
});

add_task(async function test_sync_failed_partial_500s() {
  enableValidationPrefs();

  _("Test a 5xx status calls handleSyncError.");
  scheduler._syncErrors = MAX_ERROR_COUNT_BEFORE_BACKOFF;
  let server = await sync_httpd_setup();

  let engine = Service.engineManager.get("catapult");
  engine.enabled = true;
  engine.exception = { status: 500 };

  Assert.equal(Status.sync, SYNC_SUCCEEDED);

  Assert.ok(await setUp(server));

  await Service.sync();

  Assert.equal(Status.service, SYNC_FAILED_PARTIAL);

  let maxInterval = scheduler._syncErrors * (2 * MINIMUM_BACKOFF_INTERVAL);
  Assert.equal(Status.backoffInterval, 0);
  Assert.ok(Status.enforceBackoff);
  Assert.equal(scheduler._syncErrors, 4);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + maxInterval);
  Assert.lessOrEqual(scheduler.syncTimer.delay, maxInterval);

  await cleanUpAndGo(server);
});

add_task(async function test_sync_failed_partial_noresync() {
  enableValidationPrefs();
  let server = await sync_httpd_setup();

  let engine = Service.engineManager.get("catapult");
  engine.enabled = true;
  engine.exception = "Bad news";
  engine._tracker._score = MULTI_DEVICE_THRESHOLD + 1;

  Assert.equal(Status.sync, SYNC_SUCCEEDED);

  Assert.ok(await setUp(server));

  let resyncDoneObserver = promiseOneObserver("weave:service:resyncs-finished");

  await Service.sync();

  Assert.equal(Status.service, SYNC_FAILED_PARTIAL);

  function onSyncStarted() {
    do_throw("Should not start resync when previous sync failed");
  }

  Svc.Obs.add("weave:service:sync:start", onSyncStarted);
  await resyncDoneObserver;

  Svc.Obs.remove("weave:service:sync:start", onSyncStarted);
  engine._tracker._store = 0;
  await cleanUpAndGo(server);
});

add_task(async function test_sync_failed_partial_400s() {
  enableValidationPrefs();

  _("Test a non-5xx status doesn't call handleSyncError.");
  scheduler._syncErrors = MAX_ERROR_COUNT_BEFORE_BACKOFF;
  let server = await sync_httpd_setup();

  let engine = Service.engineManager.get("catapult");
  engine.enabled = true;
  engine.exception = { status: 400 };

  // Have multiple devices for an active interval.
  await clientsEngine._store.create({
    id: "foo",
    cleartext: { os: "mobile", version: "0.01", type: "desktop" },
  });

  Assert.equal(Status.sync, SYNC_SUCCEEDED);

  Assert.ok(await setUp(server));

  await Service.sync();

  Assert.equal(Status.service, SYNC_FAILED_PARTIAL);
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);

  Assert.equal(Status.backoffInterval, 0);
  Assert.ok(!Status.enforceBackoff);
  Assert.equal(scheduler._syncErrors, 0);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + scheduler.activeInterval);
  Assert.lessOrEqual(scheduler.syncTimer.delay, scheduler.activeInterval);

  await cleanUpAndGo(server);
});

add_task(async function test_sync_X_Weave_Backoff() {
  enableValidationPrefs();

  let server = await sync_httpd_setup();
  await setUp(server);

  // Use an odd value on purpose so that it doesn't happen to coincide with one
  // of the sync intervals.
  const BACKOFF = 7337;

  // Extend info/collections so that we can put it into server maintenance mode.
  const INFO_COLLECTIONS = "/1.1/johndoe@mozilla.com/info/collections";
  let infoColl = server._handler._overridePaths[INFO_COLLECTIONS];
  let serverBackoff = false;
  function infoCollWithBackoff(request, response) {
    if (serverBackoff) {
      response.setHeader("X-Weave-Backoff", "" + BACKOFF);
    }
    infoColl(request, response);
  }
  server.registerPathHandler(INFO_COLLECTIONS, infoCollWithBackoff);

  // Pretend we have two clients so that the regular sync interval is
  // sufficiently low.
  await clientsEngine._store.create({
    id: "foo",
    cleartext: { os: "mobile", version: "0.01", type: "desktop" },
  });
  let rec = await clientsEngine._store.createRecord("foo", "clients");
  await rec.encrypt(Service.collectionKeys.keyForCollection("clients"));
  await rec.upload(Service.resource(clientsEngine.engineURL + rec.id));

  // Sync once to log in and get everything set up. Let's verify our initial
  // values.
  await Service.sync();
  Assert.equal(Status.backoffInterval, 0);
  Assert.equal(Status.minimumNextSync, 0);
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + scheduler.syncInterval);
  // Sanity check that we picked the right value for BACKOFF:
  Assert.less(scheduler.syncInterval, BACKOFF * 1000);

  // Turn on server maintenance and sync again.
  serverBackoff = true;
  await Service.sync();

  Assert.greaterOrEqual(Status.backoffInterval, BACKOFF * 1000);
  // Allowing 20 seconds worth of of leeway between when Status.minimumNextSync
  // was set and when this line gets executed.
  let minimumExpectedDelay = (BACKOFF - 20) * 1000;
  Assert.greaterOrEqual(
    Status.minimumNextSync,
    Date.now() + minimumExpectedDelay
  );

  // Verify that the next sync is actually going to wait that long.
  Assert.greaterOrEqual(scheduler.nextSync, Date.now() + minimumExpectedDelay);
  Assert.greaterOrEqual(scheduler.syncTimer.delay, minimumExpectedDelay);

  await cleanUpAndGo(server);
});

add_task(async function test_sync_503_Retry_After() {
  enableValidationPrefs();

  let server = await sync_httpd_setup();
  await setUp(server);

  // Use an odd value on purpose so that it doesn't happen to coincide with one
  // of the sync intervals.
  const BACKOFF = 7337;

  // Extend info/collections so that we can put it into server maintenance mode.
  const INFO_COLLECTIONS = "/1.1/johndoe@mozilla.com/info/collections";
  let infoColl = server._handler._overridePaths[INFO_COLLECTIONS];
  let serverMaintenance = false;
  function infoCollWithMaintenance(request, response) {
    if (!serverMaintenance) {
      infoColl(request, response);
      return;
    }
    response.setHeader("Retry-After", "" + BACKOFF);
    response.setStatusLine(request.httpVersion, 503, "Service Unavailable");
  }
  server.registerPathHandler(INFO_COLLECTIONS, infoCollWithMaintenance);

  // Pretend we have two clients so that the regular sync interval is
  // sufficiently low.
  await clientsEngine._store.create({
    id: "foo",
    cleartext: { os: "mobile", version: "0.01", type: "desktop" },
  });
  let rec = await clientsEngine._store.createRecord("foo", "clients");
  await rec.encrypt(Service.collectionKeys.keyForCollection("clients"));
  await rec.upload(Service.resource(clientsEngine.engineURL + rec.id));

  // Sync once to log in and get everything set up. Let's verify our initial
  // values.
  await Service.sync();
  Assert.ok(!Status.enforceBackoff);
  Assert.equal(Status.backoffInterval, 0);
  Assert.equal(Status.minimumNextSync, 0);
  Assert.equal(scheduler.syncInterval, scheduler.activeInterval);
  Assert.lessOrEqual(scheduler.nextSync, Date.now() + scheduler.syncInterval);
  // Sanity check that we picked the right value for BACKOFF:
  Assert.less(scheduler.syncInterval, BACKOFF * 1000);

  // Turn on server maintenance and sync again.
  serverMaintenance = true;
  await Service.sync();

  Assert.ok(Status.enforceBackoff);
  Assert.greaterOrEqual(Status.backoffInterval, BACKOFF * 1000);
  // Allowing 3 seconds worth of of leeway between when Status.minimumNextSync
  // was set and when this line gets executed.
  let minimumExpectedDelay = (BACKOFF - 3) * 1000;
  Assert.greaterOrEqual(
    Status.minimumNextSync,
    Date.now() + minimumExpectedDelay
  );

  // Verify that the next sync is actually going to wait that long.
  Assert.greaterOrEqual(scheduler.nextSync, Date.now() + minimumExpectedDelay);
  Assert.greaterOrEqual(scheduler.syncTimer.delay, minimumExpectedDelay);

  await cleanUpAndGo(server);
});

add_task(async function test_loginError_recoverable_reschedules() {
  _("Verify that a recoverable login error schedules a new sync.");
  await configureIdentity({ username: "johndoe@mozilla.com" });
  Service.clusterURL = "http://localhost:1234/";
  Status.resetSync(); // reset Status.login

  let promiseObserved = promiseOneObserver("weave:service:login:error");

  // Let's set it up so that a sync is overdue, both in terms of previously
  // scheduled syncs and the global score. We still do not expect an immediate
  // sync because we just tried (duh).
  scheduler.nextSync = Date.now() - 100000;
  scheduler.globalScore = SINGLE_USER_THRESHOLD + 1;
  function onSyncStart() {
    do_throw("Shouldn't have started a sync!");
  }
  Svc.Obs.add("weave:service:sync:start", onSyncStart);

  // Sanity check.
  Assert.equal(scheduler.syncTimer, null);
  Assert.equal(Status.checkSetup(), STATUS_OK);
  Assert.equal(Status.login, LOGIN_SUCCEEDED);

  scheduler.scheduleNextSync(0);
  await promiseObserved;
  await Async.promiseYield();

  Assert.equal(Status.login, LOGIN_FAILED_NETWORK_ERROR);

  let expectedNextSync = Date.now() + scheduler.syncInterval;
  Assert.greater(scheduler.nextSync, Date.now());
  Assert.lessOrEqual(scheduler.nextSync, expectedNextSync);
  Assert.greater(scheduler.syncTimer.delay, 0);
  Assert.lessOrEqual(scheduler.syncTimer.delay, scheduler.syncInterval);

  Svc.Obs.remove("weave:service:sync:start", onSyncStart);
  await cleanUpAndGo();
});

add_task(async function test_loginError_fatal_clearsTriggers() {
  _("Verify that a fatal login error clears sync triggers.");
  await configureIdentity({ username: "johndoe@mozilla.com" });

  let server = httpd_setup({
    "/1.1/johndoe@mozilla.com/info/collections": httpd_handler(
      401,
      "Unauthorized"
    ),
  });

  Service.clusterURL = server.baseURI + "/";
  Status.resetSync(); // reset Status.login

  let promiseObserved = promiseOneObserver("weave:service:login:error");

  // Sanity check.
  Assert.equal(scheduler.nextSync, 0);
  Assert.equal(scheduler.syncTimer, null);
  Assert.equal(Status.checkSetup(), STATUS_OK);
  Assert.equal(Status.login, LOGIN_SUCCEEDED);

  scheduler.scheduleNextSync(0);
  await promiseObserved;
  await Async.promiseYield();

  // For the FxA identity, a 401 on info/collections means a transient
  // error, probably due to an inability to fetch a token.
  Assert.equal(Status.login, LOGIN_FAILED_NETWORK_ERROR);
  // syncs should still be scheduled.
  Assert.greater(scheduler.nextSync, Date.now());
  Assert.greater(scheduler.syncTimer.delay, 0);

  await cleanUpAndGo(server);
});

add_task(async function test_proper_interval_on_only_failing() {
  _("Ensure proper behavior when only failed records are applied.");

  // If an engine reports that no records succeeded, we shouldn't decrease the
  // sync interval.
  Assert.ok(!scheduler.hasIncomingItems);
  const INTERVAL = 10000000;
  scheduler.syncInterval = INTERVAL;

  Svc.Obs.notify("weave:service:sync:applied", {
    applied: 2,
    succeeded: 0,
    failed: 2,
    newFailed: 2,
    reconciled: 0,
  });

  await Async.promiseYield();
  scheduler.adjustSyncInterval();
  Assert.ok(!scheduler.hasIncomingItems);
  Assert.equal(scheduler.syncInterval, scheduler.singleDeviceInterval);
});

add_task(async function test_link_status_change() {
  _("Check that we only attempt to sync when link status is up");
  try {
    sinon.spy(scheduler, "scheduleNextSync");

    Svc.Obs.notify("network:link-status-changed", null, "down");
    equal(scheduler.scheduleNextSync.callCount, 0);

    Svc.Obs.notify("network:link-status-changed", null, "change");
    equal(scheduler.scheduleNextSync.callCount, 0);

    Svc.Obs.notify("network:link-status-changed", null, "up");
    equal(scheduler.scheduleNextSync.callCount, 1);

    Svc.Obs.notify("network:link-status-changed", null, "change");
    equal(scheduler.scheduleNextSync.callCount, 1);
  } finally {
    scheduler.scheduleNextSync.restore();
  }
});
