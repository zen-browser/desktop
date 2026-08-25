/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

function CanDecryptEngine() {
  SyncEngine.call(this, "CanDecrypt", Service);
}
CanDecryptEngine.prototype = {
  // Override these methods with mocks for the test
  async canDecrypt() {
    return true;
  },

  wasWiped: false,
  async wipeClient() {
    this.wasWiped = true;
  },
};
Object.setPrototypeOf(CanDecryptEngine.prototype, SyncEngine.prototype);

function CannotDecryptEngine() {
  SyncEngine.call(this, "CannotDecrypt", Service);
}
CannotDecryptEngine.prototype = {
  // Override these methods with mocks for the test
  async canDecrypt() {
    return false;
  },

  wasWiped: false,
  async wipeClient() {
    this.wasWiped = true;
  },
};
Object.setPrototypeOf(CannotDecryptEngine.prototype, SyncEngine.prototype);

let canDecryptEngine;
let cannotDecryptEngine;

add_task(async function setup() {
  await Service.engineManager.clear();

  await Service.engineManager.register(CanDecryptEngine);
  await Service.engineManager.register(CannotDecryptEngine);
  canDecryptEngine = Service.engineManager.get("candecrypt");
  cannotDecryptEngine = Service.engineManager.get("cannotdecrypt");
});

add_task(async function test_withEngineList() {
  try {
    _("Ensure initial scenario.");
    Assert.ok(!canDecryptEngine.wasWiped);
    Assert.ok(!cannotDecryptEngine.wasWiped);

    _("Wipe local engine data.");
    await Service.wipeClient(["candecrypt", "cannotdecrypt"]);

    _("Ensure only the engine that can decrypt was wiped.");
    Assert.ok(canDecryptEngine.wasWiped);
    Assert.ok(!cannotDecryptEngine.wasWiped);
  } finally {
    canDecryptEngine.wasWiped = false;
    cannotDecryptEngine.wasWiped = false;
    await Service.startOver();
  }
});

add_task(async function test_startOver_clears_keys() {
  syncTestLogging();
  await generateNewKeys(Service.collectionKeys);
  Assert.ok(!!Service.collectionKeys.keyForCollection());
  await Service.startOver();
  syncTestLogging();
  Assert.ok(!Service.collectionKeys.keyForCollection());
});
