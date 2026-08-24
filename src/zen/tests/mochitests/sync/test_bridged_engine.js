/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { BridgedEngine } = ChromeUtils.importESModule(
  "resource://services-sync/bridged_engine.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_task(async function test_interface() {
  class TestBridge {
    constructor() {
      this.storageVersion = 2;
      this.syncID = "syncID111111";
      this.clear();
    }

    clear() {
      this.lastSyncMillis = 0;
      this.wasSyncStarted = false;
      this.incomingEnvelopes = [];
      this.uploadedIDs = [];
      this.wasSyncFinished = false;
      this.wasReset = false;
      this.wasWiped = false;
    }

    // `mozIBridgedSyncEngine` methods.

    lastSync() {
      return this.lastSyncMillis;
    }

    setLastSync(millis) {
      this.lastSyncMillis = millis;
    }

    resetSyncId() {
      return this.syncID;
    }

    ensureCurrentSyncId(newSyncId) {
      equal(newSyncId, this.syncID, "Local and new sync IDs should match");
      return this.syncID;
    }

    syncStarted() {
      this.wasSyncStarted = true;
    }

    storeIncoming(envelopes) {
      this.incomingEnvelopes.push(...envelopes.map(r => JSON.parse(r)));
    }

    apply() {
      let outgoingEnvelopes = [
        {
          id: "hanson",
          data: {
            plants: ["seed", "flower 💐", "rose"],
            canYouTell: false,
          },
        },
        {
          id: "sheryl-crow",
          data: {
            today: "winding 🛣",
            tomorrow: "winding 🛣",
          },
        },
      ].map(cleartext =>
        JSON.stringify({
          id: cleartext.id,
          payload: JSON.stringify(cleartext),
        })
      );
      return outgoingEnvelopes;
    }

    setUploaded(millis, ids) {
      this.uploadedIDs.push(...ids);
    }

    syncFinished() {
      this.wasSyncFinished = true;
    }

    reset() {
      this.clear();
      this.wasReset = true;
    }

    wipe() {
      this.clear();
      this.wasWiped = true;
    }
  }

  let bridge = new TestBridge();
  let engine = new BridgedEngine("Nineties", Service);
  engine._bridge = bridge;
  engine.enabled = true;

  let server = await serverForFoo(engine);
  try {
    await SyncTestingInfrastructure(server);

    info("Add server records");
    let foo = server.user("foo");
    let collection = foo.collection("nineties");
    let now = new_timestamp();
    collection.insert(
      "backstreet",
      encryptPayload({
        id: "backstreet",
        data: {
          say: "I want it that way",
          when: "never",
        },
      }),
      now
    );
    collection.insert(
      "tlc",
      encryptPayload({
        id: "tlc",
        data: {
          forbidden: ["scrubs 🚫"],
          numberAvailable: false,
        },
      }),
      now + 5
    );

    info("Sync the engine");
    // Advance the last sync time to skip the Backstreet Boys...
    bridge.lastSyncMillis = 1000 * (now + 2);
    await sync_engine_and_validate_telem(engine, false);

    let metaGlobal = foo.collection("meta").wbo("global").get();
    deepEqual(
      JSON.parse(metaGlobal.payload).engines.nineties,
      {
        version: 2,
        syncID: "syncID111111",
      },
      "Should write storage version and sync ID to m/g"
    );

    greater(bridge.lastSyncMillis, 0, "Should update last sync time");
    ok(
      bridge.wasSyncStarted,
      "Should have started sync before storing incoming"
    );
    deepEqual(
      bridge.incomingEnvelopes
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(({ payload, ...envelope }) => ({
          cleartextAsObject: JSON.parse(payload),
          ...envelope,
        })),
      [
        {
          id: "tlc",
          modified: now + 5,
          cleartextAsObject: {
            id: "tlc",
            data: {
              forbidden: ["scrubs 🚫"],
              numberAvailable: false,
            },
          },
        },
      ],
      "Should stage incoming records from server"
    );
    deepEqual(
      bridge.uploadedIDs.sort(),
      ["hanson", "sheryl-crow"],
      "Should mark new local records as uploaded"
    );
    ok(bridge.wasSyncFinished, "Should have finished sync after uploading");

    deepEqual(
      collection.keys().sort(),
      ["backstreet", "hanson", "sheryl-crow", "tlc"],
      "Should have all records on server"
    );
    let expectedRecords = [
      {
        id: "sheryl-crow",
        data: {
          today: "winding 🛣",
          tomorrow: "winding 🛣",
        },
      },
      {
        id: "hanson",
        data: {
          plants: ["seed", "flower 💐", "rose"],
          canYouTell: false,
        },
      },
    ];
    for (let expected of expectedRecords) {
      let actual = collection.cleartext(expected.id);
      deepEqual(
        actual,
        expected,
        `Should upload record ${expected.id} from bridged engine`
      );
    }

    await engine.resetClient();
    ok(bridge.wasReset, "Should reset local storage for bridge");

    await engine.wipeClient();
    ok(bridge.wasWiped, "Should wipe local storage for bridge");

    await engine.resetSyncID();
    ok(
      !foo.collection("nineties"),
      "Should delete server collection after resetting sync ID"
    );
  } finally {
    await promiseStopServer(server);
    await engine.finalize();
  }
});
