const { FXA_PWDMGR_HOST, FXA_PWDMGR_REALM } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccountsCommon.sys.mjs"
);
const { LoginRec } = ChromeUtils.importESModule(
  "resource://services-sync/engines/passwords.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

const LoginInfo = Components.Constructor(
  "@mozilla.org/login-manager/loginInfo;1",
  Ci.nsILoginInfo,
  "init"
);

const { LoginCSVImport } = ChromeUtils.importESModule(
  "resource://gre/modules/LoginCSVImport.sys.mjs"
);

const { FileTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/FileTestUtils.sys.mjs"
);

const PropertyBag = Components.Constructor(
  "@mozilla.org/hash-property-bag;1",
  Ci.nsIWritablePropertyBag
);

async function cleanup(engine, server) {
  await engine._tracker.stop();
  await engine.wipeClient();
  engine.lastModified = null;
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  Service.recordManager.clearCache();
  if (server) {
    await promiseStopServer(server);
  }
}

add_task(async function setup() {
  // Disable addon sync because AddonManager won't be initialized here.
  await Service.engineManager.unregister("addons");
  await Service.engineManager.unregister("extension-storage");
});

add_task(async function test_ignored_fields() {
  _("Only changes to syncable fields should be tracked");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  enableValidationPrefs();

  let loginInfo = new LoginInfo(
    "https://example.com",
    "",
    null,
    "username",
    "password",
    "",
    ""
  );

  // Setting syncCounter to -1 so that it will be incremented to 0 when added.
  loginInfo.syncCounter = -1;
  let login = await Services.logins.addLoginAsync(loginInfo);
  login.QueryInterface(Ci.nsILoginMetaInfo); // For `guid`.

  engine._tracker.start();

  try {
    let nonSyncableProps = new PropertyBag();
    nonSyncableProps.setProperty("timeLastUsed", Date.now());
    nonSyncableProps.setProperty("timesUsed", 3);
    await Services.logins.modifyLoginAsync(login, nonSyncableProps);

    let noChanges = await engine.pullNewChanges();
    deepEqual(noChanges, {}, "Should not track non-syncable fields");

    let syncableProps = new PropertyBag();
    syncableProps.setProperty("username", "newuser");
    await Services.logins.modifyLoginAsync(login, syncableProps);

    let changes = await engine.pullNewChanges();
    deepEqual(
      Object.keys(changes),
      [login.guid],
      "Should track syncable fields"
    );
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_ignored_sync_credentials() {
  _("Sync credentials in login manager should be ignored");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  enableValidationPrefs();

  engine._tracker.start();

  try {
    let login = await Services.logins.addLoginAsync(
      new LoginInfo(
        FXA_PWDMGR_HOST,
        null,
        FXA_PWDMGR_REALM,
        "fxa-uid",
        "creds",
        "",
        ""
      )
    );

    let noChanges = await engine.pullNewChanges();
    deepEqual(noChanges, {}, "Should not track new FxA credentials");

    let props = new PropertyBag();
    props.setProperty("password", "newcreds");
    await Services.logins.modifyLoginAsync(login, props);

    noChanges = await engine.pullNewChanges();
    deepEqual(noChanges, {}, "Should not track changes to FxA credentials");

    let foundLogins = await Services.logins.searchLoginsAsync({
      origin: FXA_PWDMGR_HOST,
    });
    equal(foundLogins.length, 1);
    equal(foundLogins[0].syncCounter, 0);
    equal(foundLogins[0].everSynced, false);
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_password_engine() {
  _("Basic password sync test");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("passwords");

  enableValidationPrefs();

  _("Add new login to upload during first sync");
  let newLogin;
  {
    let login = new LoginInfo(
      "https://example.com",
      "",
      null,
      "username",
      "password",
      "",
      ""
    );
    await Services.logins.addLoginAsync(login);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://example.com",
    });
    equal(logins.length, 1, "Should find new login in login manager");
    newLogin = logins[0].QueryInterface(Ci.nsILoginMetaInfo);

    // Insert a server record that's older, so that we prefer the local one.
    let rec = new LoginRec("passwords", newLogin.guid);
    rec.formSubmitURL = newLogin.formActionOrigin;
    rec.httpRealm = newLogin.httpRealm;
    rec.hostname = newLogin.origin;
    rec.username = newLogin.username;
    rec.password = "sekrit";
    let remotePasswordChangeTime = Date.now() - 1 * 60 * 60 * 24 * 1000;
    rec.timeCreated = remotePasswordChangeTime;
    rec.timePasswordChanged = remotePasswordChangeTime;
    collection.insert(
      newLogin.guid,
      encryptPayload(rec.cleartext),
      remotePasswordChangeTime / 1000
    );
  }

  _("Add login with older password change time to replace during first sync");
  let oldLogin;
  {
    let login = new LoginInfo(
      "https://mozilla.com",
      "",
      null,
      "us3r",
      "0ldpa55",
      "",
      ""
    );
    await Services.logins.addLoginAsync(login);

    let props = new PropertyBag();
    let localPasswordChangeTime = Date.now() - 1 * 60 * 60 * 24 * 1000;
    props.setProperty("timePasswordChanged", localPasswordChangeTime);
    await Services.logins.modifyLoginAsync(login, props);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://mozilla.com",
    });
    equal(logins.length, 1, "Should find old login in login manager");
    oldLogin = logins[0].QueryInterface(Ci.nsILoginMetaInfo);
    equal(oldLogin.timePasswordChanged, localPasswordChangeTime);

    let rec = new LoginRec("passwords", oldLogin.guid);
    rec.hostname = oldLogin.origin;
    rec.formSubmitURL = oldLogin.formActionOrigin;
    rec.httpRealm = oldLogin.httpRealm;
    rec.username = oldLogin.username;
    // Change the password and bump the password change time to ensure we prefer
    // the remote one during reconciliation.
    rec.password = "n3wpa55";
    rec.usernameField = oldLogin.usernameField;
    rec.passwordField = oldLogin.usernameField;
    rec.timeCreated = oldLogin.timeCreated;
    rec.timePasswordChanged = Date.now();
    collection.insert(oldLogin.guid, encryptPayload(rec.cleartext));
  }

  await engine._tracker.stop();

  try {
    await sync_engine_and_validate_telem(engine, false);

    let newRec = collection.cleartext(newLogin.guid);
    equal(
      newRec.password,
      "password",
      "Should update remote password for newer login"
    );

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://mozilla.com",
    });
    equal(
      logins[0].password,
      "n3wpa55",
      "Should update local password for older login"
    );
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_sync_outgoing() {
  _("Test syncing outgoing records");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let collection = server.user("foo").collection("passwords");

  let loginInfo = new LoginInfo(
    "http://mozilla.com",
    "http://mozilla.com",
    null,
    "theuser",
    "thepassword",
    "username",
    "password"
  );
  let login = await Services.logins.addLoginAsync(loginInfo);

  engine._tracker.start();

  try {
    let foundLogins = await Services.logins.searchLoginsAsync({
      origin: "http://mozilla.com",
    });
    equal(foundLogins.length, 1);
    equal(foundLogins[0].syncCounter, 1);
    equal(foundLogins[0].everSynced, false);
    equal(collection.count(), 0);

    let guid = foundLogins[0].QueryInterface(Ci.nsILoginMetaInfo).guid;

    let changes = await engine.getChangedIDs();
    let change = changes[guid];
    equal(Object.keys(changes).length, 1);
    equal(change.counter, 1);
    ok(!change.deleted);

    // This test modifies the password and then performs a sync and
    // then ensures that the synced record is correct. This is done twice
    // to ensure that syncing occurs correctly when the server record does not
    // yet exist and when it does already exist.
    for (let i = 1; i <= 2; i++) {
      _("Modify the password iteration " + i);
      foundLogins[0].password = "newpassword" + i;
      await Services.logins.modifyLoginAsync(login, foundLogins[0]);
      foundLogins = await Services.logins.searchLoginsAsync({
        origin: "http://mozilla.com",
      });
      equal(foundLogins.length, 1);
      // On the first pass, the counter should be 2, one for the add and one for the modify.
      // No sync has occurred yet so everSynced should be false.
      // On the second pass, the counter will only be 1 for the modify. The everSynced
      // property should be true as the sync happened on the last iteration.
      equal(foundLogins[0].syncCounter, i == 2 ? 1 : 2);
      equal(foundLogins[0].everSynced, i == 2);

      changes = await engine.getChangedIDs();
      change = changes[guid];
      equal(Object.keys(changes).length, 1);
      equal(change.counter, i == 2 ? 1 : 2);
      ok(!change.deleted);

      _("Perform sync after modifying the password");
      await sync_engine_and_validate_telem(engine, false);

      equal(Object.keys(await engine.getChangedIDs()), 0);

      // The remote login should have the updated password.
      let newRec = collection.cleartext(guid);
      equal(
        newRec.password,
        "newpassword" + i,
        "Should update remote password for login"
      );

      foundLogins = await Services.logins.searchLoginsAsync({
        origin: "http://mozilla.com",
      });
      equal(foundLogins.length, 1);
      equal(foundLogins[0].syncCounter, 0);
      equal(foundLogins[0].everSynced, true);

      login.password = "newpassword" + i;
    }

    // Next, modify the username and sync.
    _("Modify the username");
    foundLogins[0].username = "newuser";
    await Services.logins.modifyLoginAsync(login, foundLogins[0]);
    foundLogins = await Services.logins.searchLoginsAsync({
      origin: "http://mozilla.com",
    });
    equal(foundLogins.length, 1);
    equal(foundLogins[0].syncCounter, 1);
    equal(foundLogins[0].everSynced, true);

    _("Perform sync after modifying the username");
    await sync_engine_and_validate_telem(engine, false);

    // The remote login should have the updated password.
    let newRec = collection.cleartext(guid);
    equal(
      newRec.username,
      "newuser",
      "Should update remote username for login"
    );

    foundLogins = await Services.logins.searchLoginsAsync({
      origin: "http://mozilla.com",
    });
    equal(foundLogins.length, 1);
    equal(foundLogins[0].syncCounter, 0);
    equal(foundLogins[0].everSynced, true);

    // Finally, remove the login. The server record should be marked as deleted.
    _("Remove the login");
    equal(collection.count(), 1);
    equal(await Services.logins.countLoginsAsync("", "", ""), 2);
    equal((await Services.logins.getAllLogins()).length, 2);
    ok(await engine._store.itemExists(guid));

    ok((await engine._store.getAllIDs())[guid]);

    await Services.logins.removeLoginAsync(foundLogins[0]);
    foundLogins = await Services.logins.searchLoginsAsync({
      origin: "http://mozilla.com",
    });
    equal(foundLogins.length, 0);

    changes = await engine.getChangedIDs();
    change = changes[guid];
    equal(Object.keys(changes).length, 1);
    equal(change.counter, 1);
    ok(change.deleted);

    _("Perform sync after removing the login");
    await sync_engine_and_validate_telem(engine, false);

    equal(collection.count(), 1);
    let payload = collection.payloads()[0];
    ok(payload.deleted);

    equal(Object.keys(await engine.getChangedIDs()), 0);

    // All of these should not include the deleted login. Only the FxA password should exist.
    equal(await Services.logins.countLoginsAsync("", "", ""), 1);
    equal((await Services.logins.getAllLogins()).length, 1);
    ok(!(await engine._store.itemExists(guid)));

    // getAllIDs includes deleted items but skips the FxA login.
    ok((await engine._store.getAllIDs())[guid]);
    let deletedLogin = await engine._store._getLoginFromGUID(guid);

    equal(deletedLogin.hostname, null, "deleted login hostname");
    equal(
      deletedLogin.formActionOrigin,
      null,
      "deleted login formActionOrigin"
    );
    equal(deletedLogin.formSubmitURL, null, "deleted login formSubmitURL");
    equal(deletedLogin.httpRealm, null, "deleted login httpRealm");
    equal(deletedLogin.username, null, "deleted login username");
    equal(deletedLogin.password, null, "deleted login password");
    equal(deletedLogin.usernameField, "", "deleted login usernameField");
    equal(deletedLogin.passwordField, "", "deleted login passwordField");
    equal(deletedLogin.unknownFields, null, "deleted login unknownFields");
    equal(deletedLogin.timeCreated, 0, "deleted login timeCreated");
    equal(deletedLogin.timeLastUsed, 0, "deleted login timeLastUsed");
    equal(deletedLogin.timesUsed, 0, "deleted login timesUsed");

    // These fields are not reset when the login is removed.
    equal(deletedLogin.guid, guid, "deleted login guid");
    equal(deletedLogin.everSynced, true, "deleted login everSynced");
    equal(deletedLogin.syncCounter, 0, "deleted login syncCounter");
    Assert.greater(
      deletedLogin.timePasswordChanged,
      0,
      "deleted login timePasswordChanged"
    );
  } finally {
    await engine._tracker.stop();

    await cleanup(engine, server);
  }
});

add_task(async function test_sync_incoming() {
  _("Test syncing incoming records");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let collection = server.user("foo").collection("passwords");

  const checkFields = [
    "formSubmitURL",
    "hostname",
    "httpRealm",
    "username",
    "password",
    "usernameField",
    "passwordField",
    "timeCreated",
  ];

  let guid1 = Utils.makeGUID();
  let details = {
    formSubmitURL: "https://www.example.com",
    hostname: "https://www.example.com",
    httpRealm: null,
    username: "camel",
    password: "llama",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Date.now(),
    timePasswordChanged: Date.now(),
  };

  try {
    // This test creates a remote server record and then verifies that the login
    // has been added locally after the sync occurs.
    _("Create remote login");
    collection.insertRecord(Object.assign({}, details, { id: guid1 }));

    _("Perform sync when remote login has been added");
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.example.com",
    });
    equal(logins.length, 1);

    equal(logins[0].QueryInterface(Ci.nsILoginMetaInfo).guid, guid1);
    checkFields.forEach(field => {
      equal(logins[0][field], details[field]);
    });
    equal(logins[0].timePasswordChanged, details.timePasswordChanged);
    equal(logins[0].syncCounter, 0);
    equal(logins[0].everSynced, true);

    // Modify the password within the remote record and then sync again.
    _("Perform sync when remote login's password has been modified");
    let newTime = Date.now();
    collection.updateRecord(
      guid1,
      cleartext => {
        cleartext.password = "alpaca";
      },
      newTime / 1000 + 10
    );

    await engine.setLastSync(newTime / 1000 - 30);
    await sync_engine_and_validate_telem(engine, false);

    logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.example.com",
    });
    equal(logins.length, 1);

    details.password = "alpaca";
    equal(logins[0].QueryInterface(Ci.nsILoginMetaInfo).guid, guid1);
    checkFields.forEach(field => {
      equal(logins[0][field], details[field]);
    });
    Assert.greater(logins[0].timePasswordChanged, details.timePasswordChanged);
    equal(logins[0].syncCounter, 0);
    equal(logins[0].everSynced, true);

    // Modify the username within the remote record and then sync again.
    _("Perform sync when remote login's username has been modified");
    newTime = Date.now();
    collection.updateRecord(
      guid1,
      cleartext => {
        cleartext.username = "guanaco";
      },
      newTime / 1000 + 10
    );

    await engine.setLastSync(newTime / 1000 - 30);
    await sync_engine_and_validate_telem(engine, false);

    logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.example.com",
    });
    equal(logins.length, 1);

    details.username = "guanaco";
    equal(logins[0].QueryInterface(Ci.nsILoginMetaInfo).guid, guid1);
    checkFields.forEach(field => {
      equal(logins[0][field], details[field]);
    });
    Assert.greater(logins[0].timePasswordChanged, details.timePasswordChanged);
    equal(logins[0].syncCounter, 0);
    equal(logins[0].everSynced, true);

    // Mark the remote record as deleted and then sync again.
    _("Perform sync when remote login has been marked for deletion");
    newTime = Date.now();
    collection.updateRecord(
      guid1,
      cleartext => {
        cleartext.deleted = true;
      },
      newTime / 1000 + 10
    );

    await engine.setLastSync(newTime / 1000 - 30);
    await sync_engine_and_validate_telem(engine, false);

    logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.example.com",
    });
    equal(logins.length, 0);
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_sync_incoming_deleted() {
  _("Test syncing incoming deleted records");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let collection = server.user("foo").collection("passwords");

  let guid1 = Utils.makeGUID();
  let details2 = {
    formSubmitURL: "https://www.example.org",
    hostname: "https://www.example.org",
    httpRealm: null,
    username: "capybara",
    password: "beaver",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Date.now(),
    timePasswordChanged: Date.now(),
    deleted: true,
  };

  try {
    // This test creates a remote server record that has been deleted
    // and then verifies that the login is not imported locally.
    _("Create remote login");
    collection.insertRecord(Object.assign({}, details2, { id: guid1 }));

    _("Perform sync when remote login has been deleted");
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.example.com",
    });
    equal(logins.length, 0);
    ok(!(await engine._store.getAllIDs())[guid1]);
    ok(!(await engine._store.itemExists(guid1)));
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_sync_incoming_deleted_localchanged_remotenewer() {
  _(
    "Test syncing incoming deleted records where the local login has been changed but the remote record is newer"
  );

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let collection = server.user("foo").collection("passwords");

  let loginInfo = new LoginInfo(
    "http://mozilla.com",
    "http://mozilla.com",
    null,
    "kangaroo",
    "kaola",
    "username",
    "password"
  );
  let login = await Services.logins.addLoginAsync(loginInfo);
  let guid = login.QueryInterface(Ci.nsILoginMetaInfo).guid;

  try {
    _("Perform sync on new login");
    await sync_engine_and_validate_telem(engine, false);

    let foundLogins = await Services.logins.searchLoginsAsync({
      origin: "http://mozilla.com",
    });
    foundLogins[0].password = "wallaby";
    await Services.logins.modifyLoginAsync(login, foundLogins[0]);

    // Use a time in the future to ensure that the remote record is newer.
    collection.updateRecord(
      guid,
      cleartext => {
        cleartext.deleted = true;
      },
      Date.now() / 1000 + 1000
    );

    _(
      "Perform sync when remote login has been deleted and local login has been changed"
    );
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://mozilla.com",
    });
    equal(logins.length, 0);
    ok(await engine._store.getAllIDs());
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_sync_incoming_deleted_localchanged_localnewer() {
  _(
    "Test syncing incoming deleted records where the local login has been changed but the local record is newer"
  );

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let collection = server.user("foo").collection("passwords");

  let loginInfo = new LoginInfo(
    "http://www.mozilla.com",
    "http://www.mozilla.com",
    null,
    "lion",
    "tiger",
    "username",
    "password"
  );
  let login = await Services.logins.addLoginAsync(loginInfo);
  let guid = login.QueryInterface(Ci.nsILoginMetaInfo).guid;

  try {
    _("Perform sync on new login");
    await sync_engine_and_validate_telem(engine, false);

    let foundLogins = await Services.logins.searchLoginsAsync({
      origin: "http://www.mozilla.com",
    });
    foundLogins[0].password = "cheetah";
    await Services.logins.modifyLoginAsync(login, foundLogins[0]);

    // Use a time in the past to ensure that the local record is newer.
    collection.updateRecord(
      guid,
      cleartext => {
        cleartext.deleted = true;
      },
      Date.now() / 1000 - 1000
    );

    _(
      "Perform sync when remote login has been deleted and local login has been changed"
    );
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "http://www.mozilla.com",
    });
    equal(logins.length, 1);
    equal(logins[0].password, "cheetah");
    equal(logins[0].syncCounter, 0);
    equal(logins[0].everSynced, true);
    ok(await engine._store.getAllIDs());
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_sync_incoming_no_formactionorigin() {
  _("Test syncing incoming a record where there is no formActionOrigin");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let collection = server.user("foo").collection("passwords");

  const checkFields = [
    "formSubmitURL",
    "hostname",
    "httpRealm",
    "username",
    "password",
    "usernameField",
    "passwordField",
    "timeCreated",
  ];

  let guid1 = Utils.makeGUID();
  let details = {
    formSubmitURL: "",
    hostname: "https://www.example.com",
    httpRealm: null,
    username: "rabbit",
    password: "squirrel",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Date.now(),
    timePasswordChanged: Date.now(),
  };

  try {
    // This test creates a remote server record and then verifies that the login
    // has been added locally after the sync occurs.
    _("Create remote login");
    collection.insertRecord(Object.assign({}, details, { id: guid1 }));

    _("Perform sync when remote login has been added");
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.example.com",
      formActionOrigin: "",
    });
    equal(logins.length, 1);

    equal(logins[0].QueryInterface(Ci.nsILoginMetaInfo).guid, guid1);
    checkFields.forEach(field => {
      equal(logins[0][field], details[field]);
    });
    equal(logins[0].timePasswordChanged, details.timePasswordChanged);
    equal(logins[0].syncCounter, 0);
    equal(logins[0].everSynced, true);
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_password_dupe() {
  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("passwords");

  let guid1 = Utils.makeGUID();
  let rec1 = new LoginRec("passwords", guid1);
  let guid2 = Utils.makeGUID();
  let cleartext = {
    formSubmitURL: "https://www.example.com",
    hostname: "https://www.example.com",
    httpRealm: null,
    username: "foo",
    password: "bar",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Math.round(Date.now()),
    timePasswordChanged: Math.round(Date.now()),
  };
  rec1.cleartext = cleartext;

  _("Create remote record with same details and guid1");
  collection.insert(guid1, encryptPayload(rec1.cleartext));

  _("Create remote record with guid2");
  collection.insert(guid2, encryptPayload(cleartext));

  _("Create local record with same details and guid1");
  await engine._store.create(rec1);

  try {
    _("Perform sync");
    await sync_engine_and_validate_telem(engine, true);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.example.com",
    });

    equal(logins.length, 1);
    equal(logins[0].QueryInterface(Ci.nsILoginMetaInfo).guid, guid2);
    equal(null, collection.payload(guid1));
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_updated_null_password_sync() {
  _("Ensure updated null login username is converted to a string");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("passwords");

  let guid1 = Utils.makeGUID();
  let guid2 = Utils.makeGUID();
  let remoteDetails = {
    formSubmitURL: "https://www.nullupdateexample.com",
    hostname: "https://www.nullupdateexample.com",
    httpRealm: null,
    username: null,
    password: "bar",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Date.now(),
    timePasswordChanged: Date.now(),
  };
  let localDetails = {
    formSubmitURL: "https://www.nullupdateexample.com",
    hostname: "https://www.nullupdateexample.com",
    httpRealm: null,
    username: "foo",
    password: "foobar",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Date.now(),
    timePasswordChanged: Date.now(),
  };

  _("Create remote record with same details and guid1");
  collection.insertRecord(Object.assign({}, remoteDetails, { id: guid1 }));

  try {
    _("Create local updated login with null password");
    await engine._store.update(Object.assign({}, localDetails, { id: guid2 }));

    _("Perform sync");
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.nullupdateexample.com",
    });

    equal(logins.length, 1);
    equal(logins[0].QueryInterface(Ci.nsILoginMetaInfo).guid, guid1);
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_updated_undefined_password_sync() {
  _("Ensure updated undefined login username is converted to a string");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("passwords");

  let guid1 = Utils.makeGUID();
  let guid2 = Utils.makeGUID();
  let remoteDetails = {
    formSubmitURL: "https://www.undefinedupdateexample.com",
    hostname: "https://www.undefinedupdateexample.com",
    httpRealm: null,
    username: undefined,
    password: "bar",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Date.now(),
    timePasswordChanged: Date.now(),
  };
  let localDetails = {
    formSubmitURL: "https://www.undefinedupdateexample.com",
    hostname: "https://www.undefinedupdateexample.com",
    httpRealm: null,
    username: "foo",
    password: "foobar",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Date.now(),
    timePasswordChanged: Date.now(),
  };

  _("Create remote record with same details and guid1");
  collection.insertRecord(Object.assign({}, remoteDetails, { id: guid1 }));

  try {
    _("Create local updated login with undefined password");
    await engine._store.update(Object.assign({}, localDetails, { id: guid2 }));

    _("Perform sync");
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.undefinedupdateexample.com",
    });

    equal(logins.length, 1);
    equal(logins[0].QueryInterface(Ci.nsILoginMetaInfo).guid, guid1);
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_new_null_password_sync() {
  _("Ensure new null login username is converted to a string");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let guid1 = Utils.makeGUID();
  let rec1 = new LoginRec("passwords", guid1);
  rec1.cleartext = {
    formSubmitURL: "https://www.example.com",
    hostname: "https://www.example.com",
    httpRealm: null,
    username: null,
    password: "bar",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Date.now(),
    timePasswordChanged: Date.now(),
  };

  try {
    _("Create local login with null password");
    await engine._store.create(rec1);

    _("Perform sync");
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.example.com",
    });

    equal(logins.length, 1);
    notEqual(logins[0].QueryInterface(Ci.nsILoginMetaInfo).username, null);
    notEqual(logins[0].QueryInterface(Ci.nsILoginMetaInfo).username, undefined);
    equal(logins[0].QueryInterface(Ci.nsILoginMetaInfo).username, "");
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_new_undefined_password_sync() {
  _("Ensure new undefined login username is converted to a string");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let guid1 = Utils.makeGUID();
  let rec1 = new LoginRec("passwords", guid1);
  rec1.cleartext = {
    formSubmitURL: "https://www.example.com",
    hostname: "https://www.example.com",
    httpRealm: null,
    username: undefined,
    password: "bar",
    usernameField: "username-field",
    passwordField: "password-field",
    timeCreated: Date.now(),
    timePasswordChanged: Date.now(),
  };

  try {
    _("Create local login with undefined password");
    await engine._store.create(rec1);

    _("Perform sync");
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://www.example.com",
    });

    equal(logins.length, 1);
    notEqual(logins[0].QueryInterface(Ci.nsILoginMetaInfo).username, null);
    notEqual(logins[0].QueryInterface(Ci.nsILoginMetaInfo).username, undefined);
    equal(logins[0].QueryInterface(Ci.nsILoginMetaInfo).username, "");
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_sync_password_validation() {
  // This test isn't in test_password_validator to avoid duplicating cleanup.
  _("Ensure that if a password validation happens, it ends up in the ping");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  Svc.PrefBranch.setIntPref("engine.passwords.validation.interval", 0);
  Svc.PrefBranch.setIntPref(
    "engine.passwords.validation.percentageChance",
    100
  );
  Svc.PrefBranch.setIntPref("engine.passwords.validation.maxRecords", -1);
  Svc.PrefBranch.setBoolPref("engine.passwords.validation.enabled", true);

  try {
    let ping = await wait_for_ping(() => Service.sync());

    let engineInfo = ping.engines.find(e => e.name == "passwords");
    ok(engineInfo, "Engine should be in ping");

    let validation = engineInfo.validation;
    ok(validation, "Engine should have validation info");
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_roundtrip_unknown_fields() {
  _(
    "Testing that unknown fields from other clients get roundtripped back to server"
  );

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("passwords");

  enableValidationPrefs();

  _("Add login with older password change time to replace during first sync");
  let oldLogin;
  {
    let login = new LoginInfo(
      "https://mozilla.com",
      "",
      null,
      "us3r",
      "0ldpa55",
      "",
      ""
    );
    await Services.logins.addLoginAsync(login);

    let props = new PropertyBag();
    let localPasswordChangeTime = Math.round(
      Date.now() - 1 * 60 * 60 * 24 * 1000
    );
    props.setProperty("timePasswordChanged", localPasswordChangeTime);
    await Services.logins.modifyLoginAsync(login, props);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://mozilla.com",
    });
    equal(logins.length, 1, "Should find old login in login manager");
    oldLogin = logins[0].QueryInterface(Ci.nsILoginMetaInfo);
    equal(oldLogin.timePasswordChanged, localPasswordChangeTime);

    let rec = new LoginRec("passwords", oldLogin.guid);
    rec.hostname = oldLogin.origin;
    rec.formSubmitURL = oldLogin.formActionOrigin;
    rec.httpRealm = oldLogin.httpRealm;
    rec.username = oldLogin.username;
    // Change the password and bump the password change time to ensure we prefer
    // the remote one during reconciliation.
    rec.password = "n3wpa55";
    rec.usernameField = oldLogin.usernameField;
    rec.passwordField = oldLogin.usernameField;
    rec.timeCreated = oldLogin.timeCreated;
    rec.timePasswordChanged = Math.round(Date.now());

    // pretend other clients have some snazzy new fields
    // we don't quite understand yet
    rec.cleartext.someStrField = "I am a str";
    rec.cleartext.someObjField = { newField: "I am a new field" };
    collection.insert(oldLogin.guid, encryptPayload(rec.cleartext));
  }

  await engine._tracker.stop();

  try {
    await sync_engine_and_validate_telem(engine, false);

    let logins = await Services.logins.searchLoginsAsync({
      origin: "https://mozilla.com",
    });
    equal(
      logins[0].password,
      "n3wpa55",
      "Should update local password for older login"
    );
    let expectedUnknowns = JSON.stringify({
      someStrField: "I am a str",
      someObjField: { newField: "I am a new field" },
    });
    // Check that the local record has all unknown fields properly
    // stringified
    equal(logins[0].unknownFields, expectedUnknowns);

    // Check that the server has the unknown fields unfurled and on the
    // top-level record
    let serverRec = collection.cleartext(oldLogin.guid);
    equal(serverRec.someStrField, "I am a str");
    equal(serverRec.someObjField.newField, "I am a new field");
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_new_passwords_from_csv() {
  _("Test syncing records imported from a csv file");

  let engine = Service.engineManager.get("passwords");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let collection = server.user("foo").collection("passwords");

  engine._tracker.start();

  let data = [
    {
      hostname: "https://example.com",
      url: "https://example.com/path",
      username: "exampleuser",
      password: "examplepassword",
    },
    {
      hostname: "https://mozilla.org",
      url: "https://mozilla.org",
      username: "mozillauser",
      password: "mozillapassword",
    },
    {
      hostname: "https://www.example.org",
      url: "https://www.example.org/example1/example2",
      username: "person",
      password: "mypassword",
    },
  ];

  let csvData = ["url,username,login_password"];
  for (let row of data) {
    csvData.push(row.url + "," + row.username + "," + row.password);
  }

  let csvFile = FileTestUtils.getTempFile(`firefox_logins.csv`);
  await IOUtils.writeUTF8(csvFile.path, csvData.join("\r\n"));

  await LoginCSVImport.importFromCSV(csvFile.path);

  equal(
    engine._tracker.score,
    SCORE_INCREMENT_XLARGE,
    "Should only get one update notification for import"
  );

  _("Ensure that the csv import is correct");
  for (let item of data) {
    let foundLogins = await Services.logins.searchLoginsAsync({
      origin: item.hostname,
    });
    equal(foundLogins.length, 1);
    equal(foundLogins[0].syncCounter, 1);
    equal(foundLogins[0].everSynced, false);
    equal(foundLogins[0].username, item.username);
    equal(foundLogins[0].password, item.password);
  }

  _("Perform sync after modifying the password");
  await sync_engine_and_validate_telem(engine, false);

  _("Verify that the sync counter and status are updated");
  for (let item of data) {
    let foundLogins = await Services.logins.searchLoginsAsync({
      origin: item.hostname,
    });
    equal(foundLogins.length, 1);
    equal(foundLogins[0].syncCounter, 0);
    equal(foundLogins[0].everSynced, true);
    equal(foundLogins[0].username, item.username);
    equal(foundLogins[0].password, item.password);
    item.guid = foundLogins[0].guid;
  }

  equal(Object.keys(await engine.getChangedIDs()), 0);
  equal(collection.count(), 3);

  for (let item of data) {
    // The remote login should have the imported username and password.
    let newRec = collection.cleartext(item.guid);
    equal(newRec.username, item.username);
    equal(newRec.password, item.password);
  }
});
