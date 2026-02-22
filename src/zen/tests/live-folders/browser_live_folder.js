/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
  nsZenLiveFolderProvider: "resource:///modules/zen/ZenLiveFolder.sys.mjs",
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Zen Live Folder Scheduling", () => {
  let instance;
  let sandbox;
  let mockManager;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockManager = {
      saveState: sandbox.spy(),
      onLiveFolderFetch: sandbox.spy(),
    };
  });

  afterEach(() => {
    if (instance) {
      instance.stop();
    }
    sandbox.restore();
  });

  it("should fetch correctly at an interval", async () => {
    const INTERVAL = 250;

    instance = new nsZenLiveFolderProvider({
      id: "test-folder",
      manager: mockManager,
      state: {
        interval: INTERVAL,
        lastFetched: Date.now(),
      },
    });

    const fetchStub = sandbox.stub(instance, "fetchItems").resolves(["item1"]);
    sandbox.stub(instance, "getMetadata").returns({});

    instance.start();

    sinon.assert.notCalled(fetchStub);
    await sleep(INTERVAL / 2);
    sinon.assert.notCalled(fetchStub);

    await sleep(INTERVAL * 2);
    Assert.ok(fetchStub.callCount > 1, "Should have fetched more than once");

    sinon.assert.called(mockManager.saveState);
    sinon.assert.called(mockManager.onLiveFolderFetch);
  });

  it("should fetch immediately if overdue", async () => {
    const INTERVAL = 500;

    instance = new nsZenLiveFolderProvider({
      id: "test-folder-overdue",
      manager: mockManager,
      state: {
        interval: INTERVAL,
        lastFetched: Date.now() - 3600000,
      },
    });

    const fetchStub = sandbox.stub(instance, "fetchItems").resolves(["item1"]);
    sandbox.stub(instance, "getMetadata").returns({});

    instance.start();

    await sleep(20);
    sinon.assert.calledOnce(fetchStub);
  });
});
