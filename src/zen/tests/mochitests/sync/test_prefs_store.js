/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);
PromiseTestUtils.allowMatchingRejectionsGlobally(
  /Unable to arm timer, the object has been finalized\./
);
PromiseTestUtils.allowMatchingRejectionsGlobally(
  /IOUtils\.profileBeforeChange getter: IOUtils: profileBeforeChange phase has already finished/
);

const { PrefRec, getPrefsGUIDForTest } = ChromeUtils.importESModule(
  "resource://services-sync/engines/prefs.sys.mjs"
);
const PREFS_GUID = getPrefsGUIDForTest();
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

const DEFAULT_THEME_ID = "default-theme@mozilla.org";
const COMPACT_THEME_ID = "firefox-compact-light@mozilla.org";

AddonTestUtils.init(this);
AddonTestUtils.createAppInfo(
  "xpcshell@tests.mozilla.org",
  "XPCShell",
  "1",
  "1.9.2"
);
AddonTestUtils.overrideCertDB();

let prefsWithUserValue = new Set();
add_setup(function record_prefsWithUserValue() {
  for (const pref of Services.prefs.getChildList("")) {
    if (Services.prefs.prefHasUserValue(pref)) {
      prefsWithUserValue.add(pref);
    }
  }
});

function clearValues() {
  for (const pref of Services.prefs.getChildList("")) {
    if (!prefsWithUserValue.has(pref)) {
      Services.prefs.clearUserPref(pref);
    }
  }
}

