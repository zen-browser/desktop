/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { AddonsReconciler, CHANGE_INSTALLED, CHANGE_UNINSTALLED } =
  ChromeUtils.importESModule(
    "resource://services-sync/addonsreconciler.sys.mjs"
  );
const { AddonsEngine } = ChromeUtils.importESModule(
  "resource://services-sync/engines/addons.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

AddonTestUtils.init(this);
AddonTestUtils.createAppInfo(
  "xpcshell@tests.mozilla.org",
  "XPCShell",
  "1",
  "1.9.2"
);
AddonTestUtils.overrideCertDB();

const ADDON_ID = "addon1@tests.mozilla.org";
const XPI = AddonTestUtils.createTempWebExtensionFile({
  manifest: {
    name: "Test 1",
    description: "Test Description",
    browser_specific_settings: { gecko: { id: ADDON_ID } },
  },
});

function makeAddonsReconciler() {
  const log = Service.engineManager.get("addons")._log;
  const queueCaller = Async.asyncQueueCaller(log);
  return new AddonsReconciler(queueCaller);
}

add_task(async function setup() {
  await AddonTestUtils.promiseStartupManager();
  Svc.PrefBranch.setBoolPref("engine.addons", true);
  await Service.engineManager.register(AddonsEngine);
});

add_task(async function test_defaults() {
  _("Ensure new objects have reasonable defaults.");

  let reconciler = makeAddonsReconciler();
  await reconciler.ensureStateLoaded();

  Assert.ok(!reconciler._listening);
  Assert.equal("object", typeof reconciler.addons);
  Assert.equal(0, Object.keys(reconciler.addons).length);
  Assert.equal(0, reconciler._changes.length);
  Assert.equal(0, reconciler._listeners.length);
});

add_task(async function test_load_state_empty_file() {
  _("Ensure loading from a missing file results in defaults being set.");

  let reconciler = makeAddonsReconciler();
  await reconciler.ensureStateLoaded();

  let loaded = await reconciler.loadState();
  Assert.ok(!loaded);

  Assert.equal("object", typeof reconciler.addons);
  Assert.equal(0, Object.keys(reconciler.addons).length);
  Assert.equal(0, reconciler._changes.length);
});

add_task(async function test_install_detection() {
  _("Ensure that add-on installation results in appropriate side-effects.");

  let reconciler = makeAddonsReconciler();
  await reconciler.ensureStateLoaded();
  reconciler.startListening();

  let before = new Date();
  let addon = await installAddon(XPI);
  let after = new Date();

  Assert.equal(1, Object.keys(reconciler.addons).length);
  Assert.ok(addon.id in reconciler.addons);
  let record = reconciler.addons[ADDON_ID];

  const KEYS = [
    "id",
    "guid",
    "enabled",
    "installed",
    "modified",
    "type",
    "scope",
    "foreignInstall",
  ];
  for (let key of KEYS) {
    Assert.ok(key in record);
    Assert.notEqual(null, record[key]);
  }

  Assert.equal(addon.id, record.id);
  Assert.equal(addon.syncGUID, record.guid);
  Assert.ok(record.enabled);
  Assert.ok(record.installed);
  Assert.ok(record.modified >= before && record.modified <= after);
  Assert.equal("extension", record.type);
  Assert.ok(!record.foreignInstall);

  Assert.equal(1, reconciler._changes.length);
  let change = reconciler._changes[0];
  Assert.ok(change[0] >= before && change[1] <= after);
  Assert.equal(CHANGE_INSTALLED, change[1]);
  Assert.equal(addon.id, change[2]);

  await uninstallAddon(addon);
});

add_task(async function test_uninstall_detection() {
  _("Ensure that add-on uninstallation results in appropriate side-effects.");

  let reconciler = makeAddonsReconciler();
  await reconciler.ensureStateLoaded();
  reconciler.startListening();

  reconciler._addons = {};
  reconciler._changes = [];

  let addon = await installAddon(XPI);
  let id = addon.id;

  reconciler._changes = [];
  await uninstallAddon(addon, reconciler);

  Assert.equal(1, Object.keys(reconciler.addons).length);
  Assert.ok(id in reconciler.addons);

  let record = reconciler.addons[id];
  Assert.ok(!record.installed);

  Assert.equal(1, reconciler._changes.length);
  let change = reconciler._changes[0];
  Assert.equal(CHANGE_UNINSTALLED, change[1]);
  Assert.equal(id, change[2]);
});

add_task(async function test_load_state_future_version() {
  _("Ensure loading a file from a future version results in no data loaded.");

  const FILENAME = "TEST_LOAD_STATE_FUTURE_VERSION";

  let reconciler = makeAddonsReconciler();
  await reconciler.ensureStateLoaded();

  // First we populate our new file.
  let state = { version: 100, addons: { foo: {} }, changes: [[1, 1, "foo"]] };

  // jsonSave() expects an object with ._log, so we give it a reconciler
  // instance.
  await Utils.jsonSave(FILENAME, reconciler, state);

  let loaded = await reconciler.loadState(FILENAME);
  Assert.ok(!loaded);

  Assert.equal("object", typeof reconciler.addons);
  Assert.equal(0, Object.keys(reconciler.addons).length);
  Assert.equal(0, reconciler._changes.length);
});

add_task(async function test_prune_changes_before_date() {
  _("Ensure that old changes are pruned properly.");

  let reconciler = makeAddonsReconciler();
  await reconciler.ensureStateLoaded();
  reconciler._changes = [];

  let now = new Date();
  const HOUR_MS = 1000 * 60 * 60;

  _("Ensure pruning an empty changes array works.");
  reconciler.pruneChangesBeforeDate(now);
  Assert.equal(0, reconciler._changes.length);

  let old = new Date(now.getTime() - HOUR_MS);
  let young = new Date(now.getTime() - 1000);
  reconciler._changes.push([old, CHANGE_INSTALLED, "foo"]);
  reconciler._changes.push([young, CHANGE_INSTALLED, "bar"]);
  Assert.equal(2, reconciler._changes.length);

  _("Ensure pruning with an old time won't delete anything.");
  let threshold = new Date(old.getTime() - 1);
  reconciler.pruneChangesBeforeDate(threshold);
  Assert.equal(2, reconciler._changes.length);

  _("Ensure pruning a single item works.");
  threshold = new Date(young.getTime() - 1000);
  reconciler.pruneChangesBeforeDate(threshold);
  Assert.equal(1, reconciler._changes.length);
  Assert.notEqual(undefined, reconciler._changes[0]);
  Assert.equal(young, reconciler._changes[0][0]);
  Assert.equal("bar", reconciler._changes[0][2]);

  _("Ensure pruning all changes works.");
  reconciler._changes.push([old, CHANGE_INSTALLED, "foo"]);
  reconciler.pruneChangesBeforeDate(now);
  Assert.equal(0, reconciler._changes.length);
});
