/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

_("Test that node reassignment happens correctly using the FxA identity mgr.");
// The node-reassignment logic is quite different for FxA than for the legacy
// provider.  In particular, there's no special request necessary for
// reassignment - it comes from the token server - so we need to ensure the
// Fxa cluster manager grabs a new token.

const { RESTRequest } = ChromeUtils.importESModule(
  "resource://services-common/rest.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { Status } = ChromeUtils.importESModule(
  "resource://services-sync/status.sys.mjs"
);
const { SyncAuthManager } = ChromeUtils.importESModule(
  "resource://services-sync/sync_auth.sys.mjs"
);

add_task(async function setup() {
  // Disables all built-in engines. Important for avoiding errors thrown by the
  // add-ons engine.
  await Service.engineManager.clear();

  // Setup the sync auth manager.
  Status.__authManager = Service.identity = new SyncAuthManager();
});

// API-compatible with SyncServer handler. Bind `handler` to something to use
// as a ServerCollection handler.
function handleReassign(handler, req, resp) {
  resp.setStatusLine(req.httpVersion, 401, "Node reassignment");
  resp.setHeader("Content-Type", "application/json");
  let reassignBody = JSON.stringify({ error: "401inator in place" });
  resp.bodyOutputStream.write(reassignBody, reassignBody.length);
}

var numTokenRequests = 0;

function prepareServer(cbAfterTokenFetch) {
  syncTestLogging();
  let config = makeIdentityConfig({ username: "johndoe" });
  // A server callback to ensure we don't accidentally hit the wrong endpoint
  // after a node reassignment.
  let callback = {
    onRequest(req) {
      let full = `${req.scheme}://${req.host}:${req.port}${req.path}`;
      let expected = config.fxaccount.token.endpoint;
      Assert.ok(
        full.startsWith(expected),
        `request made to ${full}, expected ${expected}`
      );
    },
  };
  Object.setPrototypeOf(callback, SyncServerCallback);
  let server = new SyncServer(callback);
  server.registerUser("johndoe");
  server.start();

  // Set the token endpoint for the initial token request that's done implicitly
  // via configureIdentity.
  config.fxaccount.token.endpoint = server.baseURI + "1.1/johndoe/";
  // And future token fetches will do magic around numReassigns.
  let numReassigns = 0;
  return configureIdentity(config).then(() => {
    Service.identity._tokenServerClient = {
      getTokenUsingOAuth() {
        return new Promise(res => {
          // Build a new URL with trailing zeros for the SYNC_VERSION part - this
          // will still be seen as equivalent by the test server, but different
          // by sync itself.
          numReassigns += 1;
          let trailingZeros = new Array(numReassigns + 1).join("0");
          let token = config.fxaccount.token;
          token.endpoint = server.baseURI + "1.1" + trailingZeros + "/johndoe";
          token.uid = config.username;
          _(`test server saw token fetch - endpoint now ${token.endpoint}`);
          numTokenRequests += 1;
          res(token);
          if (cbAfterTokenFetch) {
            cbAfterTokenFetch();
          }
        });
      },
    };
    return server;
  });
}

function getReassigned() {
  try {
    return Services.prefs.getBoolPref("services.sync.lastSyncReassigned");
  } catch (ex) {
    if (ex.result != Cr.NS_ERROR_UNEXPECTED) {
      do_throw(
        "Got exception retrieving lastSyncReassigned: " + Log.exceptionStr(ex)
      );
    }
  }
  return false;
}

/**
 * Make a test request to `url`, then watch the result of two syncs
 * to ensure that a node request was made.
 * Runs `between` between the two. This can be used to undo deliberate failure
 * setup, detach observers, etc.
 */
