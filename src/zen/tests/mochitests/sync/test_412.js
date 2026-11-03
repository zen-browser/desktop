/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { RotaryEngine } = ChromeUtils.importESModule(
  "resource://testing-common/services/sync/rotaryengine.sys.mjs"
);

add_task(async function test_412_not_treated_as_failure() {
  await Service.engineManager.register(RotaryEngine);
  let engine = Service.engineManager.get("rotary");

  let server = await serverForFoo(engine);

  await SyncTestingInfrastructure(server);
  await generateNewKeys(Service.collectionKeys);

  // add an item to the server to the first sync advances lastModified.
  let collection = server.getCollection("foo", "rotary");
  let payload = encryptPayload({
    id: "existing",
    something: "existing record",
  });
  collection.insert("existing", payload);

  let promiseObserved = promiseOneObserver("weave:engine:sync:finish");
  try {
    // Do sync.
    _("initial sync to initialize the world");
    await Service.sync();

    // create a new record that should be uploaded and arrange for our lastSync
    // timestamp to be wrong so we get a 412.
    engine._store.items = { new: "new record" };
    await engine._tracker.addChangedID("new", 0);

    let saw412 = false;
    let _uploadOutgoing = engine._uploadOutgoing;
    engine._uploadOutgoing = async () => {
      let lastSync = await engine.getLastSync();
      await engine.setLastSync(lastSync - 2);
      try {
        await _uploadOutgoing.call(engine);
      } catch (ex) {
        saw412 = ex.status == 412;
        throw ex;
      }
    };
    _("Second sync - expecting a 412");
    await Service.sync();
    await promiseObserved;
    ok(saw412, "did see a 412 error");
    // But service status should be OK as the 412 shouldn't be treated as an error.
    equal(Service.status.service, STATUS_OK);
  } finally {
    await promiseStopServer(server);
  }
});
