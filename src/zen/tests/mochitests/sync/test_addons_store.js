/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { AddonsEngine } = ChromeUtils.importESModule(
  "resource://services-sync/engines/addons.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { SyncedRecordsTelemetry } = ChromeUtils.importESModule(
  "resource://services-sync/telemetry.sys.mjs"
);

const HTTP_PORT = 8888;

Services.prefs.setStringPref(
  "extensions.getAddons.get.url",
  "http://localhost:8888/search/guid:%IDS%"
);
// Note that all compat-override URLs currently 404, but that's OK - the main
// thing is to avoid us hitting the real AMO.
Services.prefs.setStringPref(
  "extensions.getAddons.compatOverides.url",
  "http://localhost:8888/compat-override/guid:%IDS%"
);
Services.prefs.setBoolPref("extensions.install.requireSecureOrigin", false);
Services.prefs.setBoolPref("extensions.checkUpdateSecurity", false);

AddonTestUtils.init(this);
AddonTestUtils.createAppInfo(
  "xpcshell@tests.mozilla.org",
  "XPCShell",
  "1",
  "1.9.2"
);
AddonTestUtils.overrideCertDB();

Services.prefs.setBoolPref("extensions.experiments.enabled", true);

const SYSTEM_ADDON_ID = "system1@tests.mozilla.org";
const THEME_ID = "synctheme@tests.mozilla.org";

add_setup(async function setupBuiltInAddon() {
  // Enable SCOPE_APPLICATION for builtin testing.  Default in tests is only SCOPE_PROFILE.
  let scopes = AddonManager.SCOPE_PROFILE | AddonManager.SCOPE_APPLICATION;
  Services.prefs.setIntPref("extensions.enabledScopes", scopes);

  const addon_version = "1.0";
  const addon_res_url_path = "test-builtin-addon";

  let xpi = await AddonTestUtils.createTempWebExtensionFile({
    manifest: {
      version: addon_version,
      browser_specific_settings: { gecko: { id: SYSTEM_ADDON_ID } },
    },
  });

  // The built-in location requires a resource: URL that maps to a
  // jar: or file: URL.  This would typically be something bundled
  // into omni.ja but for testing we just use a temp file.
  let base = Services.io.newURI(`jar:file:${xpi.path}!/`);
  let resProto = Services.io
    .getProtocolHandler("resource")
    .QueryInterface(Ci.nsIResProtocolHandler);
  resProto.setSubstitution(addon_res_url_path, base);
  let builtins = [
    {
      addon_id: SYSTEM_ADDON_ID,
      addon_version,
      res_url: `resource://${addon_res_url_path}/`,
    },
  ];
  await AddonTestUtils.overrideBuiltIns({ builtins });
  await AddonTestUtils.promiseStartupManager();
});

const ID1 = "addon1@tests.mozilla.org";
const ID2 = "addon2@tests.mozilla.org";
const ID3 = "addon3@tests.mozilla.org";

const ADDONS = {
  test_addon1: {
    manifest: {
      browser_specific_settings: {
        gecko: {
          id: ID1,
          update_url: "http://example.com/data/test_install.json",
        },
      },
    },
  },

  test_addon2: {
    manifest: {
      browser_specific_settings: { gecko: { id: ID2 } },
    },
  },

  test_addon3: {
    manifest: {
      browser_specific_settings: {
        gecko: {
          id: ID3,
          strict_max_version: "0",
        },
      },
    },
  },
};

const SEARCH_RESULT = {
  next: null,
  results: [
    {
      name: "Test Extension",
      type: "extension",
      guid: "addon1@tests.mozilla.org",
      current_version: {
        version: "1.0",
        files: [
          {
            platform: "all",
            size: 485,
            url: "http://localhost:8888/addon1.xpi",
          },
        ],
      },
      last_updated: "2018-10-27T04:12:00.826Z",
    },
  ],
};