async function syncAndExpectNodeReassignment(
  server,
  firstNotification,
  between,
  secondNotification,
  url
) {
  _("Starting syncAndExpectNodeReassignment\n");
  let deferred = Promise.withResolvers();
  async function onwards() {
    let numTokenRequestsBefore;
    function onFirstSync() {
      _("First sync completed.");
      Svc.Obs.remove(firstNotification, onFirstSync);
      Svc.Obs.add(secondNotification, onSecondSync);

      Assert.equal(Service.clusterURL, "");

      // Track whether we fetched a new token.
      numTokenRequestsBefore = numTokenRequests;

      // Allow for tests to clean up error conditions.
      between();
    }
    function onSecondSync() {
      _("Second sync completed.");
      Svc.Obs.remove(secondNotification, onSecondSync);
      Service.scheduler.clearSyncTriggers();

      // Make absolutely sure that any event listeners are done with their work
      // before we proceed.
      waitForZeroTimer(function () {
        _("Second sync nextTick.");
        Assert.equal(
          numTokenRequests,
          numTokenRequestsBefore + 1,
          "fetched a new token"
        );
        Service.startOver().then(() => {
          server.stop(deferred.resolve);
        });
      });
    }

    Svc.Obs.add(firstNotification, onFirstSync);
    await Service.sync();
  }

  // Make sure that we really do get a 401 (but we can only do that if we are
  // already logged in, as the login process is what sets up the URLs)
  if (Service.isLoggedIn) {
    _("Making request to " + url + " which should 401");
    let request = new RESTRequest(url);
    await request.get();
    Assert.equal(request.response.status, 401);
    CommonUtils.nextTick(onwards);
  } else {
    _("Skipping preliminary validation check for a 401 as we aren't logged in");
    CommonUtils.nextTick(onwards);
  }
  await deferred.promise;
}

// Check that when we sync we don't request a new token by default - our
// test setup has configured the client with a valid token, and that token
// should be used to form the cluster URL.
add_task(async function test_single_token_fetch() {
  enableValidationPrefs();

  _("Test a normal sync only fetches 1 token");

  let numTokenFetches = 0;

  function afterTokenFetch() {
    numTokenFetches++;
  }

  // Set the cluster URL to an "old" version - this is to ensure we don't
  // use that old cached version for the first sync but prefer the value
  // we got from the token (and as above, we are also checking we don't grab
  // a new token). If the test actually attempts to connect to this URL
  // it will crash.
  Service.clusterURL = "http://example.com/";

  let server = await prepareServer(afterTokenFetch);

  Assert.ok(!Service.isLoggedIn, "not already logged in");
  await Service.sync();
  Assert.equal(Status.sync, SYNC_SUCCEEDED, "sync succeeded");
  Assert.equal(numTokenFetches, 0, "didn't fetch a new token");
  // A bit hacky, but given we know how prepareServer works we can deduce
  // that clusterURL we expect.
  let expectedClusterURL = server.baseURI + "1.1/johndoe/";
  Assert.equal(Service.clusterURL, expectedClusterURL);
  await Service.startOver();
  await promiseStopServer(server);
});

add_task(async function test_momentary_401_engine() {
  enableValidationPrefs();

  _("Test a failure for engine URLs that's resolved by reassignment.");
  let server = await prepareServer();
  let john = server.user("johndoe");

  _("Enabling the Rotary engine.");
  let { engine, syncID, tracker } = await registerRotaryEngine();

  // We need the server to be correctly set up prior to experimenting. Do this
  // through a sync.
  let global = {
    syncID: Service.syncID,
    storageVersion: STORAGE_VERSION,
    rotary: { version: engine.version, syncID },
  };
  john.createCollection("meta").insert("global", global);

  _("First sync to prepare server contents.");
  await Service.sync();

  _("Setting up Rotary collection to 401.");
  let rotary = john.createCollection("rotary");
  let oldHandler = rotary.collectionHandler;
  rotary.collectionHandler = handleReassign.bind(this, undefined);

  // We want to verify that the clusterURL pref has been cleared after a 401
  // inside a sync. Flag the Rotary engine to need syncing.
  john.collection("rotary").timestamp += 1000;

  function between() {
    _("Undoing test changes.");
    rotary.collectionHandler = oldHandler;

    function onLoginStart() {
      // lastSyncReassigned shouldn't be cleared until a sync has succeeded.
      _("Ensuring that lastSyncReassigned is still set at next sync start.");
      Svc.Obs.remove("weave:service:login:start", onLoginStart);
      Assert.ok(getReassigned());
    }

    _("Adding observer that lastSyncReassigned is still set on login.");
    Svc.Obs.add("weave:service:login:start", onLoginStart);
  }

  await syncAndExpectNodeReassignment(
    server,
    "weave:service:sync:finish",
    between,
    "weave:service:sync:finish",
    Service.storageURL + "rotary"
  );

  await tracker.clearChangedIDs();
  await Service.engineManager.unregister(engine);
});

