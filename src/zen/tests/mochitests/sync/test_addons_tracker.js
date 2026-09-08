/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

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

Services.prefs.setBoolPref("extensions.experiments.enabled", true);

Svc.PrefBranch.setBoolPref("engine.addons", true);

let reconciler;
let tracker;

const addon1ID = "addon1@tests.mozilla.org";

const ADDONS = {
  test_addon1: {
    manifest: {
      browser_specific_settings: { gecko: { id: addon1ID } },
    },
  },
};

const XPIS = {};

async function cleanup() {
  tracker.stop();

  tracker.resetScore();
  await tracker.clearChangedIDs();

  reconciler._addons = {};
  reconciler._changes = [];
  await reconciler.saveState();
}

add_task(async function setup() {
  await AddonTestUtils.promiseStartupManager();
  for (let [name, data] of Object.entries(ADDONS)) {
    XPIS[name] = AddonTestUtils.createTempWebExtensionFile(data);
  }
  await Service.engineManager.register(AddonsEngine);
  let engine = Service.engineManager.get("addons");
  reconciler = engine._reconciler;
  tracker = engine._tracker;

  await cleanup();
});

add_task(async function test_empty() {
  _("Verify the tracker is empty to start with.");

  Assert.equal(0, Object.keys(await tracker.getChangedIDs()).length);
  Assert.equal(0, tracker.score);

  await cleanup();
});

add_task(async function test_not_tracking() {
  _("Ensures the tracker doesn't do anything when it isn't tracking.");

  let addon = await installAddon(XPIS.test_addon1, reconciler);
  await uninstallAddon(addon, reconciler);

  Assert.equal(0, Object.keys(await tracker.getChangedIDs()).length);
  Assert.equal(0, tracker.score);

  await cleanup();
});

add_task(async function test_track_install() {
  _("Ensure that installing an add-on notifies tracker.");

  reconciler.startListening();

  tracker.start();

  Assert.equal(0, tracker.score);
  let addon = await installAddon(XPIS.test_addon1, reconciler);
  let changed = await tracker.getChangedIDs();

  Assert.equal(1, Object.keys(changed).length);
  Assert.ok(addon.syncGUID in changed);
  Assert.equal(SCORE_INCREMENT_XLARGE, tracker.score);

  await uninstallAddon(addon, reconciler);
  await cleanup();
});

add_task(async function test_track_uninstall() {
  _("Ensure that uninstalling an add-on notifies tracker.");

  reconciler.startListening();

  let addon = await installAddon(XPIS.test_addon1, reconciler);
  let guid = addon.syncGUID;
  Assert.equal(0, tracker.score);

  tracker.start();

  await uninstallAddon(addon, reconciler);
  let changed = await tracker.getChangedIDs();
  Assert.equal(1, Object.keys(changed).length);
  Assert.ok(guid in changed);
  Assert.equal(SCORE_INCREMENT_XLARGE, tracker.score);

  await cleanup();
});

add_task(async function test_track_user_disable() {
  _("Ensure that tracker sees disabling of add-on");

  reconciler.startListening();

  let addon = await installAddon(XPIS.test_addon1, reconciler);
  Assert.ok(!addon.userDisabled);
  Assert.ok(!addon.appDisabled);
  Assert.ok(addon.isActive);

  tracker.start();
  Assert.equal(0, tracker.score);

  _("Disabling add-on");
  await addon.disable();
  await reconciler.queueCaller.promiseCallsComplete();

  let changed = await tracker.getChangedIDs();
  Assert.equal(1, Object.keys(changed).length);
  Assert.ok(addon.syncGUID in changed);
  Assert.equal(SCORE_INCREMENT_XLARGE, tracker.score);

  await uninstallAddon(addon, reconciler);
  await cleanup();
});

add_task(async function test_track_enable() {
  _("Ensure that enabling a disabled add-on notifies tracker.");

  reconciler.startListening();

  let addon = await installAddon(XPIS.test_addon1, reconciler);
  await addon.disable();
  await Async.promiseYield();

  Assert.equal(0, tracker.score);

  tracker.start();
  await addon.enable();
  await Async.promiseYield();
  await reconciler.queueCaller.promiseCallsComplete();

  let changed = await tracker.getChangedIDs();
  Assert.equal(1, Object.keys(changed).length);
  Assert.ok(addon.syncGUID in changed);
  Assert.equal(SCORE_INCREMENT_XLARGE, tracker.score);

  await uninstallAddon(addon, reconciler);
  await cleanup();
});
