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
    await sleep(INTERVAL + 50);
    Assert.equal(fetchStub.callCount, 1, "Should have fetched once after the first interval");

    await sleep(INTERVAL + 50);
    Assert.equal(fetchStub.callCount, 2, "Should have fetched twice");

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

  it("should re-start the timer if interval was changed", async () => {
    const INTERVAL = 500;

    instance = new nsZenLiveFolderProvider({
      id: "test-folder-interval-change",
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
    await sleep(INTERVAL + INTERVAL / 5);
    Assert.equal(fetchStub.callCount, 1, "Should have fetched once after the first interval");

    const NEW_INTERVAL = 1000;
    instance.state.interval = NEW_INTERVAL;

    instance.stop();
    instance.start();

    await sleep(NEW_INTERVAL + NEW_INTERVAL / 5);
    Assert.equal(fetchStub.callCount, 2, "Should have once after the new interval");
  });
});