const MISSING_SEARCH_RESULT = {
  next: null,
  results: [
    {
      name: "Test",
      type: "extension",
      guid: "missing-xpi@tests.mozilla.org",
      current_version: {
        version: "1.0",
        files: [
          {
            platform: "all",
            size: 123,
            url: "http://localhost:8888/THIS_DOES_NOT_EXIST.xpi",
          },
        ],
      },
    },
  ],
};

const AMOSIGNED_SHA1_SEARCH_RESULT = {
  next: null,
  results: [
    {
      name: "Test Extension",
      type: "extension",
      guid: "amosigned-xpi@tests.mozilla.org",
      current_version: {
        version: "2.1",
        files: [
          {
            platform: "all",
            size: 4287,
            url: "http://localhost:8888/amosigned-sha1only.xpi",
          },
        ],
      },
      last_updated: "2024-03-21T16:00:06.640Z",
    },
  ],
};

const XPIS = {};
for (let [name, files] of Object.entries(ADDONS)) {
  XPIS[name] = AddonTestUtils.createTempWebExtensionFile(files);
}

let engine;
let store;
let reconciler;

const proxyService = Cc[
  "@mozilla.org/network/protocol-proxy-service;1"
].getService(Ci.nsIProtocolProxyService);

const proxyFilter = {
  proxyInfo: proxyService.newProxyInfo(
    "http",
    "localhost",
    HTTP_PORT,
    "",
    "",
    0,
    4096,
    null
  ),

  applyFilter(channel, defaultProxyInfo, callback) {
    if (channel.URI.host === "example.com") {
      callback.onProxyFilterResult(this.proxyInfo);
    } else {
      callback.onProxyFilterResult(defaultProxyInfo);
    }
  },
};

proxyService.registerChannelFilter(proxyFilter, 0);
registerCleanupFunction(() => {
  proxyService.unregisterChannelFilter(proxyFilter);
});

/**
 * Create a AddonsRec for this application with the fields specified.
 *
 * @param  id       Sync GUID of record
 * @param  addonId  ID of add-on
 * @param  enabled  Boolean whether record is enabled
 * @param  deleted  Boolean whether record was deleted
 */
function createRecordForThisApp(id, addonId, enabled, deleted) {
  return {
    id,
    addonID: addonId,
    enabled,
    deleted: !!deleted,
    applicationID: Services.appinfo.ID,
    source: "amo",
  };
}

function createAndStartHTTPServer(port) {
  try {
    let server = new HttpServer();

    server.registerPathHandler(
      "/search/guid:addon1%40tests.mozilla.org",
      (req, resp) => {
        resp.setHeader("Content-type", "application/json", true);
        resp.write(JSON.stringify(SEARCH_RESULT));
      }
    );
    server.registerPathHandler(
      "/search/guid:missing-xpi%40tests.mozilla.org",
      (req, resp) => {
        resp.setHeader("Content-type", "application/json", true);
        resp.write(JSON.stringify(MISSING_SEARCH_RESULT));
      }
    );
    server.registerFile("/addon1.xpi", XPIS.test_addon1);

    server.registerPathHandler(
      "/search/guid:amosigned-xpi%40tests.mozilla.org",
      (req, resp) => {
        resp.setHeader("Content-type", "application/json", true);
        resp.write(JSON.stringify(AMOSIGNED_SHA1_SEARCH_RESULT));
      }
    );
    server.registerFile(
      "/amosigned-sha1only.xpi",
      do_get_file("amosigned-sha1only.xpi")
    );

    server.start(port);

    return server;
  } catch (ex) {
    _("Got exception starting HTTP server on port " + port);
    _("Error: " + Log.exceptionStr(ex));
    do_throw(ex);
  }
  return null; /* not hit, but keeps eslint happy! */
}

// A helper function to ensure that the reconciler's current view of the addon
// is the same as the addon itself. If it's not, then the reconciler missed a
// change, and is likely to re-upload the addon next sync because of the change
// it missed.
async function checkReconcilerUpToDate(addon) {
  let stateBefore = Object.assign({}, store.reconciler.addons[addon.id]);
  await store.reconciler.rectifyStateFromAddon(addon);
  let stateAfter = store.reconciler.addons[addon.id];
  deepEqual(stateBefore, stateAfter);
}

