/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

function BlaEngine() {
  SyncEngine.call(this, "Bla", Service);
}
BlaEngine.prototype = {
  removed: false,
  async removeClientData() {
    this.removed = true;
  },
};
Object.setPrototypeOf(BlaEngine.prototype, SyncEngine.prototype);

add_task(async function setup() {
  await Service.engineManager.register(BlaEngine);
});

add_task(async function test_resetLocalData() {
  await configureIdentity();
  Service.status.enforceBackoff = true;
  Service.status.backoffInterval = 42;
  Service.status.minimumNextSync = 23;

  // Verify set up.
  Assert.equal(Service.status.checkSetup(), STATUS_OK);

  // Verify state that the observer sees.
  let observerCalled = false;
  Svc.Obs.add("weave:service:start-over", function onStartOver() {
    Svc.Obs.remove("weave:service:start-over", onStartOver);
    observerCalled = true;

    Assert.equal(Service.status.service, CLIENT_NOT_CONFIGURED);
  });

  await Service.startOver();
  Assert.ok(observerCalled);

  // Verify the site was nuked from orbit.
  Assert.equal(
    Svc.PrefBranch.getPrefType("username"),
    Ci.nsIPrefBranch.PREF_INVALID
  );

  Assert.equal(Service.status.service, CLIENT_NOT_CONFIGURED);
  Assert.ok(!Service.status.enforceBackoff);
  Assert.equal(Service.status.backoffInterval, 0);
  Assert.equal(Service.status.minimumNextSync, 0);
});

add_task(async function test_removeClientData() {
  let engine = Service.engineManager.get("bla");

  // No cluster URL = no removal.
  Assert.ok(!engine.removed);
  await Service.startOver();
  Assert.ok(!engine.removed);

  Service.clusterURL = "https://localhost/";

  Assert.ok(!engine.removed);
  await Service.startOver();
  Assert.ok(engine.removed);
});

add_task(async function test_reset_SyncScheduler() {
  // Some non-default values for SyncScheduler's attributes.
  Service.scheduler.idle = true;
  Service.scheduler.hasIncomingItems = true;
  Svc.PrefBranch.setIntPref("clients.devices.desktop", 42);
  Service.scheduler.nextSync = Date.now();
  Service.scheduler.syncThreshold = MULTI_DEVICE_THRESHOLD;
  Service.scheduler.syncInterval = Service.scheduler.activeInterval;

  await Service.startOver();

  Assert.ok(!Service.scheduler.idle);
  Assert.ok(!Service.scheduler.hasIncomingItems);
  Assert.equal(Service.scheduler.numClients, 0);
  Assert.equal(Service.scheduler.nextSync, 0);
  Assert.equal(Service.scheduler.syncThreshold, SINGLE_USER_THRESHOLD);
  Assert.equal(
    Service.scheduler.syncInterval,
    Service.scheduler.singleDeviceInterval
  );
});
