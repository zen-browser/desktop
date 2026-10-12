/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { DeclinedEngines } = ChromeUtils.importESModule(
  "resource://services-sync/stages/declined.sys.mjs"
);
const { EngineSynchronizer } = ChromeUtils.importESModule(
  "resource://services-sync/stages/enginesync.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { Observers } = ChromeUtils.importESModule(
  "resource://services-common/observers.sys.mjs"
);

function PetrolEngine() {}
PetrolEngine.prototype.name = "petrol";

function DieselEngine() {}
DieselEngine.prototype.name = "diesel";

function DummyEngine() {}
DummyEngine.prototype.name = "dummy";

function ActualEngine() {}
ActualEngine.prototype.name = "actual";
Object.setPrototypeOf(ActualEngine.prototype, SyncEngine.prototype);

function getEngineManager() {
  let manager = new EngineManager(Service);
  Service.engineManager = manager;
  manager._engines = {
    petrol: new PetrolEngine(),
    diesel: new DieselEngine(),
    dummy: new DummyEngine(),
    actual: new ActualEngine(),
  };
  return manager;
}

/**
 * 'Fetch' a meta/global record that doesn't mention declined.
 *
 * Push it into the EngineSynchronizer to set enabled; verify that those are
 * correct.
 *
 * Then push it into DeclinedEngines to set declined; verify that none are
 * declined, and a notification is sent for our locally disabled-but-not-
 * declined engines.
 */
add_task(async function testOldMeta() {
  let meta = {
    payload: {
      engines: {
        petrol: 1,
        diesel: 2,
        nonlocal: 3, // Enabled but not supported.
      },
    },
  };

  _("Record: " + JSON.stringify(meta));

  let manager = getEngineManager();

  // Update enabled from meta/global.
  let engineSync = new EngineSynchronizer(Service);
  await engineSync._updateEnabledFromMeta(meta, 3, manager);

  Assert.ok(manager._engines.petrol.enabled, "'petrol' locally enabled.");
  Assert.ok(manager._engines.diesel.enabled, "'diesel' locally enabled.");
  Assert.ok(
    !("nonlocal" in manager._engines),
    "We don't know anything about the 'nonlocal' engine."
  );
  Assert.ok(!manager._engines.actual.enabled, "'actual' not locally enabled.");
  Assert.ok(!manager.isDeclined("actual"), "'actual' not declined, though.");

  let declinedEngines = new DeclinedEngines(Service);

  function onNotDeclined(subject) {
    Observers.remove("weave:engines:notdeclined", onNotDeclined);
    Assert.ok(
      subject.undecided.has("actual"),
      "EngineManager observed that 'actual' was undecided."
    );

    let declined = manager.getDeclined();
    _("Declined: " + JSON.stringify(declined));

    Assert.ok(!meta.changed, "No need to upload a new meta/global.");
    run_next_test();
  }

  Observers.add("weave:engines:notdeclined", onNotDeclined);

  declinedEngines.updateDeclined(meta, manager);
});

/**
 * 'Fetch' a meta/global that declines an engine we don't
 * recognize. Ensure that we track that declined engine along
 * with any we locally declined, and that the meta/global
 * record is marked as changed and includes all declined
 * engines.
 */
add_task(async function testDeclinedMeta() {
  let meta = {
    payload: {
      engines: {
        petrol: 1,
        diesel: 2,
        nonlocal: 3, // Enabled but not supported.
      },
      declined: ["nonexistent"], // Declined and not supported.
    },
  };

  _("Record: " + JSON.stringify(meta));

  let manager = getEngineManager();
  manager._engines.petrol.enabled = true;
  manager._engines.diesel.enabled = true;
  manager._engines.dummy.enabled = true;
  manager._engines.actual.enabled = false; // Disabled but not declined.

  manager.decline(["localdecline"]); // Declined and not supported.

  let declinedEngines = new DeclinedEngines(Service);

  function onNotDeclined(subject) {
    Observers.remove("weave:engines:notdeclined", onNotDeclined);
    Assert.ok(
      subject.undecided.has("actual"),
      "EngineManager observed that 'actual' was undecided."
    );

    let declined = manager.getDeclined();
    _("Declined: " + JSON.stringify(declined));

    Assert.equal(
      declined.indexOf("actual"),
      -1,
      "'actual' is locally disabled, but not marked as declined."
    );

    Assert.equal(
      declined.indexOf("clients"),
      -1,
      "'clients' is enabled and not remotely declined."
    );
    Assert.equal(
      declined.indexOf("petrol"),
      -1,
      "'petrol' is enabled and not remotely declined."
    );
    Assert.equal(
      declined.indexOf("diesel"),
      -1,
      "'diesel' is enabled and not remotely declined."
    );
    Assert.equal(
      declined.indexOf("dummy"),
      -1,
      "'dummy' is enabled and not remotely declined."
    );

    Assert.lessOrEqual(
      0,
      declined.indexOf("nonexistent"),
      "'nonexistent' was declined on the server."
    );

    Assert.lessOrEqual(
      0,
      declined.indexOf("localdecline"),
      "'localdecline' was declined locally."
    );

    // The meta/global is modified, too.
    Assert.lessOrEqual(
      0,
      meta.payload.declined.indexOf("nonexistent"),
      "meta/global's declined contains 'nonexistent'."
    );
    Assert.lessOrEqual(
      0,
      meta.payload.declined.indexOf("localdecline"),
      "meta/global's declined contains 'localdecline'."
    );
    Assert.strictEqual(true, meta.changed, "meta/global was changed.");
  }

  Observers.add("weave:engines:notdeclined", onNotDeclined);

  declinedEngines.updateDeclined(meta, manager);
});
