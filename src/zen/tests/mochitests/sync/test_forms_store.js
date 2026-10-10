/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

_(
  "Make sure the form store follows the Store api and correctly accesses the backend form storage"
);
const { FormEngine } = ChromeUtils.importESModule(
  "resource://services-sync/engines/forms.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { SyncedRecordsTelemetry } = ChromeUtils.importESModule(
  "resource://services-sync/telemetry.sys.mjs"
);

add_task(async function run_test() {
  let engine = new FormEngine(Service);
  await engine.initialize();
  let store = engine._store;

  async function applyEnsureNoFailures(records) {
    let countTelemetry = new SyncedRecordsTelemetry();
    Assert.equal(
      (await store.applyIncomingBatch(records, countTelemetry)).length,
      0
    );
  }

  _("Remove any existing entries");
  await store.wipe();
  if ((await store.getAllIDs()).length) {
    do_throw("Shouldn't get any ids!");
  }

  _("Add a form entry");
  await applyEnsureNoFailures([
    {
      id: Utils.makeGUID(),
      name: "name!!",
      value: "value??",
    },
  ]);

  _("Should have 1 entry now");
  let id = "";
  for (let _id in await store.getAllIDs()) {
    if (id == "") {
      id = _id;
    } else {
      do_throw("Should have only gotten one!");
    }
  }
  Assert.ok(store.itemExists(id));

  _("Should be able to find this entry as a dupe");
  Assert.equal(
    await engine._findDupe({ name: "name!!", value: "value??" }),
    id
  );

  let rec = await store.createRecord(id);
  _("Got record for id", id, rec);
  Assert.equal(rec.name, "name!!");
  Assert.equal(rec.value, "value??");

  _("Create a non-existent id for delete");
  Assert.ok((await store.createRecord("deleted!!")).deleted);

  _("Try updating.. doesn't do anything yet");
  await store.update({});

  _("Remove all entries");
  await store.wipe();
  if ((await store.getAllIDs()).length) {
    do_throw("Shouldn't get any ids!");
  }

  _("Add another entry");
  await applyEnsureNoFailures([
    {
      id: Utils.makeGUID(),
      name: "another",
      value: "entry",
    },
  ]);
  id = "";
  for (let _id in await store.getAllIDs()) {
    if (id == "") {
      id = _id;
    } else {
      do_throw("Should have only gotten one!");
    }
  }

  _("Change the id of the new entry to something else");
  await store.changeItemID(id, "newid");

  _("Make sure it's there");
  Assert.ok(store.itemExists("newid"));

  _("Remove the entry");
  await store.remove({
    id: "newid",
  });
  if ((await store.getAllIDs()).length) {
    do_throw("Shouldn't get any ids!");
  }

  _("Removing the entry again shouldn't matter");
  await store.remove({
    id: "newid",
  });
  if ((await store.getAllIDs()).length) {
    do_throw("Shouldn't get any ids!");
  }

  _("Add another entry to delete using applyIncomingBatch");
  let toDelete = {
    id: Utils.makeGUID(),
    name: "todelete",
    value: "entry",
  };
  await applyEnsureNoFailures([toDelete]);
  id = "";
  for (let _id in await store.getAllIDs()) {
    if (id == "") {
      id = _id;
    } else {
      do_throw("Should have only gotten one!");
    }
  }
  Assert.ok(store.itemExists(id));
  // mark entry as deleted
  toDelete.id = id;
  toDelete.deleted = true;
  await applyEnsureNoFailures([toDelete]);
  if ((await store.getAllIDs()).length) {
    do_throw("Shouldn't get any ids!");
  }

  _("Add an entry to wipe");
  await applyEnsureNoFailures([
    {
      id: Utils.makeGUID(),
      name: "towipe",
      value: "entry",
    },
  ]);

  await store.wipe();

  if ((await store.getAllIDs()).length) {
    do_throw("Shouldn't get any ids!");
  }

  _("Ensure we work if formfill is disabled.");
  Services.prefs.setBoolPref("browser.formfill.enable", false);
  try {
    // a search
    if ((await store.getAllIDs()).length) {
      do_throw("Shouldn't get any ids!");
    }
    // an update.
    await applyEnsureNoFailures([
      {
        id: Utils.makeGUID(),
        name: "some",
        value: "entry",
      },
    ]);
  } finally {
    Services.prefs.clearUserPref("browser.formfill.enable");
    await store.wipe();
  }
});
