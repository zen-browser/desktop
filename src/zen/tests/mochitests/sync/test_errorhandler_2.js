/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { Status } = ChromeUtils.importESModule(
  "resource://services-sync/status.sys.mjs"
);
const { FileUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/FileUtils.sys.mjs"
);

const fakeServer = new SyncServer();
fakeServer.start();

registerCleanupFunction(function () {
  return promiseStopServer(fakeServer).finally(() => {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  });
});

const logsdir = FileUtils.getDir("ProfD", ["weave", "logs"]);
logsdir.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);

function removeLogFiles() {
  let entries = logsdir.directoryEntries;
  while (entries.hasMoreElements()) {
    let logfile = entries.getNext().QueryInterface(Ci.nsIFile);
    logfile.remove(false);
  }
}

function getLogFiles() {
  let result = [];
  let entries = logsdir.directoryEntries;
  while (entries.hasMoreElements()) {
    result.push(entries.getNext().QueryInterface(Ci.nsIFile));
  }
  return result;
}

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
  removeLogFiles();
  // Move log levels back to trace (startOver will have reversed this), sicne
  syncTestLogging();
}

add_task(async function test_crypto_keys_login_server_maintenance_error() {
  enableValidationPrefs();

  Status.resetSync();
  // Test crypto/keys server maintenance errors are not reported.
  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);

  await configureIdentity({ username: "broken.keys" }, server);

  // Force re-download of keys
  Service.collectionKeys.clear();

  let backoffInterval;
  Svc.Obs.add("weave:service:backoff:interval", function observe(subject) {
    Svc.Obs.remove("weave:service:backoff:interval", observe);
    backoffInterval = subject;
  });

  Assert.ok(!Status.enforceBackoff);
  Assert.equal(Status.service, STATUS_OK);

  let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
  await Service.sync();
  await promiseObserved;

  Assert.ok(Status.enforceBackoff);
  Assert.equal(backoffInterval, 42);
  Assert.equal(Status.service, LOGIN_FAILED);
  Assert.equal(Status.login, SERVER_MAINTENANCE);

  await clean();
  await promiseStopServer(server);
});

add_task(async function test_lastSync_not_updated_on_complete_failure() {
  enableValidationPrefs();

  // Test info/collections prolonged server maintenance errors are reported.
  let server = await EHTestsCommon.sync_httpd_setup();
  await EHTestsCommon.setUp(server);

  await configureIdentity({ username: "johndoe" }, server);

  // Do an initial sync that we expect to be successful.
  let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
  await sync_and_validate_telem();
  await promiseObserved;

  Assert.equal(Status.service, STATUS_OK);
  Assert.equal(Status.sync, SYNC_SUCCEEDED);

  let lastSync = Svc.PrefBranch.getStringPref("lastSync");

  Assert.ok(lastSync);

  // Report server maintenance on info/collections requests
  server.registerPathHandler(
    "/1.1/johndoe/info/collections",
    EHTestsCommon.service_unavailable
  );

  promiseObserved = promiseOneObserver("weave:service:reset-file-log");
  await sync_and_validate_telem(() => {});
  await promiseObserved;

  Assert.equal(Status.sync, SERVER_MAINTENANCE);
  Assert.equal(Status.service, SYNC_FAILED);

  // We shouldn't update lastSync on complete failure.
  Assert.equal(lastSync, Svc.PrefBranch.getStringPref("lastSync"));

  await clean();
  await promiseStopServer(server);
});

add_task(
  async function test_sync_syncAndReportErrors_server_maintenance_error() {
    enableValidationPrefs();

    // Test server maintenance errors are reported
    // when calling syncAndReportErrors.
    let server = await EHTestsCommon.sync_httpd_setup();
    await EHTestsCommon.setUp(server);

    const BACKOFF = 42;
    engine.enabled = true;
    engine.exception = { status: 503, headers: { "retry-after": BACKOFF } };

    Assert.equal(Status.service, STATUS_OK);

    let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
    await Service.sync();
    await promiseObserved;

    Assert.equal(Status.service, SYNC_FAILED_PARTIAL);
    Assert.equal(Status.sync, SERVER_MAINTENANCE);

    await clean();
    await promiseStopServer(server);
  }
);

add_task(
  async function test_info_collections_login_syncAndReportErrors_server_maintenance_error() {
    enableValidationPrefs();

    // Test info/collections server maintenance errors are reported
    // when calling syncAndReportErrors.
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

    let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
    await Service.sync();
    await promiseObserved;

    Assert.ok(Status.enforceBackoff);
    Assert.equal(backoffInterval, 42);
    Assert.equal(Status.service, LOGIN_FAILED);
    Assert.equal(Status.login, SERVER_MAINTENANCE);

    await clean();
    await promiseStopServer(server);
  }
);

