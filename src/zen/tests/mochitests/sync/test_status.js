const { Status } = ChromeUtils.importESModule(
  "resource://services-sync/status.sys.mjs"
);

function run_test() {
  // Check initial states
  Assert.ok(!Status.enforceBackoff);
  Assert.equal(Status.backoffInterval, 0);
  Assert.equal(Status.minimumNextSync, 0);

  Assert.equal(Status.service, STATUS_OK);
  Assert.equal(Status.sync, SYNC_SUCCEEDED);
  Assert.equal(Status.login, LOGIN_SUCCEEDED);
  if (Status.engines.length) {
    do_throw("Status.engines should be empty.");
  }
  Assert.equal(Status.partial, false);

  // Check login status
  for (let code of [LOGIN_FAILED_NO_USERNAME, LOGIN_FAILED_NO_PASSPHRASE]) {
    Status.login = code;
    Assert.equal(Status.login, code);
    Assert.equal(Status.service, CLIENT_NOT_CONFIGURED);
    Status.resetSync();
  }

  Status.login = LOGIN_FAILED;
  Assert.equal(Status.login, LOGIN_FAILED);
  Assert.equal(Status.service, LOGIN_FAILED);
  Status.resetSync();

  Status.login = LOGIN_SUCCEEDED;
  Assert.equal(Status.login, LOGIN_SUCCEEDED);
  Assert.equal(Status.service, STATUS_OK);
  Status.resetSync();

  // Check sync status
  Status.sync = SYNC_FAILED;
  Assert.equal(Status.sync, SYNC_FAILED);
  Assert.equal(Status.service, SYNC_FAILED);

  Status.sync = SYNC_SUCCEEDED;
  Assert.equal(Status.sync, SYNC_SUCCEEDED);
  Assert.equal(Status.service, STATUS_OK);

  Status.resetSync();

  // Check engine status
  Status.engines = ["testEng1", ENGINE_SUCCEEDED];
  Assert.equal(Status.engines.testEng1, ENGINE_SUCCEEDED);
  Assert.equal(Status.service, STATUS_OK);

  Status.engines = ["testEng2", ENGINE_DOWNLOAD_FAIL];
  Assert.equal(Status.engines.testEng1, ENGINE_SUCCEEDED);
  Assert.equal(Status.engines.testEng2, ENGINE_DOWNLOAD_FAIL);
  Assert.equal(Status.service, SYNC_FAILED_PARTIAL);

  Status.engines = ["testEng3", ENGINE_SUCCEEDED];
  Assert.equal(Status.engines.testEng1, ENGINE_SUCCEEDED);
  Assert.equal(Status.engines.testEng2, ENGINE_DOWNLOAD_FAIL);
  Assert.equal(Status.engines.testEng3, ENGINE_SUCCEEDED);
  Assert.equal(Status.service, SYNC_FAILED_PARTIAL);

  // Check resetSync
  Status.sync = SYNC_FAILED;
  Status.resetSync();

  Assert.equal(Status.service, STATUS_OK);
  Assert.equal(Status.sync, SYNC_SUCCEEDED);
  if (Status.engines.length) {
    do_throw("Status.engines should be empty.");
  }

  // Check resetBackoff
  Status.enforceBackoff = true;
  Status.backOffInterval = 4815162342;
  Status.backOffInterval = 42;
  Status.resetBackoff();

  Assert.ok(!Status.enforceBackoff);
  Assert.equal(Status.backoffInterval, 0);
  Assert.equal(Status.minimumNextSync, 0);
}