add_setup(async function setup() {
  await Service.engineManager.register(AddonsEngine);
  engine = Service.engineManager.get("addons");
  store = engine._store;
  reconciler = engine._reconciler;

  reconciler.startListening();

  // Don't flush to disk in the middle of an event listener!
  // This causes test hangs on WinXP.
  reconciler._shouldPersist = false;
});

add_task(async function test_remove() {
  _("Ensure removing add-ons from deleted records works.");

  let addon = await installAddon(XPIS.test_addon1, reconciler);
  let record = createRecordForThisApp(addon.syncGUID, ID1, true, true);
  let countTelemetry = new SyncedRecordsTelemetry();
  let failed = await store.applyIncomingBatch([record], countTelemetry);
  Assert.equal(0, failed.length);
  Assert.equal(null, countTelemetry.failedReasons);
  Assert.equal(0, countTelemetry.incomingCounts.failed);

  let newAddon = await AddonManager.getAddonByID(ID1);
  Assert.equal(null, newAddon);
});

add_task(async function test_apply_enabled() {
  let countTelemetry = new SyncedRecordsTelemetry();
  _("Ensures that changes to the userEnabled flag apply.");

  let addon = await installAddon(XPIS.test_addon1, reconciler);
  Assert.ok(addon.isActive);
  Assert.ok(!addon.userDisabled);

  _("Ensure application of a disable record works as expected.");
  let records = [];
  records.push(createRecordForThisApp(addon.syncGUID, ID1, false, false));

  let [failed] = await Promise.all([
    store.applyIncomingBatch(records, countTelemetry),
    AddonTestUtils.promiseAddonEvent("onDisabled"),
  ]);
  Assert.equal(0, failed.length);
  Assert.equal(0, countTelemetry.incomingCounts.failed);
  addon = await AddonManager.getAddonByID(ID1);
  Assert.ok(addon.userDisabled);
  await checkReconcilerUpToDate(addon);
  records = [];

  _("Ensure enable record works as expected.");
  records.push(createRecordForThisApp(addon.syncGUID, ID1, true, false));
  [failed] = await Promise.all([
    store.applyIncomingBatch(records, countTelemetry),
    AddonTestUtils.promiseWebExtensionStartup(ID1),
  ]);
  Assert.equal(0, failed.length);
  Assert.equal(0, countTelemetry.incomingCounts.failed);
  addon = await AddonManager.getAddonByID(ID1);
  Assert.ok(!addon.userDisabled);
  await checkReconcilerUpToDate(addon);
  records = [];

  _("Ensure enabled state updates don't apply if the ignore pref is set.");
  records.push(createRecordForThisApp(addon.syncGUID, ID1, false, false));
  Svc.PrefBranch.setBoolPref("addons.ignoreUserEnabledChanges", true);
  failed = await store.applyIncomingBatch(records, countTelemetry);
  Assert.equal(0, failed.length);
  Assert.equal(0, countTelemetry.incomingCounts.failed);
  addon = await AddonManager.getAddonByID(ID1);
  Assert.ok(!addon.userDisabled);
  records = [];

  await uninstallAddon(addon, reconciler);
  Svc.PrefBranch.clearUserPref("addons.ignoreUserEnabledChanges");
});