add_task(async function run_test() {
  _("Test fixtures.");
  // Part of this test ensures the default theme, via the preference
  // extensions.activeThemeID, is synced correctly - so we do a little
  // addons initialization to allow this to work.

  // Enable application scopes to ensure the builtin theme is going to
  // be installed as part of the the addon manager startup.
  Services.prefs.setIntPref(
    "extensions.enabledScopes",
    AddonManager.SCOPE_APPLICATION
  );
  await AddonTestUtils.promiseStartupManager();

  // Install another built-in theme.
  await AddonManager.installBuiltinAddon("resource://builtin-themes/light/");

  const defaultThemeAddon = await AddonManager.getAddonByID(DEFAULT_THEME_ID);
  ok(defaultThemeAddon, "Got an addon wrapper for the default theme");

  const otherThemeAddon = await AddonManager.getAddonByID(COMPACT_THEME_ID);
  ok(otherThemeAddon, "Got an addon wrapper for the compact theme");

  await otherThemeAddon.enable();

  // read our custom prefs file before doing anything.
  Services.prefs.readDefaultPrefsFromFile(
    do_get_file("prefs_test_prefs_store.js")
  );

  let engine = Service.engineManager.get("prefs");
  let store = engine._store;
  try {
    _("Expect the compact light theme to be active");
    Assert.strictEqual(
      Services.prefs.getStringPref("extensions.activeThemeID"),
      COMPACT_THEME_ID
    );

    _("The GUID corresponds to XUL App ID.");
    let allIDs = await store.getAllIDs();
    let ids = Object.keys(allIDs);
    Assert.equal(ids.length, 1);
    Assert.equal(ids[0], PREFS_GUID);
    Assert.ok(allIDs[PREFS_GUID]);

    Assert.ok(await store.itemExists(PREFS_GUID));
    Assert.equal(false, await store.itemExists("random-gibberish"));

    _("Unknown prefs record is created as deleted.");
    let record = await store.createRecord("random-gibberish", "prefs");
    Assert.ok(record.deleted);

    _("Prefs record contains only prefs that should be synced.");
    record = await store.createRecord(PREFS_GUID, "prefs");
    Assert.strictEqual(record.value["testing.int"], 123);
    Assert.strictEqual(record.value["testing.string"], "ohai");
    Assert.strictEqual(record.value["testing.bool"], true);
    // non-existing prefs get null as the value
    Assert.strictEqual(record.value["testing.nonexistent"], null);
    // as do prefs that have a default value.
    Assert.strictEqual(record.value["testing.default"], null);
    Assert.strictEqual(record.value["testing.turned.off"], undefined);
    Assert.strictEqual(record.value["testing.not.turned.on"], undefined);

    _("Prefs record contains the correct control prefs.");
    // All control prefs which have the default value and where the pref
    // itself is synced should appear, but with null as the value.
    Assert.strictEqual(
      record.value["services.sync.prefs.sync.testing.int"],
      null
    );
    Assert.strictEqual(
      record.value["services.sync.prefs.sync.testing.string"],
      null
    );
    Assert.strictEqual(
      record.value["services.sync.prefs.sync.testing.bool"],
      null
    );
    Assert.strictEqual(
      record.value["services.sync.prefs.sync.testing.dont.change"],
      null
    );
    Assert.strictEqual(
      record.value["services.sync.prefs.sync.testing.nonexistent"],
      null
    );
    Assert.strictEqual(
      record.value["services.sync.prefs.sync.testing.default"],
      null
    );

    // but this control pref has a non-default value so that value is synced.
    Assert.strictEqual(
      record.value["services.sync.prefs.sync.testing.turned.off"],
      false
    );

    _("Unsyncable prefs are treated correctly.");
    // Prefs we consider unsyncable (since they are URLs that won't be stable on
    // another firefox) shouldn't be included - neither the value nor the
    // control pref should appear.
    Assert.strictEqual(record.value["testing.unsynced.url"], undefined);
    Assert.strictEqual(
      record.value["services.sync.prefs.sync.testing.unsynced.url"],
      undefined
    );
    // Other URLs with user prefs should be synced, though.
    Assert.strictEqual(
      record.value["testing.synced.url"],
      "https://www.example.com"
    );
    Assert.strictEqual(
      record.value["services.sync.prefs.sync.testing.synced.url"],
      null
    );

    _("Update some prefs, including one that's to be reset/deleted.");
    // This pref is not going to be reset or deleted as there's no "control pref"
    // in either the incoming record or locally.
    Services.prefs.setStringPref(
      "testing.deleted-without-control-pref",
      "I'm deleted-without-control-pref"
    );
    // Another pref with only a local control pref.
    Services.prefs.setStringPref(
      "testing.deleted-with-local-control-pref",
      "I'm deleted-with-local-control-pref"
    );
    Services.prefs.setBoolPref(
      "services.sync.prefs.sync.testing.deleted-with-local-control-pref",
      true
    );
    // And a pref without a local control pref but one that's incoming.
    Services.prefs.setStringPref(
      "testing.deleted-with-incoming-control-pref",
      "I'm deleted-with-incoming-control-pref"
    );
    record = new PrefRec("prefs", PREFS_GUID);
    record.value = {
      "extensions.activeThemeID": DEFAULT_THEME_ID,
      "testing.int": 42,
      "testing.string": "im in ur prefs",
      "testing.bool": false,
      "testing.deleted-without-control-pref": null,
      "testing.deleted-with-local-control-pref": null,
      "testing.deleted-with-incoming-control-pref": null,
      "services.sync.prefs.sync.testing.deleted-with-incoming-control-pref": true,
      "testing.somepref": "im a new pref from other device",
      "services.sync.prefs.sync.testing.somepref": true,
      // Pretend some a stale remote client is overwriting it with a value
      // we consider unsyncable.
      "testing.synced.url": "blob:ebeb707a-502e-40c6-97a5-dd4bda901463",
      // Make sure we can replace the unsynced URL with a valid URL.
      "testing.unsynced.url": "https://www.example.com/2",
      // Make sure our "master control pref" is ignored.
      "services.sync.prefs.dangerously_allow_arbitrary": true,
      "services.sync.prefs.sync.services.sync.prefs.dangerously_allow_arbitrary": true,
    };

    const onceAddonEnabled = AddonTestUtils.promiseAddonEvent("onEnabled");

    await store.update(record);
    Assert.strictEqual(Services.prefs.getIntPref("testing.int"), 42);
    Assert.strictEqual(
      Services.prefs.getStringPref("testing.string"),
      "im in ur prefs"
    );
    Assert.strictEqual(Services.prefs.getBoolPref("testing.bool"), false);
    Assert.strictEqual(
      Services.prefs.getStringPref("testing.deleted-without-control-pref"),
      "I'm deleted-without-control-pref"
    );
    Assert.strictEqual(
      Services.prefs.getPrefType("testing.deleted-with-local-control-pref"),
      Ci.nsIPrefBranch.PREF_INVALID
    );
    Assert.strictEqual(
      Services.prefs.getStringPref(
        "testing.deleted-with-incoming-control-pref"
      ),
      "I'm deleted-with-incoming-control-pref"
    );
    Assert.strictEqual(
      Services.prefs.getStringPref("testing.dont.change"),
      "Please don't change me."
    );
    Assert.strictEqual(
      Services.prefs.getPrefType("testing.somepref"),
      Ci.nsIPrefBranch.PREF_INVALID
    );
    Assert.strictEqual(
      Services.prefs.getStringPref("testing.synced.url"),
      "https://www.example.com"
    );
    Assert.strictEqual(
      Services.prefs.getStringPref("testing.unsynced.url"),
      "https://www.example.com/2"
    );
    Assert.strictEqual(
      Svc.PrefBranch.getPrefType("prefs.sync.testing.somepref"),
      Ci.nsIPrefBranch.PREF_INVALID
    );
    Assert.strictEqual(
      Services.prefs.getBoolPref(
        "services.sync.prefs.dangerously_allow_arbitrary"
      ),
      false
    );
    Assert.strictEqual(
      Services.prefs.getPrefType(
        "services.sync.prefs.sync.services.sync.prefs.dangerously_allow_arbitrary"
      ),
      Ci.nsIPrefBranch.PREF_INVALID
    );

    await onceAddonEnabled;
    ok(
      !defaultThemeAddon.userDisabled,
      "the default theme should have been enabled"
    );
    ok(
      otherThemeAddon.userDisabled,
      "the compact theme should have been disabled"
    );

    _("Only the current app's preferences are applied.");
    record = new PrefRec("prefs", "some-fake-app");
    record.value = {
      "testing.int": 98,
    };
    await store.update(record);
    Assert.equal(Services.prefs.getIntPref("testing.int"), 42);
  } finally {
    clearValues();
  }
});

