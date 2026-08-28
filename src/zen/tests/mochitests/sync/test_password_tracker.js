/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { PasswordEngine, LoginRec } = ChromeUtils.importESModule(
  "resource://services-sync/engines/passwords.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

let engine;
let store;
let tracker;

add_task(async function setup() {
  await Service.engineManager.register(PasswordEngine);
  engine = Service.engineManager.get("passwords");
  store = engine._store;
  tracker = engine._tracker;
});

add_task(async function test_tracking() {
  let recordNum = 0;

  _("Verify we've got an empty tracker to work with.");
  let changes = await engine.getChangedIDs();
  do_check_empty(changes);

  let exceptionHappened = false;
  try {
    await tracker.getChangedIDs();
  } catch (ex) {
    exceptionHappened = true;
  }
  ok(exceptionHappened, "tracker does not keep track of changes");

  async function createPassword() {
    _("RECORD NUM: " + recordNum);
    let record = new LoginRec("passwords", "GUID" + recordNum);
    record.cleartext = {
      id: "GUID" + recordNum,
      hostname: "http://foo.bar.com",
      formSubmitURL: "http://foo.bar.com",
      username: "john" + recordNum,
      password: "smith",
      usernameField: "username",
      passwordField: "password",
    };
    recordNum++;
    let login = store._nsLoginInfoFromRecord(record);
    await Services.logins.addLoginAsync(login);
    await tracker.asyncObserver.promiseObserversComplete();
  }

  try {
    tracker.start();
    await createPassword();
    changes = await engine.getChangedIDs();
    do_check_attribute_count(changes, 1);
    Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE);
    Assert.equal(changes.GUID0.counter, 1);
    Assert.ok(typeof changes.GUID0.modified, "number");

    _("Starting twice won't do any harm.");
    tracker.start();
    await createPassword();
    changes = await engine.getChangedIDs();
    do_check_attribute_count(changes, 2);
    Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE * 2);
    Assert.equal(changes.GUID0.counter, 1);
    Assert.equal(changes.GUID1.counter, 1);

    // The tracker doesn't keep track of changes, so 3 changes
    // should still be returned, but the score is not updated.
    _("Let's stop tracking again.");
    tracker.resetScore();
    await tracker.stop();
    await createPassword();
    changes = await engine.getChangedIDs();
    do_check_attribute_count(changes, 3);
    Assert.equal(tracker.score, 0);
    Assert.equal(changes.GUID0.counter, 1);
    Assert.equal(changes.GUID1.counter, 1);
    Assert.equal(changes.GUID2.counter, 1);

    _("Stopping twice won't do any harm.");
    await tracker.stop();
    await createPassword();
    changes = await engine.getChangedIDs();
    do_check_attribute_count(changes, 4);
    Assert.equal(tracker.score, 0);
  } finally {
    _("Clean up.");
    await store.wipe();
    tracker.resetScore();
    await tracker.stop();
  }
});

add_task(async function test_onWipe() {
  _("Verify we've got an empty tracker to work with.");
  const changes = await engine.getChangedIDs();
  do_check_empty(changes);
  Assert.equal(tracker.score, 0);

  try {
    _("A store wipe should increment the score");
    tracker.start();
    await store.wipe();
    await tracker.asyncObserver.promiseObserversComplete();

    Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE);
  } finally {
    tracker.resetScore();
    await tracker.stop();
  }
});

add_task(async function test_removeAllLogins() {
  let recordNum = 0;
  _("Verify that all tracked logins are removed.");

  // Perform this test twice, the first time where a sync is not performed
  // between adding and removing items and the second time where a sync is
  // performed. In the former case, the logins will just be deleted because
  // they have never been synced, so they won't be detected as changes. In
  // the latter case, the logins have been synced so they will be marked for
  // deletion.
  for (let syncBeforeRemove of [false, true]) {
    async function createPassword() {
      _("RECORD NUM: " + recordNum);
      let record = new LoginRec("passwords", "GUID" + recordNum);
      record.cleartext = {
        id: "GUID" + recordNum,
        hostname: "http://foo.bar.com",
        formSubmitURL: "http://foo.bar.com",
        username: "john" + recordNum,
        password: "smith",
        usernameField: "username",
        passwordField: "password",
      };
      recordNum++;
      let login = store._nsLoginInfoFromRecord(record);
      await Services.logins.addLoginAsync(login);

      await tracker.asyncObserver.promiseObserversComplete();
    }
    try {
      _("Tell tracker to start tracking changes");
      tracker.start();
      await createPassword();
      await createPassword();
      let changes = await engine.getChangedIDs();
      do_check_attribute_count(changes, 2);
      Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE * 2);

      if (syncBeforeRemove) {
        let logins = await Services.logins.getAllLogins();
        for (let login of logins) {
          engine.markSynced(login.guid);
        }
      }

      _("Tell sync to remove all logins");
      await Services.logins.removeAllUserFacingLoginsAsync();
      await tracker.asyncObserver.promiseObserversComplete();
      changes = await engine.getChangedIDs();
      do_check_attribute_count(changes, syncBeforeRemove ? 2 : 0);
      Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE * 5);

      let deletedGuids = await engine._store.getAllIDs();
      if (syncBeforeRemove) {
        for (let guid in deletedGuids) {
          let deletedLogin = await engine._store._getLoginFromGUID(guid);

          Assert.equal(deletedLogin.hostname, null, "deleted login hostname");
          Assert.equal(
            deletedLogin.formActionOrigin,
            null,
            "deleted login formActionOrigin"
          );
          Assert.equal(
            deletedLogin.formSubmitURL,
            null,
            "deleted login formSubmitURL"
          );
          Assert.equal(deletedLogin.httpRealm, null, "deleted login httpRealm");
          Assert.equal(deletedLogin.username, null, "deleted login username");
          Assert.equal(deletedLogin.password, null, "deleted login password");
          Assert.equal(
            deletedLogin.usernameField,
            "",
            "deleted login usernameField"
          );
          Assert.equal(
            deletedLogin.passwordField,
            "",
            "deleted login passwordField"
          );
          Assert.equal(
            deletedLogin.unknownFields,
            null,
            "deleted login unknownFields"
          );
          Assert.equal(
            deletedLogin.timeCreated,
            0,
            "deleted login timeCreated"
          );
          Assert.equal(
            deletedLogin.timeLastUsed,
            0,
            "deleted login timeLastUsed"
          );
          Assert.equal(deletedLogin.timesUsed, 0, "deleted login timesUsed");

          // These fields are not reset when the login is removed.
          Assert.ok(deletedLogin.guid.startsWith("GUID"), "deleted login guid");
          Assert.equal(
            deletedLogin.everSynced,
            true,
            "deleted login everSynced"
          );
          Assert.equal(
            deletedLogin.syncCounter,
            2,
            "deleted login syncCounter"
          );
          Assert.greater(
            deletedLogin.timePasswordChanged,
            0,
            "deleted login timePasswordChanged"
          );
        }
      } else {
        Assert.equal(
          Object.keys(deletedGuids).length,
          0,
          "no logins remain after removeAllUserFacingLogins"
        );
      }
    } finally {
      _("Clean up.");
      await store.wipe();
      tracker.resetScore();
      await tracker.stop();
    }
  }
});