add_task(async function test_apply_enabled_appDisabled() {
  _(
    "Ensures that changes to the userEnabled flag apply when the addon is appDisabled."
  );

  // this addon is appDisabled by default.
  let addon = await installAddon(XPIS.test_addon3);
  Assert.ok(addon.appDisabled);
  Assert.ok(!addon.isActive);
  Assert.ok(!addon.userDisabled);

  _("Ensure application of a disable record works as expected.");
  store.reconciler.pruneChangesBeforeDate(Date.now() + 10);
  store.reconciler._changes = [];
  let records = [];
  let countTelemetry = new SyncedRecordsTelemetry();
  records.push(createRecordForThisApp(addon.syncGUID, ID3, false, false));
  let failed = await store.applyIncomingBatch(records, countTelemetry);
  Assert.equal(0, failed.length);
  Assert.equal(0, countTelemetry.incomingCounts.failed);
  addon = await AddonManager.getAddonByID(ID3);
  Assert.ok(addon.userDisabled);
  await checkReconcilerUpToDate(addon);
  records = [];

  _("Ensure enable record works as expected.");
  records.push(createRecordForThisApp(addon.syncGUID, ID3, true, false));
  failed = await store.applyIncomingBatch(records, countTelemetry);
  Assert.equal(0, failed.length);
  Assert.equal(0, countTelemetry.incomingCounts.failed);
  addon = await AddonManager.getAddonByID(ID3);
  Assert.ok(!addon.userDisabled);
  await checkReconcilerUpToDate(addon);
  records = [];

  await uninstallAddon(addon, reconciler);
});

add_task(async function test_ignore_different_appid() {
  _(
    "Ensure that incoming records with a different application ID are ignored."
  );

  // We test by creating a record that should result in an update.
  let addon = await installAddon(XPIS.test_addon1, reconciler);
  Assert.ok(!addon.userDisabled);

  let record = createRecordForThisApp(addon.syncGUID, ID1, false, false);
  record.applicationID = "FAKE_ID";
  let countTelemetry = new SyncedRecordsTelemetry();
  let failed = await store.applyIncomingBatch([record], countTelemetry);
  Assert.equal(0, failed.length);

  let newAddon = await AddonManager.getAddonByID(ID1);
  Assert.ok(!newAddon.userDisabled);

  await uninstallAddon(addon, reconciler);
});

add_task(async function test_ignore_unknown_source() {
  _("Ensure incoming records with unknown source are ignored.");

  let addon = await installAddon(XPIS.test_addon1, reconciler);

  let record = createRecordForThisApp(addon.syncGUID, ID1, false, false);
  record.source = "DUMMY_SOURCE";
  let countTelemetry = new SyncedRecordsTelemetry();
  let failed = await store.applyIncomingBatch([record], countTelemetry);
  Assert.equal(0, failed.length);

  let newAddon = await AddonManager.getAddonByID(ID1);
  Assert.ok(!newAddon.userDisabled);

  await uninstallAddon(addon, reconciler);
});

add_task(async function test_apply_uninstall() {
  _("Ensures that uninstalling an add-on from a record works.");

  let addon = await installAddon(XPIS.test_addon1, reconciler);

  let records = [];
  let countTelemetry = new SyncedRecordsTelemetry();
  records.push(createRecordForThisApp(addon.syncGUID, ID1, true, true));
  let failed = await store.applyIncomingBatch(records, countTelemetry);
  Assert.equal(0, failed.length);
  Assert.equal(0, countTelemetry.incomingCounts.failed);

  addon = await AddonManager.getAddonByID(ID1);
  Assert.equal(null, addon);
});

