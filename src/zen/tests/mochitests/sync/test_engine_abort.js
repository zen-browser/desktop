/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { WBORecord } = ChromeUtils.importESModule(
  "resource://services-sync/record.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { RotaryEngine } = ChromeUtils.importESModule(
  "resource://testing-common/services/sync/rotaryengine.sys.mjs"
);

add_task(async function test_processIncoming_abort() {
  _(
    "An abort exception, raised in applyIncoming, will abort _processIncoming."
  );
  let engine = new RotaryEngine(Service);

  let collection = new ServerCollection();
  let id = Utils.makeGUID();
  let payload = encryptPayload({ id, denomination: "Record No. " + id });
  collection.insert(id, payload);

  let server = sync_httpd_setup({
    "/1.1/foo/storage/rotary": collection.handler(),
  });

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  _("Create some server data.");
  let syncID = await engine.resetLocalSyncID();
  let meta_global = Service.recordManager.set(
    engine.metaURL,
    new WBORecord(engine.metaURL)
  );
  meta_global.payload.engines = { rotary: { version: engine.version, syncID } };
  _("Fake applyIncoming to abort.");
  engine._store.applyIncoming = async function () {
    let ex = {
      code: SyncEngine.prototype.eEngineAbortApplyIncoming,
      cause: "Nooo",
    };
    _("Throwing: " + JSON.stringify(ex));
    throw ex;
  };

  _("Trying _processIncoming. It will throw after aborting.");
  let err;
  try {
    await engine._syncStartup();
    await engine._processIncoming();
  } catch (ex) {
    err = ex;
  }

  Assert.equal(err, "Nooo");
  err = undefined;

  _("Trying engine.sync(). It will abort without error.");
  try {
    // This will quietly fail.
    await engine.sync();
  } catch (ex) {
    err = ex;
  }

  Assert.equal(err, undefined);

  await promiseStopServer(server);
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  Service.recordManager.clearCache();

  await engine._tracker.clearChangedIDs();
  await engine.finalize();
});
