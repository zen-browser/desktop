/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Flipping `signon.storage.rust.active` at runtime must switch the registered
 * "passwords" engine between the legacy PasswordEngine and the Rust-backed
 * RustPasswordEngine. The generic alternative machinery is covered by
 * test_enginemanager.js; this guards the service.sys.mjs wiring against a
 * key/name mismatch that would leave switchAlternatives() unable to swap the
 * real engine.
 *
 * RustPasswordEngine.initialize() reaches into the active Rust store for its
 * bridge, so getActiveStore() is stubbed to avoid depending on the Rust backend.
 */

"use strict";

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { PasswordEngine, RustPasswordEngine } = ChromeUtils.importESModule(
  "resource://services-sync/engines/passwords.sys.mjs"
);
const { LoginManagerStorage } = ChromeUtils.importESModule(
  "resource://passwordmgr/passwordstorage.sys.mjs"
);

const PREF_ACTIVE = "signon.storage.rust.active";

add_task(async function test_pref_flip_switches_engine() {
  await Service.promiseInitialized;
  Services.prefs.clearUserPref(PREF_ACTIVE);

  let sandbox = sinon.createSandbox();
  // RustPasswordEngine.initialize() does `getActiveStore().bridgedEngine()`.
  sandbox.stub(LoginManagerStorage, "getActiveStore").returns({
    bridgedEngine: async () => ({}),
  });

  try {
    Assert.ok(
      Service.engineManager.get("passwords") instanceof PasswordEngine,
      "the legacy JS engine is used while the pref is off"
    );

    Services.prefs.setBoolPref(PREF_ACTIVE, true);
    await Service.engineManager.switchAlternatives();
    Assert.ok(
      Service.engineManager.get("passwords") instanceof RustPasswordEngine,
      "turning the pref on switches to the Rust-backed engine"
    );

    Services.prefs.setBoolPref(PREF_ACTIVE, false);
    await Service.engineManager.switchAlternatives();
    Assert.ok(
      Service.engineManager.get("passwords") instanceof PasswordEngine,
      "turning the pref off switches back to the legacy JS engine"
    );
  } finally {
    Services.prefs.clearUserPref(PREF_ACTIVE);
    await Service.engineManager.switchAlternatives();
    sandbox.restore();
  }
});
