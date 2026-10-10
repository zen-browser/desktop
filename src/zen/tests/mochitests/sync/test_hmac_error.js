/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

// Track HMAC error counts.
var hmacErrorCount = 0;
(function () {
  let hHE = Service.handleHMACEvent;
  Service.handleHMACEvent = async function () {
    hmacErrorCount++;
    return hHE.call(Service);
  };
})();

async function shared_setup() {
  enableValidationPrefs();
  syncTestLogging();

  hmacErrorCount = 0;

  let clientsEngine = Service.clientsEngine;
  let clientsSyncID = await clientsEngine.resetLocalSyncID();

  // Make sure RotaryEngine is the only one we sync.
  let { engine, syncID, tracker } = await registerRotaryEngine();
  await engine.setLastSync(123); // Needs to be non-zero so that tracker is queried.
  engine._store.items = {
    flying: "LNER Class A3 4472",
    scotsman: "Flying Scotsman",
  };
  await tracker.addChangedID("scotsman", 0);
  Assert.equal(1, Service.engineManager.getEnabled().length);

  let engines = {
    rotary: { version: engine.version, syncID },
    clients: { version: clientsEngine.version, syncID: clientsSyncID },
  };

  // Common server objects.
  let global = new ServerWBO("global", { engines });
  let keysWBO = new ServerWBO("keys");
  let rotaryColl = new ServerCollection({}, true);
  let clientsColl = new ServerCollection({}, true);

  return [engine, rotaryColl, clientsColl, keysWBO, global, tracker];
}

add_task(async function hmac_error_during_404() {
  _("Attempt to replicate the HMAC error setup.");
  let [engine, rotaryColl, clientsColl, keysWBO, global, tracker] =
    await shared_setup();

  // Hand out 404s for crypto/keys.
  let keysHandler = keysWBO.handler();
  let key404Counter = 0;
  let keys404Handler = function (request, response) {
    if (key404Counter > 0) {
      let body = "Not Found";
      response.setStatusLine(request.httpVersion, 404, body);
      response.bodyOutputStream.write(body, body.length);
      key404Counter--;
      return;
    }
    keysHandler(request, response);
  };

  let collectionsHelper = track_collections_helper();
  let upd = collectionsHelper.with_updated_collection;
  let handlers = {
    "/1.1/foo/info/collections": collectionsHelper.handler,
    "/1.1/foo/storage/meta/global": upd("meta", global.handler()),
    "/1.1/foo/storage/crypto/keys": upd("crypto", keys404Handler),
    "/1.1/foo/storage/clients": upd("clients", clientsColl.handler()),
    "/1.1/foo/storage/rotary": upd("rotary", rotaryColl.handler()),
  };

  let server = sync_httpd_setup(handlers);
  // Do not instantiate SyncTestingInfrastructure; we need real crypto.
  await configureIdentity({ username: "foo" }, server);
  await Service.login();

  try {
    _("Syncing.");
    await sync_and_validate_telem();

    _(
      "Partially resetting client, as if after a restart, and forcing redownload."
    );
    Service.collectionKeys.clear();
    await engine.setLastSync(0); // So that we redownload records.
    key404Counter = 1;
    _("---------------------------");
    await sync_and_validate_telem();
    _("---------------------------");

    // Two rotary items, one client record... no errors.
    Assert.equal(hmacErrorCount, 0);
  } finally {
    await tracker.clearChangedIDs();
    await Service.engineManager.unregister(engine);
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
    Service.recordManager.clearCache();
    await promiseStopServer(server);
  }
});

