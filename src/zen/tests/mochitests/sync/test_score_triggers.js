/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { Status } = ChromeUtils.importESModule(
  "resource://services-sync/status.sys.mjs"
);

// Tracking info/collections.
var collectionsHelper = track_collections_helper();
var upd = collectionsHelper.with_updated_collection;

function sync_httpd_setup() {
  let handlers = {};

  handlers["/1.1/johndoe/storage/meta/global"] = new ServerWBO(
    "global",
    {}
  ).handler();
  handlers["/1.1/johndoe/storage/steam"] = new ServerWBO("steam", {}).handler();

  handlers["/1.1/johndoe/info/collections"] = collectionsHelper.handler;
  delete collectionsHelper.collections.crypto;
  delete collectionsHelper.collections.meta;

  let cr = new ServerWBO("keys");
  handlers["/1.1/johndoe/storage/crypto/keys"] = upd("crypto", cr.handler());

  let cl = new ServerCollection();
  handlers["/1.1/johndoe/storage/clients"] = upd("clients", cl.handler());

  return httpd_setup(handlers);
}

async function setUp(server) {
  let engineInfo = await registerRotaryEngine();
  await SyncTestingInfrastructure(server, "johndoe", "ilovejane");
  return engineInfo;
}

add_task(async function test_tracker_score_updated() {
  enableValidationPrefs();
  let { engine, tracker } = await registerRotaryEngine();

  let scoreUpdated = 0;

  function onScoreUpdated() {
    scoreUpdated++;
  }

  Svc.Obs.add("weave:engine:score:updated", onScoreUpdated);

  try {
    Assert.equal(engine.score, 0);

    tracker.score += SCORE_INCREMENT_SMALL;
    Assert.equal(engine.score, SCORE_INCREMENT_SMALL);

    Assert.equal(scoreUpdated, 1);
  } finally {
    Svc.Obs.remove("weave:engine:score:updated", onScoreUpdated);
    tracker.resetScore();
    await tracker.clearChangedIDs();
    await Service.engineManager.unregister(engine);
  }
});

add_task(async function test_sync_triggered() {
  let server = sync_httpd_setup();
  let { engine, tracker } = await setUp(server);

  await Service.login();

  Service.scheduler.syncThreshold = MULTI_DEVICE_THRESHOLD;

  Assert.equal(Status.login, LOGIN_SUCCEEDED);
  tracker.score += SCORE_INCREMENT_XLARGE;

  await promiseOneObserver("weave:service:sync:finish");

  await Service.startOver();
  await promiseStopServer(server);

  await tracker.clearChangedIDs();
  await Service.engineManager.unregister(engine);
});

add_task(async function test_clients_engine_sync_triggered() {
  enableValidationPrefs();

  _("Ensure that client engine score changes trigger a sync.");

  // The clients engine is not registered like other engines. Therefore,
  // it needs special treatment throughout the code. Here, we verify the
  // global score tracker gives it that treatment. See bug 676042 for more.

  let server = sync_httpd_setup();
  let { engine, tracker } = await setUp(server);
  await Service.login();

  Service.scheduler.syncThreshold = MULTI_DEVICE_THRESHOLD;
  Assert.equal(Status.login, LOGIN_SUCCEEDED);
  Service.clientsEngine._tracker.score += SCORE_INCREMENT_XLARGE;

  await promiseOneObserver("weave:service:sync:finish");
  _("Sync due to clients engine change completed.");

  await Service.startOver();
  await promiseStopServer(server);

  await tracker.clearChangedIDs();
  await Service.engineManager.unregister(engine);
});

add_task(async function test_incorrect_credentials_sync_not_triggered() {
  enableValidationPrefs();

  _(
    "Ensure that score changes don't trigger a sync if Status.login != LOGIN_SUCCEEDED."
  );
  let server = sync_httpd_setup();
  let { engine, tracker } = await setUp(server);

  // Ensure we don't actually try to sync.
  function onSyncStart() {
    do_throw("Should not get here!");
  }
  Svc.Obs.add("weave:service:sync:start", onSyncStart);

  // Faking incorrect credentials to prevent score update.
  Status.login = LOGIN_FAILED_LOGIN_REJECTED;
  tracker.score += SCORE_INCREMENT_XLARGE;

  // First wait >100ms (nsITimers can take up to that much time to fire, so
  // we can account for the timer in delayedAutoconnect) and then one event
  // loop tick (to account for a possible call to weave:service:sync:start).
  await promiseNamedTimer(150, {}, "timer");
  await Async.promiseYield();

  Svc.Obs.remove("weave:service:sync:start", onSyncStart);

  Assert.equal(Status.login, LOGIN_FAILED_LOGIN_REJECTED);

  await Service.startOver();
  await promiseStopServer(server);

  await tracker.clearChangedIDs();
  await Service.engineManager.unregister(engine);
});
