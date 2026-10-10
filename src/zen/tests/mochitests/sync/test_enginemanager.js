/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

function PetrolEngine() {}
PetrolEngine.prototype.name = "petrol";
PetrolEngine.prototype.finalize = async function () {};

function DieselEngine() {}
DieselEngine.prototype.name = "diesel";
DieselEngine.prototype.finalize = async function () {};

function DummyEngine() {}
DummyEngine.prototype.name = "dummy";
DummyEngine.prototype.finalize = async function () {};

class ActualEngine extends SyncEngine {
  constructor(service) {
    super("Actual", service);
  }
}

add_task(async function test_basics() {
  _("We start out with a clean slate");

  let manager = new EngineManager(Service);

  let engines = await manager.getAll();
  Assert.equal(engines.length, 0);
  Assert.equal(await manager.get("dummy"), undefined);

  _("Register an engine");
  await manager.register(DummyEngine);
  let dummy = await manager.get("dummy");
  Assert.ok(dummy instanceof DummyEngine);

  engines = await manager.getAll();
  Assert.equal(engines.length, 1);
  Assert.equal(engines[0], dummy);

  _("Register an already registered engine is ignored");
  await manager.register(DummyEngine);
  Assert.equal(await manager.get("dummy"), dummy);

  _("Register multiple engines in one go");
  await manager.register([PetrolEngine, DieselEngine]);
  let petrol = await manager.get("petrol");
  let diesel = await manager.get("diesel");
  Assert.ok(petrol instanceof PetrolEngine);
  Assert.ok(diesel instanceof DieselEngine);

  engines = await manager.getAll();
  Assert.equal(engines.length, 3);
  Assert.notEqual(engines.indexOf(petrol), -1);
  Assert.notEqual(engines.indexOf(diesel), -1);

  _("Retrieve multiple engines in one go");
  engines = await manager.get(["dummy", "diesel"]);
  Assert.equal(engines.length, 2);
  Assert.notEqual(engines.indexOf(dummy), -1);
  Assert.notEqual(engines.indexOf(diesel), -1);

  _("getEnabled() only returns enabled engines");
  engines = await manager.getEnabled();
  Assert.equal(engines.length, 0);

  petrol.enabled = true;
  engines = await manager.getEnabled();
  Assert.equal(engines.length, 1);
  Assert.equal(engines[0], petrol);

  dummy.enabled = true;
  diesel.enabled = true;
  engines = await manager.getEnabled();
  Assert.equal(engines.length, 3);

  _("getEnabled() returns enabled engines in sorted order");
  petrol.syncPriority = 1;
  dummy.syncPriority = 2;
  diesel.syncPriority = 3;

  engines = await manager.getEnabled();

  Assert.deepEqual(engines, [petrol, dummy, diesel]);

  _("Changing the priorities should change the order in getEnabled()");

  dummy.syncPriority = 4;

  engines = await manager.getEnabled();

  Assert.deepEqual(engines, [petrol, diesel, dummy]);

  _("Unregister an engine by name");
  await manager.unregister("dummy");
  Assert.equal(await manager.get("dummy"), undefined);
  engines = await manager.getAll();
  Assert.equal(engines.length, 2);
  Assert.equal(engines.indexOf(dummy), -1);

  _("Unregister an engine by value");
  // manager.unregister() checks for instanceof Engine, so let's make one:
  await manager.register(ActualEngine);
  let actual = await manager.get("actual");
  Assert.ok(actual instanceof ActualEngine);
  Assert.ok(actual instanceof SyncEngine);

  await manager.unregister(actual);
  Assert.equal(await manager.get("actual"), undefined);
});

class AutoEngine {
  constructor(type) {
    this.name = "automobile";
    this.type = type;
    this.initializeCalled = false;
    this.finalizeCalled = false;
    this.isActive = false;
  }

  async initialize() {
    Assert.ok(!this.initializeCalled);
    Assert.equal(AutoEngine.current, undefined);
    this.initializeCalled = true;
    this.isActive = true;
    AutoEngine.current = this;
  }

  async finalize() {
    Assert.equal(AutoEngine.current, this);
    Assert.ok(!this.finalizeCalled);
    Assert.ok(this.isActive);
    this.finalizeCalled = true;
    this.isActive = false;
    AutoEngine.current = undefined;
  }
}

class GasolineEngine extends AutoEngine {
  constructor() {
    super("gasoline");
  }
}

class ElectricEngine extends AutoEngine {
  constructor() {
    super("electric");
  }
}

add_task(async function test_alternates() {
  let manager = new EngineManager(Service);
  let engines = await manager.getAll();
  Assert.equal(engines.length, 0);

  const prefName = "services.sync.engines.automobile.electric";
  Services.prefs.clearUserPref(prefName);

  await manager.registerAlternatives(
    "automobile",
    prefName,
    ElectricEngine,
    GasolineEngine
  );

  let gasEngine = manager.get("automobile");
  Assert.equal(gasEngine.type, "gasoline");

  Assert.ok(gasEngine.isActive);
  Assert.ok(gasEngine.initializeCalled);
  Assert.ok(!gasEngine.finalizeCalled);
  Assert.equal(AutoEngine.current, gasEngine);

  _("Check that setting the controlling pref to false makes no difference");
  Services.prefs.setBoolPref(prefName, false);
  Assert.equal(manager.get("automobile"), gasEngine);
  Assert.ok(gasEngine.isActive);
  Assert.ok(gasEngine.initializeCalled);
  Assert.ok(!gasEngine.finalizeCalled);

  _("Even after the call to switchAlternatives");
  await manager.switchAlternatives();
  Assert.equal(manager.get("automobile"), gasEngine);
  Assert.ok(gasEngine.isActive);
  Assert.ok(gasEngine.initializeCalled);
  Assert.ok(!gasEngine.finalizeCalled);

  _("Set the pref to true, we still shouldn't switch yet");
  Services.prefs.setBoolPref(prefName, true);
  Assert.equal(manager.get("automobile"), gasEngine);
  Assert.ok(gasEngine.isActive);
  Assert.ok(gasEngine.initializeCalled);
  Assert.ok(!gasEngine.finalizeCalled);

  _("Now we expect to switch from gas to electric");
  await manager.switchAlternatives();
  let elecEngine = manager.get("automobile");
  Assert.equal(elecEngine.type, "electric");
  Assert.ok(elecEngine.isActive);
  Assert.ok(elecEngine.initializeCalled);
  Assert.ok(!elecEngine.finalizeCalled);
  Assert.equal(AutoEngine.current, elecEngine);

  Assert.ok(!gasEngine.isActive);
  Assert.ok(gasEngine.finalizeCalled);

  _("Switch back, and ensure we get a new instance that got initialized again");
  Services.prefs.setBoolPref(prefName, false);
  await manager.switchAlternatives();

  // First make sure we deactivated the electric engine as we should
  Assert.ok(!elecEngine.isActive);
  Assert.ok(elecEngine.initializeCalled);
  Assert.ok(elecEngine.finalizeCalled);

  let newGasEngine = manager.get("automobile");
  Assert.notEqual(newGasEngine, gasEngine);
  Assert.equal(newGasEngine.type, "gasoline");

  Assert.ok(newGasEngine.isActive);
  Assert.ok(newGasEngine.initializeCalled);
  Assert.ok(!newGasEngine.finalizeCalled);

  _("Make sure unregister removes the alt info too");
  await manager.unregister("automobile");
  Assert.equal(manager.get("automobile"), null);
  Assert.ok(newGasEngine.finalizeCalled);
  Assert.deepEqual(Object.keys(manager._altEngineInfo), []);
});
