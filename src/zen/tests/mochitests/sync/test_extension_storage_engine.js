/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  Service: "resource://services-sync/service.sys.mjs",
  extensionStorageSync: "resource://gre/modules/ExtensionStorageSync.sys.mjs",
});

const { ExtensionStorageEngineBridge, ExtensionStorageEngineKinto } =
  ChromeUtils.importESModule(
    "resource://services-sync/engines/extension-storage.sys.mjs"
  );

Services.prefs.setStringPref("webextensions.storage.sync.log.level", "debug");

add_task(async function test_switching_between_kinto_and_bridged() {
  function assertUsingKinto(message) {
    let kintoEngine = Service.engineManager.get("extension-storage");
    Assert.ok(kintoEngine instanceof ExtensionStorageEngineKinto, message);
  }
  function assertUsingBridged(message) {
    let bridgedEngine = Service.engineManager.get("extension-storage");
    Assert.ok(bridgedEngine instanceof ExtensionStorageEngineBridge, message);
  }

  let isUsingKinto = Services.prefs.getBoolPref(
    "webextensions.storage.sync.kinto",
    false
  );
  if (isUsingKinto) {
    assertUsingKinto("Should use Kinto engine before flipping pref");
  } else {
    assertUsingBridged("Should use bridged engine before flipping pref");
  }

  _("Flip pref");
  Services.prefs.setBoolPref("webextensions.storage.sync.kinto", !isUsingKinto);
  await Service.engineManager.switchAlternatives();

  if (isUsingKinto) {
    assertUsingBridged("Should use bridged engine after flipping pref");
  } else {
    assertUsingKinto("Should use Kinto engine after flipping pref");
  }

  _("Clean up");
  Services.prefs.clearUserPref("webextensions.storage.sync.kinto");
  await Service.engineManager.switchAlternatives();
});

add_task(async function test_enable() {
  const PREF = "services.sync.engine.extension-storage.force";

  let addonsEngine = Service.engineManager.get("addons");
  let extensionStorageEngine = Service.engineManager.get("extension-storage");

  try {
    Assert.ok(
      addonsEngine.enabled,
      "Add-ons engine should be enabled by default"
    );
    Assert.ok(
      extensionStorageEngine.enabled,
      "Extension storage engine should be enabled by default"
    );

    addonsEngine.enabled = false;
    Assert.ok(
      !extensionStorageEngine.enabled,
      "Disabling add-ons should disable extension storage"
    );

    extensionStorageEngine.enabled = true;
    Assert.ok(
      !extensionStorageEngine.enabled,
      "Enabling extension storage without override pref shouldn't work"
    );

    Services.prefs.setBoolPref(PREF, true);
    Assert.ok(
      extensionStorageEngine.enabled,
      "Setting override pref should enable extension storage"
    );

    extensionStorageEngine.enabled = false;
    Assert.ok(
      !extensionStorageEngine.enabled,
      "Disabling extension storage engine with override pref should work"
    );

    extensionStorageEngine.enabled = true;
    Assert.ok(
      extensionStorageEngine.enabled,
      "Enabling extension storage with override pref should work"
    );
  } finally {
    addonsEngine.enabled = true;
    Services.prefs.clearUserPref(PREF);
  }
});