add_task(async function test_addon_syncability() {
  _("Ensure isAddonSyncable functions properly.");

  Svc.PrefBranch.setStringPref(
    "addons.trustedSourceHostnames",
    "addons.mozilla.org,other.example.com"
  );

  Assert.ok(!(await store.isAddonSyncable(null)));

  let addon = await installAddon(XPIS.test_addon1, reconciler);
  Assert.ok(await store.isAddonSyncable(addon));

  let dummy = {};
  const KEYS = [
    "id",
    "syncGUID",
    "type",
    "scope",
    "foreignInstall",
    "isSyncable",
  ];
  for (let k of KEYS) {
    dummy[k] = addon[k];
  }

  Assert.ok(await store.isAddonSyncable(dummy));

  dummy.type = "UNSUPPORTED";
  Assert.ok(!(await store.isAddonSyncable(dummy)));
  dummy.type = addon.type;

  dummy.scope = 0;
  Assert.ok(!(await store.isAddonSyncable(dummy)));
  dummy.scope = addon.scope;

  dummy.isSyncable = false;
  Assert.ok(!(await store.isAddonSyncable(dummy)));
  dummy.isSyncable = addon.isSyncable;

  dummy.foreignInstall = true;
  Assert.ok(!(await store.isAddonSyncable(dummy)));
  dummy.foreignInstall = false;

  await uninstallAddon(addon, reconciler);

  Assert.ok(!store.isSourceURITrusted(null));

  let trusted = [
    "https://addons.mozilla.org/foo",
    "https://other.example.com/foo",
  ];

  let untrusted = [
    "http://addons.mozilla.org/foo", // non-https
    "ftps://addons.mozilla.org/foo", // non-https
    "https://untrusted.example.com/foo", // non-trusted hostname`
  ];

  for (let uri of trusted) {
    Assert.ok(store.isSourceURITrusted(Services.io.newURI(uri)));
  }

  for (let uri of untrusted) {
    Assert.ok(!store.isSourceURITrusted(Services.io.newURI(uri)));
  }

  Svc.PrefBranch.setStringPref("addons.trustedSourceHostnames", "");
  for (let uri of trusted) {
    Assert.ok(!store.isSourceURITrusted(Services.io.newURI(uri)));
  }

  Svc.PrefBranch.setStringPref(
    "addons.trustedSourceHostnames",
    "addons.mozilla.org"
  );
  Assert.ok(
    store.isSourceURITrusted(
      Services.io.newURI("https://addons.mozilla.org/foo")
    )
  );

  Svc.PrefBranch.clearUserPref("addons.trustedSourceHostnames");
});

add_task(async function test_get_all_ids() {
  _("Ensures that getAllIDs() returns an appropriate set.");

  _("Installing two addons.");
  // XXX - this test seems broken - at this point, before we've installed the
  // addons below, store.getAllIDs() returns all addons installed by previous
  // tests, even though those tests uninstalled the addon.
  // So if any tests above ever add a new addon ID, they are going to need to
  // be added here too.
  // Assert.equal(0, Object.keys(store.getAllIDs()).length);
  let addon1 = await installAddon(XPIS.test_addon1, reconciler);
  let addon2 = await installAddon(XPIS.test_addon2, reconciler);
  let addon3 = await installAddon(XPIS.test_addon3, reconciler);

  _("Ensure they're syncable.");
  Assert.ok(await store.isAddonSyncable(addon1));
  Assert.ok(await store.isAddonSyncable(addon2));
  Assert.ok(await store.isAddonSyncable(addon3));

  let ids = await store.getAllIDs();

  Assert.equal("object", typeof ids);
  Assert.equal(3, Object.keys(ids).length);
  Assert.ok(addon1.syncGUID in ids);
  Assert.ok(addon2.syncGUID in ids);
  Assert.ok(addon3.syncGUID in ids);

  await uninstallAddon(addon1, reconciler);
  await uninstallAddon(addon2, reconciler);
  await uninstallAddon(addon3, reconciler);
});

add_task(async function test_change_item_id() {
  _("Ensures that changeItemID() works properly.");

  let addon = await installAddon(XPIS.test_addon1, reconciler);

  let oldID = addon.syncGUID;
  let newID = Utils.makeGUID();

  await store.changeItemID(oldID, newID);

  let newAddon = await AddonManager.getAddonByID(ID1);
  Assert.notEqual(null, newAddon);
  Assert.equal(newID, newAddon.syncGUID);

  await uninstallAddon(newAddon, reconciler);
});

add_task(async function test_create() {
  _("Ensure creating/installing an add-on from a record works.");

  let server = createAndStartHTTPServer(HTTP_PORT);

  let guid = Utils.makeGUID();
  let record = createRecordForThisApp(guid, ID1, true, false);
  let countTelemetry = new SyncedRecordsTelemetry();
  let failed = await store.applyIncomingBatch([record], countTelemetry);
  Assert.equal(0, failed.length);

  let newAddon = await AddonManager.getAddonByID(ID1);
  Assert.notEqual(null, newAddon);
  Assert.equal(guid, newAddon.syncGUID);
  Assert.ok(!newAddon.userDisabled);

  await uninstallAddon(newAddon, reconciler);

  await promiseStopServer(server);
});

