/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Bug 2057164: after the user cancels the Primary Password prompt, a background
 * sync must not keep re-prompting on every subsequent sync. When the Primary
 * Password is locked, the Rust-backed RustPasswordEngine must skip syncing
 * *without* prompting and record the master-password-locked login state, so the
 * scheduler backs off - matching the behaviour of the legacy PasswordEngine.
 *
 * RustPasswordEngine.initialize() reaches into the active Rust store for its
 * bridge, so getActiveStore() is stubbed to avoid depending on the Rust backend.
 */

"use strict";

/* import-globals-from head_errorhandler_common.js */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { RustPasswordEngine } = ChromeUtils.importESModule(
  "resource://services-sync/engines/passwords.sys.mjs"
);
const { LoginManagerStorage } = ChromeUtils.importESModule(
  "resource://passwordmgr/passwordstorage.sys.mjs"
);

const PREF_ACTIVE = "signon.storage.rust.active";

// `isLoggedIn` is a non-configurable getter on the real Services.logins, so swap
// in a minimal stand-in for the duration of the check and restore it afterwards.
function stubLoggedIn(value) {
  let oldLogins = Services.logins;
  Services.logins = { isLoggedIn: value };
  return () => {
    Services.logins = oldLogins;
  };
}

let engine;
let sandbox;
let superSync;

add_task(async function setup() {
  await Service.promiseInitialized;
  Services.prefs.clearUserPref(PREF_ACTIVE);

  sandbox = sinon.createSandbox();
  sandbox.stub(LoginManagerStorage, "getActiveStore").returns({
    bridgedEngine: async () => ({}),
  });
  // Stub the inherited real sync so a call is observable (and wouldn't hit the
  // network); RustPasswordEngine._sync() delegates to it when unlocked.
  superSync = sandbox.stub(SyncEngine.prototype, "_sync").resolves();

  Services.prefs.setBoolPref(PREF_ACTIVE, true);
  await Service.engineManager.switchAlternatives();
  engine = Service.engineManager.get("passwords");
  Assert.ok(
    engine instanceof RustPasswordEngine,
    "the Rust-backed engine is active"
  );
});

add_task(async function test_skips_and_records_lock_when_locked() {
  superSync.resetHistory();
  let restore = stubLoggedIn(false);
  Service.status.login = LOGIN_SUCCEEDED;

  try {
    await engine._sync();

    Assert.ok(
      superSync.notCalled,
      "the engine skips the real sync (which would prompt) while locked"
    );
    Assert.equal(
      Service.status.login,
      MASTER_PASSWORD_LOCKED,
      "a locked Primary Password records the master-password-locked login state"
    );
  } finally {
    restore();
  }
});

add_task(async function test_syncs_normally_when_unlocked() {
  superSync.resetHistory();
  let restore = stubLoggedIn(true);
  Service.status.login = LOGIN_SUCCEEDED;

  try {
    await engine._sync();

    Assert.ok(
      superSync.calledOnce,
      "the engine performs a normal sync when the Primary Password is unlocked"
    );
    Assert.equal(
      Service.status.login,
      LOGIN_SUCCEEDED,
      "an unlocked Primary Password leaves the login state untouched"
    );
  } finally {
    restore();
  }
});

add_task(async function teardown() {
  Services.prefs.clearUserPref(PREF_ACTIVE);
  await Service.engineManager.switchAlternatives();
  sandbox.restore();
  Service.status.resetSync();
});
