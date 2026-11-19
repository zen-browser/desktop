/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { Status } = ChromeUtils.importESModule(
  "resource://services-sync/status.sys.mjs"
);

const fakeServer = new SyncServer();
fakeServer.start();
const fakeServerUrl = "http://localhost:" + fakeServer.port;

registerCleanupFunction(function () {
  return promiseStopServer(fakeServer).finally(() => {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  });
});

let engine;
add_task(async function setup() {
  await Service.engineManager.clear();
  await Service.engineManager.register(EHTestsCommon.CatapultEngine);
  engine = Service.engineManager.get("catapult");
});

async function clean() {
  let promiseLogReset = promiseOneObserver("weave:service:reset-file-log");
  await Service.startOver();
  await promiseLogReset;
  Status.resetSync();
  Status.resetBackoff();
  // Move log levels back to trace (startOver will have reversed this), sicne
  syncTestLogging();
}

add_task(async function test_401_logout() {
  enableValidationPrefs();

  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);

  // By calling sync, we ensure we're logged in.
  await sync_and_validate_telem();
  Assert.equal(Status.sync, SYNC_SUCCEEDED);
  Assert.ok(Service.isLoggedIn);

  let promiseErrors = new Promise(res => {
    Svc.Obs.add("weave:service:sync:error", onSyncError);
    function onSyncError() {
      _("Got weave:service:sync:error in first sync.");
      Svc.Obs.remove("weave:service:sync:error", onSyncError);

      // Wait for the automatic next sync.
      Svc.Obs.add("weave:service:login:error", onLoginError);
      function onLoginError() {
        _("Got weave:service:login:error in second sync.");
        Svc.Obs.remove("weave:service:login:error", onLoginError);
        res();
      }
    }
  });

  // Make sync fail due to login rejected.
  await configureIdentity({ username: "janedoe" }, server);
  Service._updateCachedURLs();

  _("Starting first sync.");
  await sync_and_validate_telem(ping => {
    deepEqual(ping.failureReason, { name: "httperror", code: 401 });
  });
  _("First sync done.");

  await promiseErrors;
  Assert.equal(Status.login, LOGIN_FAILED_NETWORK_ERROR);
  Assert.ok(!Service.isLoggedIn);

  // Clean up.
  await Service.startOver();
  await promiseStopServer(server);
});

add_task(async function test_credentials_changed_logout() {
  enableValidationPrefs();

  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);

  // By calling sync, we ensure we're logged in.
  await sync_and_validate_telem();
  Assert.equal(Status.sync, SYNC_SUCCEEDED);
  Assert.ok(Service.isLoggedIn);

  await EHTestsCommon.generateCredentialsChangedFailure();

  await sync_and_validate_telem(ping => {
    equal(ping.status.sync, CREDENTIALS_CHANGED);
    deepEqual(ping.failureReason, {
      name: "unexpectederror",
      error: "Error: Aborting sync, remote setup failed",
    });
  });

  Assert.equal(Status.sync, CREDENTIALS_CHANGED);
  Assert.ok(!Service.isLoggedIn);

  // Clean up.
  await Service.startOver();
  await promiseStopServer(server);
});

add_task(async function test_login_non_network_error() {
  enableValidationPrefs();

  // Test non-network errors are reported
  // when calling sync
  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);
  Service.identity._syncKeyBundle = null;

  await Service.sync();
  Assert.equal(Status.login, LOGIN_FAILED_NO_PASSPHRASE);

  await clean();
  await promiseStopServer(server);
});

add_task(async function test_sync_non_network_error() {
  enableValidationPrefs();

  // Test non-network errors are reported
  // when calling sync
  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);

  // By calling sync, we ensure we're logged in.
  await Service.sync();
  Assert.equal(Status.sync, SYNC_SUCCEEDED);
  Assert.ok(Service.isLoggedIn);

  await EHTestsCommon.generateCredentialsChangedFailure();

  await sync_and_validate_telem(ping => {
    equal(ping.status.sync, CREDENTIALS_CHANGED);
    deepEqual(ping.failureReason, {
      name: "unexpectederror",
      error: "Error: Aborting sync, remote setup failed",
    });
  });

  Assert.equal(Status.sync, CREDENTIALS_CHANGED);
  // If we clean this tick, telemetry won't get the right error
  await Async.promiseYield();
  await clean();
  await promiseStopServer(server);
});

