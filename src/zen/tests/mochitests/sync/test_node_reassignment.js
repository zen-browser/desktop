/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

_(
  "Test that node reassignment responses are respected on all kinds of " +
    "requests."
);

const { RESTRequest } = ChromeUtils.importESModule(
  "resource://services-common/rest.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_task(async function setup() {
  validate_all_future_pings();
});

/**
 * Emulate the following Zeus config:
 * $draining = data.get($prefix . $host . " draining");
 * if ($draining == "drain.") {
 *   log.warn($log_host_db_status . " migrating=1 (node-reassignment)" .
 *            $log_suffix);
 *   http.sendResponse("401 Node reassignment", $content_type,
 *                     '"server request: node reassignment"', "");
 * }
 */
const reassignBody = '"server request: node reassignment"';

// API-compatible with SyncServer handler. Bind `handler` to something to use
// as a ServerCollection handler.
function handleReassign(handler, req, resp) {
  resp.setStatusLine(req.httpVersion, 401, "Node reassignment");
  resp.setHeader("Content-Type", "application/json");
  resp.bodyOutputStream.write(reassignBody, reassignBody.length);
}

async function prepareServer() {
  let server = new SyncServer();
  server.registerUser("johndoe");
  server.start();
  syncTestLogging();
  await configureIdentity({ username: "johndoe" }, server);
  return server;
}

function getReassigned() {
  try {
    return Services.prefs.getBoolPref("services.sync.lastSyncReassigned");
  } catch (ex) {
    if (ex.result != Cr.NS_ERROR_UNEXPECTED) {
      do_throw(
        "Got exception retrieving lastSyncReassigned: " + Log.exceptionStr(ex)
      );
    }
  }
  return false;
}

/**
 * Make a test request to `url`, then watch the result of two syncs
 * to ensure that a node request was made.
 * Runs `between` between the two. This can be used to undo deliberate failure
 * setup, detach observers, etc.
 */
async function syncAndExpectNodeReassignment(
  server,
  firstNotification,
  between,
  secondNotification,
  url
) {
  let deferred = Promise.withResolvers();

  let getTokenCount = 0;
  let mockTSC = {
    // TokenServerClient
    async getTokenUsingOAuth() {
      getTokenCount++;
      return { endpoint: server.baseURI + "1.1/johndoe/" };
    },
  };
  Service.identity._tokenServerClient = mockTSC;

  // Make sure that it works!
  let request = new RESTRequest(url);
  let response = await request.get();
  Assert.equal(response.status, 401);

  function onFirstSync() {
    _("First sync completed.");
    Svc.Obs.remove(firstNotification, onFirstSync);
    Svc.Obs.add(secondNotification, onSecondSync);

    Assert.equal(Service.clusterURL, "");

    // Allow for tests to clean up error conditions.
    between();
  }
  function onSecondSync() {
    _("Second sync completed.");
    Svc.Obs.remove(secondNotification, onSecondSync);
    Service.scheduler.clearSyncTriggers();

    // Make absolutely sure that any event listeners are done with their work
    // before we proceed.
    waitForZeroTimer(function () {
      _("Second sync nextTick.");
      Assert.equal(getTokenCount, 1);
      Service.startOver().then(() => {
        server.stop(deferred.resolve);
      });
    });
  }

  Svc.Obs.add(firstNotification, onFirstSync);
  await Service.sync();

  await deferred.promise;
}