add_task(async function test_notifyPendingChanges() {
  let engine = new ExtensionStorageEngineBridge(Service);
  await engine.initialize();

  let extension = { id: "ext-1" };
  let expectedChange = {
    a: "b",
    c: "d",
  };

  let lastSync = 0;
  let syncID = Utils.makeGUID();
  let error = null;
  engine._rustStore = {
    getSyncedChanges() {
      if (error) {
        throw new Error(error.message);
      } else {
        return [
          { extId: extension.id, changes: JSON.stringify(expectedChange) },
        ];
      }
    },
  };

  engine._bridge = {
    ensureCurrentSyncId(id) {
      if (syncID != id) {
        syncID = id;
        lastSync = 0;
      }
      return id;
    },
    resetSyncId() {
      return syncID;
    },
    syncStarted() {},
    lastSync() {
      return lastSync;
    },
    setLastSync(lastSyncMillis) {
      lastSync = lastSyncMillis;
    },
    apply() {
      return [];
    },
    setUploaded(_modified, _ids) {},
    syncFinished() {},
  };

  let server = await serverForFoo(engine);

  let actualChanges = [];
  let listener = changes => actualChanges.push(changes);
  extensionStorageSync.addOnChangedListener(extension, listener);

  try {
    await SyncTestingInfrastructure(server);

    info("Sync engine; notify about changes");
    await sync_engine_and_validate_telem(engine, false);
    deepEqual(
      actualChanges,
      [expectedChange],
      "Should notify about changes during sync"
    );

    error = new Error("oops!");
    actualChanges = [];
    await sync_engine_and_validate_telem(engine, false);
    deepEqual(
      actualChanges,
      [],
      "Should finish syncing even if notifying about changes fails"
    );
  } finally {
    extensionStorageSync.removeOnChangedListener(extension, listener);
    await promiseStopServer(server);
    await engine.finalize();
  }
});

// It's difficult to know what to test - there's already tests for the bridged
// engine etc - so we just try and check that this engine conforms to the
// mozIBridgedSyncEngine interface guarantees.
add_task(async function test_engine() {
  // Forcibly set the bridged engine in the engine manager. the reason we do
  // this, unlike the other tests where we just create the engine, is so that
  // telemetry can get at the engine's `overrideTelemetryName`, which it gets
  // through the engine manager.
  await Service.engineManager.unregister("extension-storage");
  await Service.engineManager.register(ExtensionStorageEngineBridge);
  let engine = Service.engineManager.get("extension-storage");
  Assert.equal(engine.version, 1);

  Assert.deepEqual(await engine.getSyncID(), null);
  await engine.resetLocalSyncID();
  Assert.notEqual(await engine.getSyncID(), null);

  Assert.equal(await engine.getLastSync(), 0);
  // lastSync is seconds on this side of the world, but milli-seconds on the other.
  await engine.setLastSync(1234.567);
  // should have 2 digit precision.
  Assert.equal(await engine.getLastSync(), 1234.57);
  await engine.setLastSync(0);

  // Set some data.
  await extensionStorageSync.set({ id: "ext-2" }, { ext_2_key: "ext_2_value" });
  // Now do a sync with out regular test server.
  let server = await serverForFoo(engine);
  try {
    await SyncTestingInfrastructure(server);

    info("Add server records");
    let foo = server.user("foo");
    let collection = foo.collection("extension-storage");
    let now = new_timestamp();

    collection.insert(
      "fakeguid0000",
      encryptPayload({
        id: "fakeguid0000",
        extId: "ext-1",
        data: JSON.stringify({ foo: "bar" }),
      }),
      now
    );

    info("Sync the engine");

    let ping = await sync_engine_and_validate_telem(engine, false);
    Assert.ok(ping.engines.find(e => e.name == "rust-webext-storage"));
    Assert.equal(
      ping.engines.find(e => e.name == "extension-storage"),
      null
    );

    // We should have applied the data from the existing collection record.
    Assert.deepEqual(await extensionStorageSync.get({ id: "ext-1" }, null), {
      foo: "bar",
    });

    // should now be 2 records on the server.
    let payloads = collection.payloads();
    Assert.equal(payloads.length, 2);
    // find the new one we wrote.
    let newPayload =
      payloads[0].id == "fakeguid0000" ? payloads[1] : payloads[0];
    Assert.equal(newPayload.data, `{"ext_2_key":"ext_2_value"}`);
    // should have updated the timestamp.
    greater(await engine.getLastSync(), 0, "Should update last sync time");
  } finally {
    await promiseStopServer(server);
    await engine.finalize();
  }
});
