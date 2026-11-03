/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

Services.prefs.setBoolPref("webextensions.storage.sync.kinto", true);

const { ExtensionStorageEngineKinto: ExtensionStorageEngine } =
  ChromeUtils.importESModule(
    "resource://services-sync/engines/extension-storage.sys.mjs"
  );
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { extensionStorageSyncKinto: extensionStorageSync } =
  ChromeUtils.importESModule(
    "resource://gre/modules/ExtensionStorageSyncKinto.sys.mjs"
  );

let engine;

function mock(options) {
  let calls = [];
  let ret = function () {
    calls.push(arguments);
    return options.returns;
  };
  let proto = {
    get calls() {
      return calls;
    },
  };
  Object.setPrototypeOf(proto, Function.prototype);
  Object.setPrototypeOf(ret, proto);
  return ret;
}

function setSkipChance(v) {
  Services.prefs.setIntPref(
    "services.sync.extension-storage.skipPercentageChance",
    v
  );
}

add_task(async function setup() {
  await Service.engineManager.register(ExtensionStorageEngine);
  engine = Service.engineManager.get("extension-storage");
  do_get_profile(); // so we can use FxAccounts
  loadWebExtensionTestFunctions();
  setSkipChance(0);
});

add_task(async function test_calling_sync_calls__sync() {
  let oldSync = ExtensionStorageEngine.prototype._sync;
  let syncMock = (ExtensionStorageEngine.prototype._sync = mock({
    returns: true,
  }));
  try {
    // I wanted to call the main sync entry point for the entire
    // package, but that fails because it tries to sync ClientEngine
    // first, which fails.
    await engine.sync();
  } finally {
    ExtensionStorageEngine.prototype._sync = oldSync;
  }
  equal(syncMock.calls.length, 1);
});

add_task(async function test_sync_skip() {
  try {
    // Do a few times to ensure we aren't getting "lucky" WRT Math.random()
    for (let i = 0; i < 10; ++i) {
      setSkipChance(100);
      engine._tracker._score = 0;
      ok(
        !engine.shouldSkipSync("user"),
        "Should allow explicitly requested syncs"
      );
      ok(!engine.shouldSkipSync("startup"), "Should allow startup syncs");
      ok(
        engine.shouldSkipSync("schedule"),
        "Should skip scheduled syncs if skipProbability is 100"
      );
      engine._tracker._score = MULTI_DEVICE_THRESHOLD;
      ok(
        !engine.shouldSkipSync("schedule"),
        "should allow scheduled syncs if tracker score is high"
      );
      engine._tracker._score = 0;
      setSkipChance(0);
      ok(
        !engine.shouldSkipSync("schedule"),
        "Should allow scheduled syncs if probability is 0"
      );
    }
  } finally {
    engine._tracker._score = 0;
    setSkipChance(0);
  }
});

add_task(async function test_calling_wipeClient_calls_clearAll() {
  let oldClearAll = extensionStorageSync.clearAll;
  let clearMock = (extensionStorageSync.clearAll = mock({
    returns: Promise.resolve(),
  }));
  try {
    await engine.wipeClient();
  } finally {
    extensionStorageSync.clearAll = oldClearAll;
  }
  equal(clearMock.calls.length, 1);
});

add_task(async function test_calling_sync_calls_ext_storage_sync() {
  const extension = { id: "my-extension" };
  let oldSync = extensionStorageSync.syncAll;
  let syncMock = (extensionStorageSync.syncAll = mock({
    returns: Promise.resolve(),
  }));
  try {
    await withContext(async function (context) {
      // Set something so that everyone knows that we're using storage.sync
      await extensionStorageSync.set(extension, { a: "b" }, context);
      let ping = await sync_engine_and_validate_telem(engine, false);
      Assert.ok(ping.engines.find(e => e.name == "extension-storage"));
      Assert.equal(
        ping.engines.find(e => e.name == "rust-webext-storage"),
        null
      );
    });
  } finally {
    extensionStorageSync.syncAll = oldSync;
  }
  Assert.greaterOrEqual(syncMock.calls.length, 1);
});
