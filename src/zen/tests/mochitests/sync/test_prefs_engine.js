/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { getPrefsGUIDForTest } = ChromeUtils.importESModule(
  "resource://services-sync/engines/prefs.sys.mjs"
);
const PREFS_GUID = getPrefsGUIDForTest();
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

async function cleanup(engine, server) {
  await engine._tracker.stop();
  await engine.wipeClient();
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  Service.recordManager.clearCache();
  await promiseStopServer(server);
}

add_task(async function test_modified_after_fail() {
  let engine = Service.engineManager.get("prefs");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  try {
    // The homepage pref is synced by default.
    _("Set homepage before first sync");
    Services.prefs.setStringPref("browser.startup.homepage", "about:welcome");

    _("First sync; create collection and pref record on server");
    await sync_engine_and_validate_telem(engine, false);

    let collection = server.user("foo").collection("prefs");
    equal(
      collection.cleartext(PREFS_GUID).value["browser.startup.homepage"],
      "about:welcome",
      "Should upload homepage in pref record"
    );
    ok(
      !engine._tracker.modified,
      "Tracker shouldn't be modified after first sync"
    );

    // Our tracker only has a `modified` flag that's reset after a
    // successful upload. Force it to remain set by failing the
    // upload.
    _("Second sync; flag tracker as modified and throw on upload");
    Services.prefs.setStringPref("browser.startup.homepage", "about:robots");
    engine._tracker.modified = true;
    let oldPost = collection.post;
    collection.post = () => {
      throw new Error("Sync this!");
    };
    await Assert.rejects(
      sync_engine_and_validate_telem(engine, true),
      ex => ex.success === false
    );
    ok(
      engine._tracker.modified,
      "Tracker should remain modified after failed sync"
    );

    _("Third sync");
    collection.post = oldPost;
    await sync_engine_and_validate_telem(engine, false);
    equal(
      collection.cleartext(PREFS_GUID).value["browser.startup.homepage"],
      "about:robots",
      "Should upload new homepage on third sync"
    );
    ok(
      !engine._tracker.modified,
      "Tracker shouldn't be modified again after third sync"
    );
  } finally {
    await cleanup(engine, server);
  }
});

add_task(async function test_allow_arbitrary() {
  let engine = Service.engineManager.get("prefs");

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  try {
    _("Create collection and pref record on server");
    await sync_engine_and_validate_telem(engine, false);

    let collection = server.user("foo").collection("prefs");

    _("Insert arbitrary pref into remote record");
    let cleartext1 = collection.cleartext(PREFS_GUID);
    cleartext1.value.let_viruses_take_over = true;
    collection.insert(
      PREFS_GUID,
      encryptPayload(cleartext1),
      new_timestamp() + 5
    );

    _("Sync again; client shouldn't allow pref");
    await sync_engine_and_validate_telem(engine, false);
    ok(
      !Services.prefs.getBoolPref("let_viruses_take_over", false),
      "Shouldn't allow arbitrary remote prefs without control pref"
    );

    _("Sync with control pref set; client should set new pref");
    Services.prefs.setBoolPref(
      "services.sync.prefs.sync.let_viruses_take_over_take_two",
      true
    );

    let cleartext2 = collection.cleartext(PREFS_GUID);
    cleartext2.value.let_viruses_take_over_take_two = true;
    collection.insert(
      PREFS_GUID,
      encryptPayload(cleartext2),
      new_timestamp() + 5
    );
    // Reset the last sync time so that the engine fetches the record again.
    await engine.setLastSync(0);
    await sync_engine_and_validate_telem(engine, false);
    ok(
      Services.prefs.getBoolPref("let_viruses_take_over_take_two"),
      "Should set arbitrary remote pref with control pref"
    );
  } finally {
    await cleanup(engine, server);
  }
});