add_task(async function hmac_error_during_node_reassignment() {
  _("Attempt to replicate an HMAC error during node reassignment.");
  let [engine, rotaryColl, clientsColl, keysWBO, global, tracker] =
    await shared_setup();

  let collectionsHelper = track_collections_helper();
  let upd = collectionsHelper.with_updated_collection;

  // We'll provide a 401 mid-way through the sync. This function
  // simulates shifting to a node which has no data.
  function on401() {
    _("Deleting server data...");
    global.delete();
    rotaryColl.delete();
    keysWBO.delete();
    clientsColl.delete();
    delete collectionsHelper.collections.rotary;
    delete collectionsHelper.collections.crypto;
    delete collectionsHelper.collections.clients;
    _("Deleted server data.");
  }

  let should401 = false;
  function upd401(coll, handler) {
    return function (request, response) {
      if (should401 && request.method != "DELETE") {
        on401();
        should401 = false;
        let body = '"reassigned!"';
        response.setStatusLine(request.httpVersion, 401, "Node reassignment.");
        response.bodyOutputStream.write(body, body.length);
        return;
      }
      handler(request, response);
    };
  }

  let handlers = {
    "/1.1/foo/info/collections": collectionsHelper.handler,
    "/1.1/foo/storage/meta/global": upd("meta", global.handler()),
    "/1.1/foo/storage/crypto/keys": upd("crypto", keysWBO.handler()),
    "/1.1/foo/storage/clients": upd401("clients", clientsColl.handler()),
    "/1.1/foo/storage/rotary": upd("rotary", rotaryColl.handler()),
  };

  let server = sync_httpd_setup(handlers);
  // Do not instantiate SyncTestingInfrastructure; we need real crypto.
  await configureIdentity({ username: "foo" }, server);

  _("Syncing.");
  // First hit of clients will 401. This will happen after meta/global and
  // keys -- i.e., in the middle of the sync, but before RotaryEngine.
  should401 = true;

  // Use observers to perform actions when our sync finishes.
  // This allows us to observe the automatic next-tick sync that occurs after
  // an abort.
  function onSyncError() {
    do_throw("Should not get a sync error!");
  }
  let onSyncFinished = function () {};
  let obs = {
    observe: function observe(subject, topic) {
      switch (topic) {
        case "weave:service:sync:error":
          onSyncError();
          break;
        case "weave:service:sync:finish":
          onSyncFinished();
          break;
      }
    },
  };

  Svc.Obs.add("weave:service:sync:finish", obs);
  Svc.Obs.add("weave:service:sync:error", obs);

  // This kicks off the actual test. Split into a function here to allow this
  // source file to broadly follow actual execution order.
  async function onwards() {
    _("== Invoking first sync.");
    await Service.sync();
    _("We should not simultaneously have data but no keys on the server.");
    let hasData = rotaryColl.wbo("flying") || rotaryColl.wbo("scotsman");
    let hasKeys = keysWBO.modified;

    _("We correctly handle 401s by aborting the sync and starting again.");
    Assert.equal(!hasData, !hasKeys);

    _("Be prepared for the second (automatic) sync...");
  }

  _("Make sure that syncing again causes recovery.");
  let callbacksPromise = new Promise(resolve => {
    onSyncFinished = function () {
      _("== First sync done.");
      _("---------------------------");
      onSyncFinished = function () {
        _("== Second (automatic) sync done.");
        let hasData = rotaryColl.wbo("flying") || rotaryColl.wbo("scotsman");
        let hasKeys = keysWBO.modified;
        Assert.equal(!hasData, !hasKeys);

        // Kick off another sync. Can't just call it, because we're inside the
        // lock...
        (async () => {
          await Async.promiseYield();
          _("Now a fresh sync will get no HMAC errors.");
          _(
            "Partially resetting client, as if after a restart, and forcing redownload."
          );
          Service.collectionKeys.clear();
          await engine.setLastSync(0);
          hmacErrorCount = 0;

          onSyncFinished = async function () {
            // Two rotary items, one client record... no errors.
            Assert.equal(hmacErrorCount, 0);

            Svc.Obs.remove("weave:service:sync:finish", obs);
            Svc.Obs.remove("weave:service:sync:error", obs);

            await tracker.clearChangedIDs();
            await Service.engineManager.unregister(engine);
            for (const pref of Svc.PrefBranch.getChildList("")) {
              Svc.PrefBranch.clearUserPref(pref);
            }
            Service.recordManager.clearCache();
            server.stop(resolve);
          };

          Service.sync();
        })().catch(console.error);
      };
    };
  });
  await onwards();
  await callbacksPromise;
});
