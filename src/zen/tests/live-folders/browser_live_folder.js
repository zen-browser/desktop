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
  const INTERVAL = 250;
  const INTERVAL_OFFSET = 50;

  let instance;
  let sandbox;
  let mockManager;

  function createInstance({ id, interval, lastFetched }) {
    instance = new nsZenLiveFolderProvider({
      id,
      manager: mockManager,
      state: {
        interval,
        lastFetched,
      },
    });

    const fetchStub = sandbox.stub(instance, "fetchItems").resolves(["item1"]);
    sandbox.stub(instance, "getMetadata").returns({});

    return { fetchStub };
  }

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
    const { fetchStub } = createInstance({
      id: "test-folder",
      interval: INTERVAL,
      lastFetched: Date.now(),
    });

    instance.start();
    sinon.assert.notCalled(fetchStub);

    const startSpy = sandbox.spy(instance, "start");

    await sleep(INTERVAL + INTERVAL_OFFSET);
    Assert.equal(fetchStub.callCount, 1, "Should have fetched once after the first interval");

    await sleep(INTERVAL + INTERVAL_OFFSET);
    Assert.equal(fetchStub.callCount, 2, "Should have fetched 2 times");
    Assert.deepEqual(
      startSpy.firstCall.args,
      [false],
      "Start should have been called once with false"
    );

    await sleep(INTERVAL + INTERVAL_OFFSET);
    Assert.equal(fetchStub.callCount, 3, "Should have fetched 3 times");
    Assert.equal(startSpy.callCount, 1, "Start should not been called");

    sinon.assert.called(mockManager.saveState);
    sinon.assert.called(mockManager.onLiveFolderFetch);
  });

  it("should fetch immediately if overdue", async () => {
    const { fetchStub } = createInstance({
      id: "test-folder-overdue",
      interval: INTERVAL,
      lastFetched: Date.now() - 3600000,
    });

    instance.start();

    await sleep(INTERVAL_OFFSET);
    sinon.assert.calledOnce(fetchStub);
  });

  it("should fetch with correct offset", async () => {
    const { fetchStub } = createInstance({
      id: "test-folder-delay",
      interval: INTERVAL,
      lastFetched: Date.now() - INTERVAL / 2,
    });

    instance.start();
    await sleep(INTERVAL / 2 + INTERVAL_OFFSET);
    Assert.equal(fetchStub.callCount, 1, "Should have fetched once");

    await sleep(INTERVAL + INTERVAL_OFFSET);
    Assert.equal(fetchStub.callCount, 2, "Should have fetched once with normal interval");
  });

  it("should re-start the timer if interval was changed", async () => {
    const { fetchStub } = createInstance({
      id: "test-folder-interval-change",
      interval: INTERVAL,
      lastFetched: Date.now(),
    });

    instance.start();

    sinon.assert.notCalled(fetchStub);
    await sleep(INTERVAL + INTERVAL_OFFSET);
    Assert.equal(fetchStub.callCount, 1, "Should have fetched once after the first interval");

    const NEW_INTERVAL = 500;
    instance.state.interval = NEW_INTERVAL;

    instance.stop();
    instance.start();

    await sleep(NEW_INTERVAL + INTERVAL_OFFSET);
    Assert.equal(fetchStub.callCount, 2, "Should have once after the new interval");
  });
});
