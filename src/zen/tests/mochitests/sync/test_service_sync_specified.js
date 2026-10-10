/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

let syncedEngines = [];

function SteamEngine() {
  SyncEngine.call(this, "Steam", Service);
}
SteamEngine.prototype = {
  async _sync() {
    syncedEngines.push(this.name);
  },
};
Object.setPrototypeOf(SteamEngine.prototype, SyncEngine.prototype);

function StirlingEngine() {
  SyncEngine.call(this, "Stirling", Service);
}
StirlingEngine.prototype = {
  async _sync() {
    syncedEngines.push(this.name);
  },
};
Object.setPrototypeOf(StirlingEngine.prototype, SteamEngine.prototype);

// Tracking info/collections.
var collectionsHelper = track_collections_helper();
var upd = collectionsHelper.with_updated_collection;

function sync_httpd_setup(handlers) {
  handlers["/1.1/johndoe/info/collections"] = collectionsHelper.handler;
  delete collectionsHelper.collections.crypto;
  delete collectionsHelper.collections.meta;

  let cr = new ServerWBO("keys");
  handlers["/1.1/johndoe/storage/crypto/keys"] = upd("crypto", cr.handler());

  let cl = new ServerCollection();
  handlers["/1.1/johndoe/storage/clients"] = upd("clients", cl.handler());

  return httpd_setup(handlers);
}

async function setUp() {
  syncedEngines = [];
  let engine = Service.engineManager.get("steam");
  engine.enabled = true;
  engine.syncPriority = 1;

  engine = Service.engineManager.get("stirling");
  engine.enabled = true;
  engine.syncPriority = 2;

  let server = sync_httpd_setup({
    "/1.1/johndoe/storage/meta/global": new ServerWBO("global", {}).handler(),
  });
  await SyncTestingInfrastructure(server, "johndoe", "ilovejane");
  return server;
}

add_task(async function setup() {
  await Service.engineManager.clear();
  validate_all_future_pings();

  await Service.engineManager.register(SteamEngine);
  await Service.engineManager.register(StirlingEngine);
});

add_task(async function test_noEngines() {
  enableValidationPrefs();

  _("Test: An empty array of engines to sync does nothing.");
  let server = await setUp();

  try {
    _("Sync with no engines specified.");
    await Service.sync({ engines: [] });
    deepEqual(syncedEngines, [], "no engines were synced");
  } finally {
    await Service.startOver();
    await promiseStopServer(server);
  }
});

add_task(async function test_oneEngine() {
  enableValidationPrefs();

  _("Test: Only one engine is synced.");
  let server = await setUp();

  try {
    _("Sync with 1 engine specified.");
    await Service.sync({ engines: ["steam"] });
    deepEqual(syncedEngines, ["steam"]);
  } finally {
    await Service.startOver();
    await promiseStopServer(server);
  }
});

add_task(async function test_bothEnginesSpecified() {
  enableValidationPrefs();

  _("Test: All engines are synced when specified in the correct order (1).");
  let server = await setUp();

  try {
    _("Sync with both engines specified.");
    await Service.sync({ engines: ["steam", "stirling"] });
    deepEqual(syncedEngines, ["steam", "stirling"]);
  } finally {
    await Service.startOver();
    await promiseStopServer(server);
  }
});

add_task(async function test_bothEnginesSpecified() {
  enableValidationPrefs();

  _("Test: All engines are synced when specified in the correct order (2).");
  let server = await setUp();

  try {
    _("Sync with both engines specified.");
    await Service.sync({ engines: ["stirling", "steam"] });
    deepEqual(syncedEngines, ["stirling", "steam"]);
  } finally {
    await Service.startOver();
    await promiseStopServer(server);
  }
});

add_task(async function test_bothEnginesDefault() {
  enableValidationPrefs();

  _("Test: All engines are synced when nothing is specified.");
  let server = await setUp();

  try {
    await Service.sync();
    deepEqual(syncedEngines, ["steam", "stirling"]);
  } finally {
    await Service.startOver();
    await promiseStopServer(server);
  }
});