add_task(async function test_weak_signature_restrictions() {
  _("Ensure installing add-ons with a weak signature fails when restricted.");

  // Ensure restrictions on weak signatures are enabled (this should be removed when
  // the new behavior is riding the train).
  const resetWeakSignaturePref =
    AddonTestUtils.setWeakSignatureInstallAllowed(false);
  const server = createAndStartHTTPServer(HTTP_PORT);
  const ID_TEST_SHA1 = "amosigned-xpi@tests.mozilla.org";

  const guidKO = Utils.makeGUID();
  const guidOK = Utils.makeGUID();
  const recordKO = createRecordForThisApp(guidKO, ID_TEST_SHA1, true, false);
  const recordOK = createRecordForThisApp(guidOK, ID1, true, false);
  const countTelemetry = new SyncedRecordsTelemetry();

  let failed;

  const { messages } = await AddonTestUtils.promiseConsoleOutput(async () => {
    failed = await store.applyIncomingBatch(
      [recordKO, recordOK],
      countTelemetry
    );
  });

  Assert.equal(
    1,
    failed.length,
    "Expect only 1 on the two synced add-ons to fail"
  );

  resetWeakSignaturePref();

  let addonKO = await AddonManager.getAddonByID(ID_TEST_SHA1);
  Assert.equal(null, addonKO, `Expect ${ID_TEST_SHA1} to NOT be installed`);
  let addonOK = await AddonManager.getAddonByID(ID1);
  Assert.notEqual(null, addonOK, `Expect ${ID1} to be installed`);

  await uninstallAddon(addonOK, reconciler);
  await promiseStopServer(server);

  AddonTestUtils.checkMessages(messages, {
    expected: [
      {
        message:
          /Download of .*\/amosigned-sha1only.xpi failed: install rejected due to the package not including a strong cryptographic signature/,
      },
    ],
  });
});

add_task(async function test_create_missing_search() {
  _("Ensures that failed add-on searches are handled gracefully.");

  let server = createAndStartHTTPServer(HTTP_PORT);

  // The handler for this ID is not installed, so a search should 404.
  const id = "missing@tests.mozilla.org";
  let guid = Utils.makeGUID();
  let record = createRecordForThisApp(guid, id, true, false);
  let countTelemetry = new SyncedRecordsTelemetry();
  let failed = await store.applyIncomingBatch([record], countTelemetry);
  Assert.equal(1, failed.length);
  Assert.equal(guid, failed[0]);
  Assert.equal(
    countTelemetry.incomingCounts.failedReasons[0].name,
    "GET <URL> failed (status 404)"
  );
  Assert.equal(countTelemetry.incomingCounts.failedReasons[0].count, 1);

  let addon = await AddonManager.getAddonByID(id);
  Assert.equal(null, addon);

  await promiseStopServer(server);
});

add_task(async function test_create_bad_install() {
  _("Ensures that add-ons without a valid install are handled gracefully.");

  let server = createAndStartHTTPServer(HTTP_PORT);

  // The handler returns a search result but the XPI will 404.
  const id = "missing-xpi@tests.mozilla.org";
  let guid = Utils.makeGUID();
  let record = createRecordForThisApp(guid, id, true, false);
  let countTelemetry = new SyncedRecordsTelemetry();
  /* let failed = */ await store.applyIncomingBatch([record], countTelemetry);
  // This addon had no source URI so was skipped - but it's not treated as
  // failure.
  // XXX - this test isn't testing what we thought it was. Previously the addon
  // was not being installed due to requireSecureURL checking *before* we'd
  // attempted to get the XPI.
  // With requireSecureURL disabled we do see a download failure, but the addon
  // *does* get added to |failed|.
  // FTR: onDownloadFailed() is called with ERROR_NETWORK_FAILURE, so it's going
  // to be tricky to distinguish a 404 from other transient network errors
  // where we do want the addon to end up in |failed|.
  // This is being tracked in bug 1284778.
  // Assert.equal(0, failed.length);

  let addon = await AddonManager.getAddonByID(id);
  Assert.equal(null, addon);

  await promiseStopServer(server);
});