add_task(async function test_dangerously_allow() {
  _("services.sync.prefs.dangerously_allow_arbitrary");
  // Bug 1538015 added a capability to "dangerously allow" arbitrary prefs.
  // Bug 1854698 removed that capability but did keep the fact we never
  // sync the pref which enabled the "dangerous" behaviour, just incase someone
  // tries to sync it back to a profile which *does* support that pref.
  Services.prefs.readDefaultPrefsFromFile(
    do_get_file("prefs_test_prefs_store.js")
  );

  let engine = Service.engineManager.get("prefs");
  let store = engine._store;
  try {
    // an incoming record with our old "dangerous" pref.
    let record = new PrefRec("prefs", PREFS_GUID);
    record.value = {
      "services.sync.prefs.dangerously_allow_arbitrary": true,
      "services.sync.prefs.sync.services.sync.prefs.dangerously_allow_arbitrary": true,
    };
    await store.update(record);
    Assert.strictEqual(
      Services.prefs.getBoolPref(
        "services.sync.prefs.dangerously_allow_arbitrary"
      ),
      false
    );
    Assert.strictEqual(
      Services.prefs.getPrefType(
        "services.sync.prefs.sync.services.sync.prefs.dangerously_allow_arbitrary"
      ),
      Ci.nsIPrefBranch.PREF_INVALID
    );
  } finally {
    clearValues();
  }
});

add_task(async function test_incoming_sets_seen() {
  _("Test the sync-seen allow-list");

  let engine = Service.engineManager.get("prefs");
  let store = engine._store;

  Services.prefs.readDefaultPrefsFromFile(
    do_get_file("prefs_test_prefs_store.js")
  );
  const defaultValue = "the value";
  Assert.equal(Services.prefs.getStringPref("testing.seen"), defaultValue);

  let record = await store.createRecord(PREFS_GUID, "prefs");
  // Haven't seen a non-default value before, so remains null.
  Assert.strictEqual(record.value["testing.seen"], null);

  // pretend an incoming record with the default value - it might not be
  // the default everywhere, so we treat it specially.
  record = new PrefRec("prefs", PREFS_GUID);
  record.value = {
    "testing.seen": defaultValue,
  };
  await store.update(record);
  // Our special control value should now be set.
  Assert.strictEqual(
    Services.prefs.getBoolPref("services.sync.prefs.sync-seen.testing.seen"),
    true
  );
  // It's still the default value, so the value is not considered changed
  Assert.equal(Services.prefs.prefHasUserValue("testing.seen"), false);

  // But now that special control value is set, the record always contains the value.
  record = await store.createRecord(PREFS_GUID, "prefs");
  Assert.strictEqual(record.value["testing.seen"], defaultValue);
});

add_task(async function test_outgoing_when_changed() {
  _("Test the 'seen' pref is set first sync of non-default value");

  let engine = Service.engineManager.get("prefs");
  let store = engine._store;
  clearValues();

  Services.prefs.readDefaultPrefsFromFile(
    do_get_file("prefs_test_prefs_store.js")
  );
  const defaultValue = "the value";
  Assert.equal(Services.prefs.getStringPref("testing.seen"), defaultValue);

  let record = await store.createRecord(PREFS_GUID, "prefs");
  // Haven't seen a non-default value before, so remains null.
  Assert.strictEqual(record.value["testing.seen"], null);

  // Change the value.
  Services.prefs.setStringPref("testing.seen", "new value");
  record = await store.createRecord(PREFS_GUID, "prefs");
  // creating the record toggled that "seen" pref.
  Assert.strictEqual(
    Services.prefs.getBoolPref("services.sync.prefs.sync-seen.testing.seen"),
    true
  );
  Assert.strictEqual(Services.prefs.getStringPref("testing.seen"), "new value");

  // Resetting the pref does not change that seen value.
  Services.prefs.clearUserPref("testing.seen");
  Assert.strictEqual(
    Services.prefs.getStringPref("testing.seen"),
    defaultValue
  );

  record = await store.createRecord(PREFS_GUID, "prefs");
  Assert.strictEqual(
    Services.prefs.getBoolPref("services.sync.prefs.sync-seen.testing.seen"),
    true
  );
});