// This test ends up being a failing info fetch *after we're already logged in*.
add_task(async function test_momentary_401_info_collections_loggedin() {
  enableValidationPrefs();

  _(
    "Test a failure for info/collections after login that's resolved by reassignment."
  );
  let server = await prepareServer();

  _("First sync to prepare server contents.");
  await Service.sync();

  _("Arrange for info/collections to return a 401.");
  let oldHandler = server.toplevelHandlers.info;
  server.toplevelHandlers.info = handleReassign;

  function undo() {
    _("Undoing test changes.");
    server.toplevelHandlers.info = oldHandler;
  }

  Assert.ok(Service.isLoggedIn, "already logged in");

  await syncAndExpectNodeReassignment(
    server,
    "weave:service:sync:error",
    undo,
    "weave:service:sync:finish",
    Service.infoURL
  );
});

// This test ends up being a failing info fetch *before we're logged in*.
// In this case we expect to recover during the login phase - so the first
// sync succeeds.
add_task(async function test_momentary_401_info_collections_loggedout() {
  enableValidationPrefs();

  _(
    "Test a failure for info/collections before login that's resolved by reassignment."
  );

  let oldHandler;
  let sawTokenFetch = false;

  function afterTokenFetch() {
    // After a single token fetch, we undo our evil handleReassign hack, so
    // the next /info request returns the collection instead of a 401
    server.toplevelHandlers.info = oldHandler;
    sawTokenFetch = true;
  }

  let server = await prepareServer(afterTokenFetch);

  // Return a 401 for the next /info request - it will be reset immediately
  // after a new token is fetched.
  oldHandler = server.toplevelHandlers.info;
  server.toplevelHandlers.info = handleReassign;

  Assert.ok(!Service.isLoggedIn, "not already logged in");

  await Service.sync();
  Assert.equal(Status.sync, SYNC_SUCCEEDED, "sync succeeded");
  // sync was successful - check we grabbed a new token.
  Assert.ok(sawTokenFetch, "a new token was fetched by this test.");
  // and we are done.
  await Service.startOver();
  await promiseStopServer(server);
});

// This test ends up being a failing meta/global fetch *after we're already logged in*.
add_task(async function test_momentary_401_storage_loggedin() {
  enableValidationPrefs();

  _(
    "Test a failure for any storage URL after login that's resolved by" +
      "reassignment."
  );
  let server = await prepareServer();

  _("First sync to prepare server contents.");
  await Service.sync();

  _("Arrange for meta/global to return a 401.");
  let oldHandler = server.toplevelHandlers.storage;
  server.toplevelHandlers.storage = handleReassign;

  function undo() {
    _("Undoing test changes.");
    server.toplevelHandlers.storage = oldHandler;
  }

  Assert.ok(Service.isLoggedIn, "already logged in");

  await syncAndExpectNodeReassignment(
    server,
    "weave:service:sync:error",
    undo,
    "weave:service:sync:finish",
    Service.storageURL + "meta/global"
  );
});

// This test ends up being a failing meta/global fetch *before we've logged in*.
add_task(async function test_momentary_401_storage_loggedout() {
  enableValidationPrefs();

  _(
    "Test a failure for any storage URL before login, not just engine parts. " +
      "Resolved by reassignment."
  );
  let server = await prepareServer();

  // Return a 401 for all storage requests.
  let oldHandler = server.toplevelHandlers.storage;
  server.toplevelHandlers.storage = handleReassign;

  function undo() {
    _("Undoing test changes.");
    server.toplevelHandlers.storage = oldHandler;
  }

  Assert.ok(!Service.isLoggedIn, "already logged in");

  await syncAndExpectNodeReassignment(
    server,
    "weave:service:login:error",
    undo,
    "weave:service:sync:finish",
    Service.storageURL + "meta/global"
  );
});