add_task(async function test_ignore_system() {
  _("Ensure we ignore system addons");
  // Our system addon should not appear in getAllIDs
  await engine._refreshReconcilerState();
  let num = 0;
  let ids = await store.getAllIDs();
  for (let guid in ids) {
    num += 1;
    let addon = reconciler.getAddonStateFromSyncGUID(guid);
    Assert.notEqual(addon.id, SYSTEM_ADDON_ID);
  }
  Assert.greater(num, 1, "should have seen at least one.");
});

add_task(async function test_incoming_system() {
  _("Ensure we handle incoming records that refer to a system addon");
  // eg, loop initially had a normal addon but it was then "promoted" to be a
  // system addon but wanted to keep the same ID. The server record exists due
  // to this.

  // before we start, ensure the system addon isn't disabled.
  Assert.ok(!(await AddonManager.getAddonByID(SYSTEM_ADDON_ID).userDisabled));

  // Now simulate an incoming record with the same ID as the system addon,
  // but flagged as disabled - it should not be applied.
  let server = createAndStartHTTPServer(HTTP_PORT);
  // We make the incoming record flag the system addon as disabled - it should
  // be ignored.
  let guid = Utils.makeGUID();
  let record = createRecordForThisApp(guid, SYSTEM_ADDON_ID, false, false);
  let countTelemetry = new SyncedRecordsTelemetry();
  let failed = await store.applyIncomingBatch([record], countTelemetry);
  Assert.equal(0, failed.length);

  // The system addon should still not be userDisabled.
  Assert.ok(!(await AddonManager.getAddonByID(SYSTEM_ADDON_ID).userDisabled));

  await promiseStopServer(server);
});

add_task(async function test_wipe() {
  _("Ensures that wiping causes add-ons to be uninstalled.");

  await installAddon(XPIS.test_addon1, reconciler);

  await store.wipe();

  let addon = await AddonManager.getAddonByID(ID1);
  Assert.equal(null, addon);
});

add_task(async function test_wipe_and_install() {
  _("Ensure wipe followed by install works.");

  // This tests the reset sync flow where remote data is replaced by local. The
  // receiving client will see a wipe followed by a record which should undo
  // the wipe.
  let installed = await installAddon(XPIS.test_addon1, reconciler);

  let record = createRecordForThisApp(installed.syncGUID, ID1, true, false);

  await store.wipe();

  let deleted = await AddonManager.getAddonByID(ID1);
  Assert.equal(null, deleted);

  // Re-applying the record can require re-fetching the XPI.
  let server = createAndStartHTTPServer(HTTP_PORT);

  await store.applyIncoming(record);

  let fetched = await AddonManager.getAddonByID(record.addonID);
  Assert.ok(!!fetched);

  // wipe again to we are left with a clean slate.
  await store.wipe();

  await promiseStopServer(server);
});