add_task(
  async function test_meta_global_login_syncAndReportErrors_server_maintenance_error() {
    enableValidationPrefs();

    // Test meta/global server maintenance errors are reported
    // when calling syncAndReportErrors.
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

    let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
    await Service.sync();
    await promiseObserved;

    Assert.ok(Status.enforceBackoff);
    Assert.equal(backoffInterval, 42);
    Assert.equal(Status.service, LOGIN_FAILED);
    Assert.equal(Status.login, SERVER_MAINTENANCE);

    await clean();
    await promiseStopServer(server);
  }
);

add_task(
  async function test_download_crypto_keys_login_syncAndReportErrors_server_maintenance_error() {
    enableValidationPrefs();

    // Test crypto/keys server maintenance errors are reported
    // when calling syncAndReportErrors.
    let server = await EHTestsCommon.sync_httpd_setup();
    await EHTestsCommon.setUp(server);

    await configureIdentity({ username: "broken.keys" }, server);
    // Force re-download of keys
    Service.collectionKeys.clear();

    let backoffInterval;
    Svc.Obs.add("weave:service:backoff:interval", function observe(subject) {
      Svc.Obs.remove("weave:service:backoff:interval", observe);
      backoffInterval = subject;
    });

    Assert.ok(!Status.enforceBackoff);
    Assert.equal(Status.service, STATUS_OK);

    let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
    await Service.sync();
    await promiseObserved;

    Assert.ok(Status.enforceBackoff);
    Assert.equal(backoffInterval, 42);
    Assert.equal(Status.service, LOGIN_FAILED);
    Assert.equal(Status.login, SERVER_MAINTENANCE);

    await clean();
    await promiseStopServer(server);
  }
);

add_task(
  async function test_upload_crypto_keys_login_syncAndReportErrors_server_maintenance_error() {
    enableValidationPrefs();

    // Test crypto/keys server maintenance errors are reported
    // when calling syncAndReportErrors.
    let server = await EHTestsCommon.sync_httpd_setup();

    // Start off with an empty account, do not upload a key.
    await configureIdentity({ username: "broken.keys" }, server);

    let backoffInterval;
    Svc.Obs.add("weave:service:backoff:interval", function observe(subject) {
      Svc.Obs.remove("weave:service:backoff:interval", observe);
      backoffInterval = subject;
    });

    Assert.ok(!Status.enforceBackoff);
    Assert.equal(Status.service, STATUS_OK);

    let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
    await Service.sync();
    await promiseObserved;

    Assert.ok(Status.enforceBackoff);
    Assert.equal(backoffInterval, 42);
    Assert.equal(Status.service, LOGIN_FAILED);
    Assert.equal(Status.login, SERVER_MAINTENANCE);

    await clean();
    await promiseStopServer(server);
  }
);

add_task(
  async function test_wipeServer_login_syncAndReportErrors_server_maintenance_error() {
    enableValidationPrefs();

    // Test crypto/keys server maintenance errors are reported
    // when calling syncAndReportErrors.
    let server = await EHTestsCommon.sync_httpd_setup();

    // Start off with an empty account, do not upload a key.
    await configureIdentity({ username: "broken.wipe" }, server);

    let backoffInterval;
    Svc.Obs.add("weave:service:backoff:interval", function observe(subject) {
      Svc.Obs.remove("weave:service:backoff:interval", observe);
      backoffInterval = subject;
    });

    Assert.ok(!Status.enforceBackoff);
    Assert.equal(Status.service, STATUS_OK);

    let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
    await Service.sync();
    await promiseObserved;

    Assert.ok(Status.enforceBackoff);
    Assert.equal(backoffInterval, 42);
    Assert.equal(Status.service, LOGIN_FAILED);
    Assert.equal(Status.login, SERVER_MAINTENANCE);

    await clean();
    await promiseStopServer(server);
  }
);

add_task(
  async function test_wipeRemote_syncAndReportErrors_server_maintenance_error() {
    enableValidationPrefs();

    // Test that we report prolonged server maintenance errors that occur whilst
    // wiping all remote devices.
    let server = await EHTestsCommon.sync_httpd_setup();

    await configureIdentity({ username: "broken.wipe" }, server);
    await EHTestsCommon.generateAndUploadKeys();

    engine.exception = null;
    engine.enabled = true;

    let backoffInterval;
    Svc.Obs.add("weave:service:backoff:interval", function observe(subject) {
      Svc.Obs.remove("weave:service:backoff:interval", observe);
      backoffInterval = subject;
    });

    Assert.ok(!Status.enforceBackoff);
    Assert.equal(Status.service, STATUS_OK);

    Svc.PrefBranch.setStringPref("firstSync", "wipeRemote");

    let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
    await Service.sync();
    await promiseObserved;

    Assert.ok(Status.enforceBackoff);
    Assert.equal(backoffInterval, 42);
    Assert.equal(Status.service, SYNC_FAILED);
    Assert.equal(Status.sync, SERVER_MAINTENANCE);
    Assert.equal(Svc.PrefBranch.getStringPref("firstSync"), "wipeRemote");

    await clean();
    await promiseStopServer(server);
  }
);