add_task(async function test_login_sync_network_error() {
  enableValidationPrefs();

  // Test network errors are reported when calling sync.
  await configureIdentity({ username: "broken.wipe" });
  Service.clusterURL = fakeServerUrl;

  await Service.sync();
  Assert.equal(Status.login, LOGIN_FAILED_NETWORK_ERROR);

  await clean();
});

add_task(async function test_sync_network_error() {
  enableValidationPrefs();

  // Test network errors are reported when calling sync.
  Services.io.offline = true;

  await Service.sync();
  Assert.equal(Status.sync, LOGIN_FAILED_NETWORK_ERROR);

  Services.io.offline = false;
  await clean();
});

add_task(async function test_login_non_network_error() {
  enableValidationPrefs();

  // Test non-network errors are reported
  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);
  Service.identity._syncKeyBundle = null;

  await Service.sync();
  Assert.equal(Status.login, LOGIN_FAILED_NO_PASSPHRASE);

  await clean();
  await promiseStopServer(server);
});

add_task(async function test_sync_non_network_error() {
  enableValidationPrefs();

  // Test non-network errors are reported
  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);

  // By calling sync, we ensure we're logged in.
  await Service.sync();
  Assert.equal(Status.sync, SYNC_SUCCEEDED);
  Assert.ok(Service.isLoggedIn);

  await EHTestsCommon.generateCredentialsChangedFailure();

  await Service.sync();
  Assert.equal(Status.sync, CREDENTIALS_CHANGED);

  await clean();
  await promiseStopServer(server);
});

add_task(async function test_login_network_error() {
  enableValidationPrefs();

  await configureIdentity({ username: "johndoe" });
  Service.clusterURL = fakeServerUrl;

  // Test network errors are not reported.

  await Service.sync();
  Assert.equal(Status.login, LOGIN_FAILED_NETWORK_ERROR);

  Services.io.offline = false;
  await clean();
});

add_task(async function test_sync_network_error() {
  enableValidationPrefs();

  // Test network errors are not reported.
  Services.io.offline = true;

  await Service.sync();
  Assert.equal(Status.sync, LOGIN_FAILED_NETWORK_ERROR);

  Services.io.offline = false;
  await clean();
});

add_task(async function test_sync_server_maintenance_error() {
  enableValidationPrefs();

  // Test server maintenance errors are not reported.
  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);

  const BACKOFF = 42;
  engine.enabled = true;
  engine.exception = { status: 503, headers: { "retry-after": BACKOFF } };

  Assert.equal(Status.service, STATUS_OK);

  await sync_and_validate_telem(ping => {
    equal(ping.status.sync, SERVER_MAINTENANCE);
    deepEqual(ping.engines.find(e => e.failureReason).failureReason, {
      name: "httperror",
      code: 503,
    });
  });

  Assert.equal(Status.service, SYNC_FAILED_PARTIAL);
  Assert.equal(Status.sync, SERVER_MAINTENANCE);

  await clean();
  await promiseStopServer(server);
});

add_task(async function test_info_collections_login_server_maintenance_error() {
  enableValidationPrefs();

  // Test info/collections server maintenance errors are not reported.
  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);

  await configureIdentity({ username: "broken.info" }, server);

  let backoffInterval;
  Svc.Obs.add("weave:service:backoff:interval", function observe(subject) {
    Svc.Obs.remove("weave:service:backoff:interval", observe);
    backoffInterval = subject;
  });

  Assert.ok(!Status.enforceBackoff);
  Assert.equal(Status.service, STATUS_OK);

  await Service.sync();

  Assert.ok(Status.enforceBackoff);
  Assert.equal(backoffInterval, 42);
  Assert.equal(Status.service, LOGIN_FAILED);
  Assert.equal(Status.login, SERVER_MAINTENANCE);

  await clean();
  await promiseStopServer(server);
});

add_task(async function test_meta_global_login_server_maintenance_error() {
  enableValidationPrefs();

  // Test meta/global server maintenance errors are not reported.
  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);

  await configureIdentity({ username: "broken.meta" }, server);

  let backoffInterval;
  Svc.Obs.add("weave:service:backoff:interval", function observe(subject) {
    Svc.Obs.remove("weave:service:backoff:interval", observe);
    backoffInterval = subject;
  });

  Assert.ok(!Status.enforceBackoff);
  Assert.equal(Status.service, STATUS_OK);

  await Service.sync();

  Assert.ok(Status.enforceBackoff);
  Assert.equal(backoffInterval, 42);
  Assert.equal(Status.service, LOGIN_FAILED);
  Assert.equal(Status.login, SERVER_MAINTENANCE);

  await clean();
  await promiseStopServer(server);
});