// STR for what this is testing:
// * Either:
//   * Install then remove an addon, then delete addons.json from the profile
//     or corrupt it (in which case the addon manager will remove it)
//   * Install then remove an addon while addon caching is disabled, then
//     re-enable addon caching.
// * Install the same addon in a different profile, sync it.
// * Sync this profile
// Before bug 1467904, the addon would fail to install because this profile
// has a copy of the addon in our addonsreconciler.json, but the addon manager
// does *not* have a copy in its cache, and repopulating that cache would not
// re-add it as the addon is no longer installed locally.
add_task(async function test_incoming_reconciled_but_not_cached() {
  _(
    "Ensure we handle incoming records our reconciler has but the addon cache does not"
  );

  // Make sure addon is not installed.
  let addon = await AddonManager.getAddonByID(ID1);
  Assert.equal(null, addon);

  Services.prefs.setBoolPref("extensions.getAddons.cache.enabled", false);

  addon = await installAddon(XPIS.test_addon1, reconciler);
  Assert.notEqual(await AddonManager.getAddonByID(ID1), null);
  await uninstallAddon(addon, reconciler);

  Services.prefs.setBoolPref("extensions.getAddons.cache.enabled", true);

  // now pretend it is incoming.
  let server = createAndStartHTTPServer(HTTP_PORT);
  let guid = Utils.makeGUID();
  let record = createRecordForThisApp(guid, ID1, true, false);
  let countTelemetry = new SyncedRecordsTelemetry();
  let failed = await store.applyIncomingBatch([record], countTelemetry);
  Assert.equal(0, failed.length);

  Assert.notEqual(await AddonManager.getAddonByID(ID1), null);

  await promiseStopServer(server);
});

// Helper for testing theme-specific addons
function makeThemeSearchResult(id) {
  return {
    next: null,
    results: [
      {
        name: "Sync Theme",
        type: "theme",
        guid: id,
        current_version: {
          version: "1.0",
          files: [
            {
              platform: "all",
              size: 1234,
              url: `http://localhost:${HTTP_PORT}/synctheme.xpi`,
            },
          ],
        },
        last_updated: "2025-03-01T00:00:00.000Z",
      },
    ],
  };
}

/**
 * Incoming theme add-on record should
 *   – install the theme
 *   – enable it immediately
 *   – clear the hand-off pref
 */
add_task(async function test_incoming_theme_gets_enabled() {
  const xpiTheme = AddonTestUtils.createTempWebExtensionFile({
    manifest: {
      manifest_version: 2,
      name: "Sync Theme",
      version: "1.0",
      applications: { gecko: { id: THEME_ID } },
      theme: { colors: { frame: "#000000", tab_background_text: "#ffffff" } },
    },
  });

  const server = createAndStartHTTPServer(HTTP_PORT);
  server.registerFile("/synctheme.xpi", xpiTheme);
  server.registerPathHandler(
    `/search/guid:${encodeURIComponent(THEME_ID)}`,
    (req, resp) => {
      resp.setHeader("Content-Type", "application/json", true);
      resp.write(JSON.stringify(makeThemeSearchResult(THEME_ID)));
    }
  );

  // Pretend Prefs‑engine has just synced a new activeThemeID
  Services.prefs.setStringPref("extensions.pendingActiveThemeID", THEME_ID);

  // Feed an add-on record into the Addons engine.
  const guid = Utils.makeGUID();
  const record = createRecordForThisApp(guid, THEME_ID, true, false);
  const telem = new SyncedRecordsTelemetry();

  const onStartup = AddonTestUtils.promiseWebExtensionStartup(THEME_ID);
  const failed = await store.applyIncomingBatch([record], telem);

  Assert.equal(0, failed.length, "No records should fail to apply");
  await onStartup;

  const theme = await AddonManager.getAddonByID(THEME_ID);
  Assert.ok(theme, "Theme is installed");
  Assert.ok(theme.isActive, "Theme is active");
  Assert.ok(!theme.userDisabled, "Theme is not user-disabled");

  Assert.equal(
    Services.prefs.getPrefType("extensions.pendingActiveThemeID"),
    Ci.nsIPrefBranch.PREF_INVALID,
    "Hand-off pref was cleared"
  );

  // Clean-up
  await uninstallAddon(theme, reconciler);
  await promiseStopServer(server);
});

// NOTE: The test above must be the last test run due to the addon cache
// being trashed. It is probably possible to fix that by running, eg,
// AddonRespository.backgroundUpdateCheck() to rebuild the cache, but that
// requires implementing more AMO functionality in our test server

add_task(async function cleanup() {
  // There's an xpcom-shutdown hook for this, but let's give this a shot.
  reconciler.stopListening();
});