add_task(async function test_sync_engine_generic_fail() {
  enableValidationPrefs();

  equal(getLogFiles().length, 0);

  let server = await EHTestsCommon.sync_httpd_setup();
  engine.enabled = true;
  engine.sync = async function sync() {
    Svc.Obs.notify("weave:engine:sync:error", ENGINE_UNKNOWN_FAIL, "catapult");
  };
  let lastSync = Svc.PrefBranch.getStringPref("lastSync", null);
  let log = Log.repository.getLogger("Sync.ErrorHandler");
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);

  Assert.equal(Status.engines.catapult, undefined);

  let promiseObserved = new Promise(res => {
    Svc.Obs.add("weave:engine:sync:finish", function onEngineFinish() {
      Svc.Obs.remove("weave:engine:sync:finish", onEngineFinish);

      log.info("Adding reset-file-log observer.");
      Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
        Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);
        res();
      });
    });
  });

  Assert.ok(await EHTestsCommon.setUp(server));
  await sync_and_validate_telem(ping => {
    deepEqual(ping.status.service, SYNC_FAILED_PARTIAL);
    deepEqual(ping.engines.find(e => e.status).status, ENGINE_UNKNOWN_FAIL);
  });

  await promiseObserved;

  _("Status.engines: " + JSON.stringify(Status.engines));
  Assert.equal(Status.engines.catapult, ENGINE_UNKNOWN_FAIL);
  Assert.equal(Status.service, SYNC_FAILED_PARTIAL);

  // lastSync should update on partial failure.
  Assert.notEqual(lastSync, Svc.PrefBranch.getStringPref("lastSync"));

  // Test Error log was written on SYNC_FAILED_PARTIAL.
  let logFiles = getLogFiles();
  equal(logFiles.length, 1);
  Assert.ok(
    logFiles[0].leafName.startsWith("error-sync-"),
    logFiles[0].leafName
  );

  await clean();

  await promiseStopServer(server);
});

add_task(async function test_logs_on_sync_error() {
  enableValidationPrefs();

  _(
    "Ensure that an error is still logged when weave:service:sync:error " +
      "is notified, despite shouldReportError returning false."
  );

  let log = Log.repository.getLogger("Sync.ErrorHandler");
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);
  log.info("TESTING");

  // Ensure that we report no error.
  Status.login = MASTER_PASSWORD_LOCKED;

  let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
  Svc.Obs.notify("weave:service:sync:error", {});
  await promiseObserved;

  // Test that error log was written.
  let logFiles = getLogFiles();
  equal(logFiles.length, 1);
  Assert.ok(
    logFiles[0].leafName.startsWith("error-sync-"),
    logFiles[0].leafName
  );

  await clean();
});

add_task(async function test_logs_on_login_error() {
  enableValidationPrefs();

  _(
    "Ensure that an error is still logged when weave:service:login:error " +
      "is notified, despite shouldReportError returning false."
  );

  let log = Log.repository.getLogger("Sync.ErrorHandler");
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);
  log.info("TESTING");

  // Ensure that we report no error.
  Status.login = MASTER_PASSWORD_LOCKED;

  let promiseObserved = promiseOneObserver("weave:service:reset-file-log");
  Svc.Obs.notify("weave:service:login:error", {});
  await promiseObserved;

  // Test that error log was written.
  let logFiles = getLogFiles();
  equal(logFiles.length, 1);
  Assert.ok(
    logFiles[0].leafName.startsWith("error-sync-"),
    logFiles[0].leafName
  );

  await clean();
});

// This test should be the last one since it monkeypatches the engine object
// and we should only have one engine object throughout the file (bug 629664).
add_task(async function test_engine_applyFailed() {
  enableValidationPrefs();

  let server = await EHTestsCommon.sync_httpd_setup();

  engine.enabled = true;
  delete engine.exception;
  engine.sync = async function sync() {
    Svc.Obs.notify("weave:engine:sync:applied", { newFailed: 1 }, "catapult");
  };

  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);

  let promiseObserved = promiseOneObserver("weave:service:reset-file-log");

  Assert.equal(Status.engines.catapult, undefined);
  Assert.ok(await EHTestsCommon.setUp(server));
  await Service.sync();
  await promiseObserved;

  Assert.equal(Status.engines.catapult, ENGINE_APPLY_FAIL);
  Assert.equal(Status.service, SYNC_FAILED_PARTIAL);

  // Test Error log was written on SYNC_FAILED_PARTIAL.
  let logFiles = getLogFiles();
  equal(logFiles.length, 1);
  Assert.ok(
    logFiles[0].leafName.startsWith("error-sync-"),
    logFiles[0].leafName
  );

  await clean();
  await promiseStopServer(server);
});