add_task(async function test_momentary_401_engine() {
  enableValidationPrefs();

  _("Test a failure for engine URLs that's resolved by reassignment.");
  let server = await prepareServer();
  let john = server.user("johndoe");

  _("Enabling the Rotary engine.");
  let { engine, syncID, tracker } = await registerRotaryEngine();

  // We need the server to be correctly set up prior to experimenting. Do this
  // through a sync.
  let global = {
    syncID: Service.syncID,
    storageVersion: STORAGE_VERSION,
    rotary: { version: engine.version, syncID },
  };
  john.createCollection("meta").insert("global", global);

  _("First sync to prepare server contents.");
  await Service.sync();

  let numResets = 0;
  let observeReset = (obs, topic) => {
    if (topic == "rotary") {
      numResets += 1;
    }
  };
  _("Adding observer that we saw an engine reset.");
  Svc.Obs.add("weave:engine:reset-client:finish", observeReset);

  _("Setting up Rotary collection to 401.");
  let rotary = john.createCollection("rotary");
  let oldHandler = rotary.collectionHandler;
  rotary.collectionHandler = handleReassign.bind(this, undefined);

  // We want to verify that the clusterURL pref has been cleared after a 401
  // inside a sync. Flag the Rotary engine to need syncing.
  john.collection("rotary").timestamp += 1000;

  function between() {
    _("Undoing test changes.");
    rotary.collectionHandler = oldHandler;

    function onLoginStart() {
      // lastSyncReassigned shouldn't be cleared until a sync has succeeded.
      _("Ensuring that lastSyncReassigned is still set at next sync start.");
      Svc.Obs.remove("weave:service:login:start", onLoginStart);
      Assert.ok(getReassigned());
    }

    _("Adding observer that lastSyncReassigned is still set on login.");
    Svc.Obs.add("weave:service:login:start", onLoginStart);
  }

  await syncAndExpectNodeReassignment(
    server,
    "weave:service:sync:finish",
    between,
    "weave:service:sync:finish",
    Service.storageURL + "rotary"
  );

  Svc.Obs.remove("weave:engine:reset-client:finish", observeReset);
  Assert.equal(numResets, 1);
  await tracker.clearChangedIDs();
  await Service.engineManager.unregister(engine);
});

// This test ends up being a failing fetch *after we're already logged in*.
add_task(async function test_momentary_401_info_collections() {
  enableValidationPrefs();

  _("Test a failure for info/collections that's resolved by reassignment.");
  let server = await prepareServer();

  _("First sync to prepare server contents.");
  await Service.sync();

  // Return a 401 for info requests, particularly info/collections.
  let oldHandler = server.toplevelHandlers.info;
  server.toplevelHandlers.info = handleReassign;

  function undo() {
    _("Undoing test changes.");
    server.toplevelHandlers.info = oldHandler;
  }

  await syncAndExpectNodeReassignment(
    server,
    "weave:service:sync:error",
    undo,
    "weave:service:sync:finish",
    Service.infoURL
  );
});

add_task(async function test_momentary_401_storage_loggedin() {
  enableValidationPrefs();

  _(
    "Test a failure for any storage URL, not just engine parts. " +
      "Resolved by reassignment."
  );
  let server = await prepareServer();

  _("Performing initial sync to ensure we are logged in.");
  await Service.sync();

  // Return a 401 for all storage requests.
  let oldHandler = server.toplevelHandlers.storage;
  server.toplevelHandlers.storage = handleReassign;

  function undo() {
    _("Undoing test changes.");
    server.toplevelHandlers.storage = oldHandler;
  }

  Assert.ok(Service.isLoggedIn, "already logged in");
  await syncAndExpectNodeReassignment(
    server,
    "weave:service:sync:error",
    undo,
    "weave:service:sync:finish",
    Service.storageURL + "meta/global"
  );
});

add_task(async function test_momentary_401_storage_loggedout() {
  enableValidationPrefs();

  _(
    "Test a failure for any storage URL, not just engine parts. " +
      "Resolved by reassignment."
  );
  let server = await prepareServer();

  // Return a 401 for all storage requests.
  let oldHandler = server.toplevelHandlers.storage;
  server.toplevelHandlers.storage = handleReassign;

  function undo() {
    _("Undoing test changes.");
    server.toplevelHandlers.storage = oldHandler;
  }

  Assert.ok(!Service.isLoggedIn, "not already logged in");
  await syncAndExpectNodeReassignment(
    server,
    "weave:service:login:error",
    undo,
    "weave:service:sync:finish",
    Service.storageURL + "meta/global"
  );
});

