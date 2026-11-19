/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

async function makeSteamEngine() {
  let engine = new SyncEngine("Steam", Service);
  await engine.initialize();
  return engine;
}

function guidSetOfSize(length) {
  return new SerializableSet(Array.from({ length }, () => Utils.makeGUID()));
}

function assertSetsEqual(a, b) {
  // Assert.deepEqual doesn't understand Set.
  Assert.deepEqual(Array.from(a).sort(), Array.from(b).sort());
}

async function testSteamEngineStorage(test) {
  try {
    let setupEngine = await makeSteamEngine();

    if (test.setup) {
      await test.setup(setupEngine);
    }

    // Finalize the engine to flush the backlog and previous failed to disk.
    await setupEngine.finalize();

    if (test.beforeCheck) {
      await test.beforeCheck();
    }

    let checkEngine = await makeSteamEngine();
    await test.check(checkEngine);

    await checkEngine.resetClient();
    await checkEngine.finalize();
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
}

let server;

add_task(async function setup() {
  server = httpd_setup({});
});

add_task(async function test_url_attributes() {
  _("SyncEngine url attributes");
  await SyncTestingInfrastructure(server);
  Service.clusterURL = "https://cluster/1.1/foo/";
  let engine = await makeSteamEngine();
  try {
    Assert.equal(engine.storageURL, "https://cluster/1.1/foo/storage/");
    Assert.equal(engine.engineURL, "https://cluster/1.1/foo/storage/steam");
    Assert.equal(engine.metaURL, "https://cluster/1.1/foo/storage/meta/global");
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});

add_task(async function test_syncID() {
  _("SyncEngine.syncID corresponds to preference");
  await SyncTestingInfrastructure(server);
  let engine = await makeSteamEngine();
  try {
    // Ensure pristine environment
    Assert.equal(
      Svc.PrefBranch.getPrefType("steam.syncID"),
      Ci.nsIPrefBranch.PREF_INVALID
    );
    Assert.equal(await engine.getSyncID(), "");

    // Performing the first get on the attribute will generate a new GUID.
    Assert.equal(await engine.resetLocalSyncID(), "fake-guid-00");
    Assert.equal(Svc.PrefBranch.getStringPref("steam.syncID"), "fake-guid-00");

    Svc.PrefBranch.setStringPref("steam.syncID", Utils.makeGUID());
    Assert.equal(Svc.PrefBranch.getStringPref("steam.syncID"), "fake-guid-01");
    Assert.equal(await engine.getSyncID(), "fake-guid-01");
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});

add_task(async function test_lastSync() {
  _("SyncEngine.lastSync corresponds to preferences");
  await SyncTestingInfrastructure(server);
  let engine = await makeSteamEngine();
  try {
    // Ensure pristine environment
    Assert.equal(
      Svc.PrefBranch.getPrefType("steam.lastSync"),
      Ci.nsIPrefBranch.PREF_INVALID
    );
    Assert.equal(await engine.getLastSync(), 0);

    // Floats are properly stored as floats and synced with the preference
    await engine.setLastSync(123.45);
    Assert.equal(await engine.getLastSync(), 123.45);
    Assert.equal(Svc.PrefBranch.getStringPref("steam.lastSync"), "123.45");

    // Integer is properly stored
    await engine.setLastSync(67890);
    Assert.equal(await engine.getLastSync(), 67890);
    Assert.equal(Svc.PrefBranch.getStringPref("steam.lastSync"), "67890");

    // resetLastSync() resets the value (and preference) to 0
    await engine.resetLastSync();
    Assert.equal(await engine.getLastSync(), 0);
    Assert.equal(Svc.PrefBranch.getStringPref("steam.lastSync"), "0");
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});

add_task(async function test_toFetch() {
  _("SyncEngine.toFetch corresponds to file on disk");
  await SyncTestingInfrastructure(server);

  await testSteamEngineStorage({
    toFetch: guidSetOfSize(3),
    setup(engine) {
      // Ensure pristine environment
      Assert.equal(engine.toFetch.size, 0);

      // Write file to disk
      engine.toFetch = this.toFetch;
      Assert.equal(engine.toFetch, this.toFetch);
    },
    check(engine) {
      // toFetch is written asynchronously
      assertSetsEqual(engine.toFetch, this.toFetch);
    },
  });

  await testSteamEngineStorage({
    toFetch: guidSetOfSize(4),
    toFetch2: guidSetOfSize(5),
    setup(engine) {
      // Make sure it work for consecutive writes before the callback is executed.
      engine.toFetch = this.toFetch;
      Assert.equal(engine.toFetch, this.toFetch);

      engine.toFetch = this.toFetch2;
      Assert.equal(engine.toFetch, this.toFetch2);
    },
    check(engine) {
      assertSetsEqual(engine.toFetch, this.toFetch2);
    },
  });

  await testSteamEngineStorage({
    toFetch: guidSetOfSize(2),
    async beforeCheck() {
      let toFetchPath = PathUtils.join(
        PathUtils.profileDir,
        "weave",
        "toFetch",
        "steam.json"
      );
      await IOUtils.writeJSON(toFetchPath, this.toFetch, {
        tmpPath: toFetchPath + ".tmp",
      });
    },
    check(engine) {
      // Read file from disk
      assertSetsEqual(engine.toFetch, this.toFetch);
    },
  });
});

add_task(async function test_previousFailed() {
  _("SyncEngine.previousFailed values correspond to file on disk");
  await SyncTestingInfrastructure(server);

  await testSteamEngineStorage({
    previousFailedIn: guidSetOfSize(3),
    previousFailedOut: guidSetOfSize(3),
    setup(engine) {
      // Ensure pristine environment
      Assert.equal(engine.previousFailedIn.size, 0);
      Assert.equal(engine.previousFailedOut.size, 0);

      // Write files to disk
      engine.previousFailedIn = this.previousFailedIn;
      Assert.equal(engine.previousFailedIn, this.previousFailedIn);
      engine.previousFailedOut = this.previousFailedOut;
      Assert.equal(engine.previousFailedOut, this.previousFailedOut);
    },
    check(engine) {
      // previousFailed values are written asynchronously
      assertSetsEqual(engine.previousFailedIn, this.previousFailedIn);
      assertSetsEqual(engine.previousFailedOut, this.previousFailedOut);
    },
  });

  await testSteamEngineStorage({
    previousFailedIn: guidSetOfSize(4),
    previousFailedIn2: guidSetOfSize(5),
    previousFailedOut: guidSetOfSize(4),
    previousFailedOut2: guidSetOfSize(5),
    setup(engine) {
      // Make sure it works for consecutive writes before the callback is
      // executed.
      engine.previousFailedIn = this.previousFailedIn;
      Assert.equal(engine.previousFailedIn, this.previousFailedIn);
      engine.previousFailedOut = this.previousFailedOut;
      Assert.equal(engine.previousFailedOut, this.previousFailedOut);

      engine.previousFailedIn = this.previousFailedIn2;
      Assert.equal(engine.previousFailedIn, this.previousFailedIn2);
      engine.previousFailedOut = this.previousFailedOut2;
      Assert.equal(engine.previousFailedOut, this.previousFailedOut2);
    },
    check(engine) {
      assertSetsEqual(engine.previousFailedIn, this.previousFailedIn2);
      assertSetsEqual(engine.previousFailedOut, this.previousFailedOut2);
    },
  });

  await testSteamEngineStorage({
    previousFailedIn: guidSetOfSize(2),
    previousFailedOut: guidSetOfSize(2),
    async beforeCheck() {
      let previousFailedInPath = PathUtils.join(
        PathUtils.profileDir,
        "weave",
        "failed",
        "steam.json"
      );
      await IOUtils.writeJSON(previousFailedInPath, this.previousFailedIn, {
        tmpPath: previousFailedInPath + ".tmp",
      });

      let previousFailedOutPath = PathUtils.join(
        PathUtils.profileDir,
        "weave",
        "failedOut",
        "steam.json"
      );
      await IOUtils.writeJSON(previousFailedOutPath, this.previousFailedOut, {
        tmpPath: previousFailedOutPath + ".tmp",
      });
    },
    check(engine) {
      // Read file from disk
      assertSetsEqual(engine.previousFailedIn, this.previousFailedIn);
      assertSetsEqual(engine.previousFailedOut, this.previousFailedOut);
    },
  });
});

add_task(async function test_resetClient() {
  _("SyncEngine.resetClient resets lastSync and toFetch");
  await SyncTestingInfrastructure(server);
  let engine = await makeSteamEngine();
  try {
    // Ensure pristine environment
    Assert.equal(
      Svc.PrefBranch.getPrefType("steam.lastSync"),
      Ci.nsIPrefBranch.PREF_INVALID
    );
    Assert.equal(engine.toFetch.size, 0);

    await engine.setLastSync(123.45);
    engine.toFetch = guidSetOfSize(4);
    engine.previousFailedIn = guidSetOfSize(3);
    engine.previousFailedOut = guidSetOfSize(3);

    await engine.resetClient();
    Assert.equal(await engine.getLastSync(), 0);
    Assert.equal(engine.toFetch.size, 0);
    Assert.equal(engine.previousFailedIn.size, 0);
    Assert.equal(engine.previousFailedOut.size, 0);
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});

add_task(async function test_wipeServer() {
  _("SyncEngine.wipeServer deletes server data and resets the client.");
  let engine = await makeSteamEngine();

  const PAYLOAD = 42;
  let steamCollection = new ServerWBO("steam", PAYLOAD);
  let steamServer = httpd_setup({
    "/1.1/foo/storage/steam": steamCollection.handler(),
  });
  await SyncTestingInfrastructure(steamServer);
  do_test_pending();

  try {
    // Some data to reset.
    await engine.setLastSync(123.45);
    engine.toFetch = guidSetOfSize(3);

    _("Wipe server data and reset client.");
    await engine.wipeServer();
    Assert.equal(steamCollection.payload, undefined);
    Assert.equal(await engine.getLastSync(), 0);
    Assert.equal(engine.toFetch.size, 0);
  } finally {
    steamServer.stop(do_test_finished);
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});

add_task(async function finish() {
  await promiseStopServer(server);
});