add_task(async function test_loop_avoidance_storage() {
  enableValidationPrefs();

  _(
    "Test that a repeated failure doesn't result in a sync loop " +
      "if node reassignment cannot resolve the failure."
  );

  let server = await prepareServer();

  // Return a 401 for all storage requests.
  let oldHandler = server.toplevelHandlers.storage;
  server.toplevelHandlers.storage = handleReassign;

  let firstNotification = "weave:service:login:error";
  let secondNotification = "weave:service:login:error";
  let thirdNotification = "weave:service:sync:finish";

  let deferred = Promise.withResolvers();

  let getTokenCount = 0;
  let mockTSC = {
    // TokenServerClient
    async getTokenUsingOAuth() {
      getTokenCount++;
      return { endpoint: server.baseURI + "1.1/johndoe/" };
    },
  };
  Service.identity._tokenServerClient = mockTSC;

  // Track the time. We want to make sure the duration between the first and
  // second sync is small, and then that the duration between second and third
  // is set to be large.
  let now;

  function onFirstSync() {
    _("First sync completed.");
    Svc.Obs.remove(firstNotification, onFirstSync);
    Svc.Obs.add(secondNotification, onSecondSync);

    Assert.equal(Service.clusterURL, "");

    // We got a 401 mid-sync, and set the pref accordingly.
    Assert.ok(Services.prefs.getBoolPref("services.sync.lastSyncReassigned"));

    // Update the timestamp.
    now = Date.now();
  }

  function onSecondSync() {
    _("Second sync completed.");
    Svc.Obs.remove(secondNotification, onSecondSync);
    Svc.Obs.add(thirdNotification, onThirdSync);

    // This sync occurred within the backoff interval.
    let elapsedTime = Date.now() - now;
    Assert.less(elapsedTime, MINIMUM_BACKOFF_INTERVAL);

    // This pref will be true until a sync completes successfully.
    Assert.ok(getReassigned());

    // The timer will be set for some distant time.
    // We store nextSync in prefs, which offers us only limited resolution.
    // Include that logic here.
    let expectedNextSync =
      1000 * Math.floor((now + MINIMUM_BACKOFF_INTERVAL) / 1000);
    _("Next sync scheduled for " + Service.scheduler.nextSync);
    _("Expected to be slightly greater than " + expectedNextSync);

    Assert.greaterOrEqual(Service.scheduler.nextSync, expectedNextSync);
    Assert.ok(!!Service.scheduler.syncTimer);

    // Undo our evil scheme.
    server.toplevelHandlers.storage = oldHandler;

    // Bring the timer forward to kick off a successful sync, so we can watch
    // the pref get cleared.
    Service.scheduler.scheduleNextSync(0);
  }
  function onThirdSync() {
    Svc.Obs.remove(thirdNotification, onThirdSync);

    // That'll do for now; no more syncs.
    Service.scheduler.clearSyncTriggers();

    // Make absolutely sure that any event listeners are done with their work
    // before we proceed.
    waitForZeroTimer(function () {
      _("Third sync nextTick.");
      Assert.ok(!getReassigned());
      Assert.equal(getTokenCount, 2);
      Service.startOver().then(() => {
        server.stop(deferred.resolve);
      });
    });
  }

  Svc.Obs.add(firstNotification, onFirstSync);

  now = Date.now();
  await Service.sync();
  await deferred.promise;
});

add_task(async function test_loop_avoidance_engine() {
  enableValidationPrefs();

  _(
    "Test that a repeated 401 in an engine doesn't result in a sync loop " +
      "if node reassignment cannot resolve the failure."
  );
  let server = await prepareServer();
  let john = server.user("johndoe");

  _("Enabling the Rotary engine.");
  let { engine, syncID, tracker } = await registerRotaryEngine();
  let deferred = Promise.withResolvers();

  let getTokenCount = 0;
  let mockTSC = {
    // TokenServerClient
    async getTokenUsingOAuth() {
      getTokenCount++;
      return { endpoint: server.baseURI + "1.1/johndoe/" };
    },
  };
  Service.identity._tokenServerClient = mockTSC;

  // We need the server to be correctly set up prior to experimenting. Do this
  // through a sync.
  let global = {
    syncID: Service.syncID,
    storageVersion: STORAGE_VERSION,
    rotary: { version: engine.version, syncID },
  };
  john.createCollection("meta").insert("global", global);

  _("First sync to prepare server contents.");
  await Service.sync();

  _("Setting up Rotary collection to 401.");
  let rotary = john.createCollection("rotary");
  let oldHandler = rotary.collectionHandler;
  rotary.collectionHandler = handleReassign.bind(this, undefined);

  // Flag the Rotary engine to need syncing.
  john.collection("rotary").timestamp += 1000;

  function onLoginStart() {
    // lastSyncReassigned shouldn't be cleared until a sync has succeeded.
    _("Ensuring that lastSyncReassigned is still set at next sync start.");
    Assert.ok(getReassigned());
  }

  function beforeSuccessfulSync() {
    _("Undoing test changes.");
    rotary.collectionHandler = oldHandler;
  }

  let firstNotification = "weave:service:sync:finish";
  let secondNotification = "weave:service:sync:finish";
  let thirdNotification = "weave:service:sync:finish";

  // Track the time. We want to make sure the duration between the first and
  // second sync is small, and then that the duration between second and third
  // is set to be large.
  let now;

  function onFirstSync() {
    _("First sync completed.");
    Svc.Obs.remove(firstNotification, onFirstSync);
    Svc.Obs.add(secondNotification, onSecondSync);

    Assert.equal(Service.clusterURL, "");

    _("Adding observer that lastSyncReassigned is still set on login.");
    Svc.Obs.add("weave:service:login:start", onLoginStart);

    // We got a 401 mid-sync, and set the pref accordingly.
    Assert.ok(Services.prefs.getBoolPref("services.sync.lastSyncReassigned"));

    // Update the timestamp.
    now = Date.now();
  }

  function onSecondSync() {
    _("Second sync completed.");
    Svc.Obs.remove(secondNotification, onSecondSync);
    Svc.Obs.add(thirdNotification, onThirdSync);

    // This sync occurred within the backoff interval.
    let elapsedTime = Date.now() - now;
    Assert.less(elapsedTime, MINIMUM_BACKOFF_INTERVAL);

    // This pref will be true until a sync completes successfully.
    Assert.ok(getReassigned());

    // The timer will be set for some distant time.
    // We store nextSync in prefs, which offers us only limited resolution.
    // Include that logic here.
    let expectedNextSync =
      1000 * Math.floor((now + MINIMUM_BACKOFF_INTERVAL) / 1000);
    _("Next sync scheduled for " + Service.scheduler.nextSync);
    _("Expected to be slightly greater than " + expectedNextSync);

    Assert.greaterOrEqual(Service.scheduler.nextSync, expectedNextSync);
    Assert.ok(!!Service.scheduler.syncTimer);

    // Undo our evil scheme.
    beforeSuccessfulSync();

    // Bring the timer forward to kick off a successful sync, so we can watch
    // the pref get cleared.
    Service.scheduler.scheduleNextSync(0);
  }

  function onThirdSync() {
    Svc.Obs.remove(thirdNotification, onThirdSync);

    // That'll do for now; no more syncs.
    Service.scheduler.clearSyncTriggers();

    // Make absolutely sure that any event listeners are done with their work
    // before we proceed.
    waitForZeroTimer(function () {
      _("Third sync nextTick.");
      Assert.ok(!getReassigned());
      Assert.equal(getTokenCount, 2);
      Svc.Obs.remove("weave:service:login:start", onLoginStart);
      Service.startOver().then(() => {
        server.stop(deferred.resolve);
      });
    });
  }

  Svc.Obs.add(firstNotification, onFirstSync);

  now = Date.now();
  await Service.sync();
  await deferred.promise;

  await tracker.clearChangedIDs();
  await Service.engineManager.unregister(engine);
});
