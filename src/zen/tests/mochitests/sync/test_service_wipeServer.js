Svc.PrefBranch.setStringPref("registerEngines", "");
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

// configure the identity we use for this test.
const identityConfig = makeIdentityConfig({ username: "johndoe" });

function FakeCollection() {
  this.deleted = false;
}
FakeCollection.prototype = {
  handler() {
    let self = this;
    return function (request, response) {
      let body = "";
      self.timestamp = new_timestamp();
      let timestamp = "" + self.timestamp;
      if (request.method == "DELETE") {
        body = timestamp;
        self.deleted = true;
      }
      response.setHeader("X-Weave-Timestamp", timestamp);
      response.setStatusLine(request.httpVersion, 200, "OK");
      response.bodyOutputStream.write(body, body.length);
    };
  },
};

async function setUpTestFixtures(server) {
  Service.clusterURL = server.baseURI + "/";

  await configureIdentity(identityConfig);
}

add_task(async function test_wipeServer_list_success() {
  _("Service.wipeServer() deletes collections given as argument.");

  let steam_coll = new FakeCollection();
  let diesel_coll = new FakeCollection();

  let server = httpd_setup({
    "/1.1/johndoe/storage/steam": steam_coll.handler(),
    "/1.1/johndoe/storage/diesel": diesel_coll.handler(),
    "/1.1/johndoe/storage/petrol": httpd_handler(404, "Not Found"),
  });

  try {
    await setUpTestFixtures(server);
    await SyncTestingInfrastructure(server, "johndoe", "irrelevant");

    _("Confirm initial environment.");
    Assert.ok(!steam_coll.deleted);
    Assert.ok(!diesel_coll.deleted);

    _(
      "wipeServer() will happily ignore the non-existent collection and use the timestamp of the last DELETE that was successful."
    );
    let timestamp = await Service.wipeServer(["steam", "diesel", "petrol"]);
    Assert.equal(timestamp, diesel_coll.timestamp);

    _(
      "wipeServer stopped deleting after encountering an error with the 'petrol' collection, thus only 'steam' has been deleted."
    );
    Assert.ok(steam_coll.deleted);
    Assert.ok(diesel_coll.deleted);
  } finally {
    await promiseStopServer(server);
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});

add_task(async function test_wipeServer_list_503() {
  _("Service.wipeServer() deletes collections given as argument.");

  let steam_coll = new FakeCollection();
  let diesel_coll = new FakeCollection();

  let server = httpd_setup({
    "/1.1/johndoe/storage/steam": steam_coll.handler(),
    "/1.1/johndoe/storage/petrol": httpd_handler(503, "Service Unavailable"),
    "/1.1/johndoe/storage/diesel": diesel_coll.handler(),
  });

  try {
    await setUpTestFixtures(server);
    await SyncTestingInfrastructure(server, "johndoe", "irrelevant");

    _("Confirm initial environment.");
    Assert.ok(!steam_coll.deleted);
    Assert.ok(!diesel_coll.deleted);

    _(
      "wipeServer() will happily ignore the non-existent collection, delete the 'steam' collection and abort after an receiving an error on the 'petrol' collection."
    );
    let error;
    try {
      await Service.wipeServer(["non-existent", "steam", "petrol", "diesel"]);
      do_throw("Should have thrown!");
    } catch (ex) {
      error = ex;
    }
    _("wipeServer() threw this exception: " + error);
    Assert.equal(error.status, 503);

    _(
      "wipeServer stopped deleting after encountering an error with the 'petrol' collection, thus only 'steam' has been deleted."
    );
    Assert.ok(steam_coll.deleted);
    Assert.ok(!diesel_coll.deleted);
  } finally {
    await promiseStopServer(server);
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});

add_task(async function test_wipeServer_all_success() {
  _("Service.wipeServer() deletes all the things.");

  /**
   * Handle the bulk DELETE request sent by wipeServer.
   */
  let deleted = false;
  let serverTimestamp;
  function storageHandler(request, response) {
    Assert.equal("DELETE", request.method);
    Assert.ok(request.hasHeader("X-Confirm-Delete"));
    deleted = true;
    serverTimestamp = return_timestamp(request, response);
  }

  let server = httpd_setup({
    "/1.1/johndoe/storage": storageHandler,
  });
  await setUpTestFixtures(server);

  _("Try deletion.");
  await SyncTestingInfrastructure(server, "johndoe", "irrelevant");
  let returnedTimestamp = await Service.wipeServer();
  Assert.ok(deleted);
  Assert.equal(returnedTimestamp, serverTimestamp);

  await promiseStopServer(server);
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
});

add_task(async function test_wipeServer_all_404() {
  _("Service.wipeServer() accepts a 404.");

  /**
   * Handle the bulk DELETE request sent by wipeServer. Returns a 404.
   */
  let deleted = false;
  let serverTimestamp;
  function storageHandler(request, response) {
    Assert.equal("DELETE", request.method);
    Assert.ok(request.hasHeader("X-Confirm-Delete"));
    deleted = true;
    serverTimestamp = new_timestamp();
    response.setHeader("X-Weave-Timestamp", "" + serverTimestamp);
    response.setStatusLine(request.httpVersion, 404, "Not Found");
  }

  let server = httpd_setup({
    "/1.1/johndoe/storage": storageHandler,
  });
  await setUpTestFixtures(server);

  _("Try deletion.");
  await SyncTestingInfrastructure(server, "johndoe", "irrelevant");
  let returnedTimestamp = await Service.wipeServer();
  Assert.ok(deleted);
  Assert.equal(returnedTimestamp, serverTimestamp);

  await promiseStopServer(server);
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
});

add_task(async function test_wipeServer_all_503() {
  _("Service.wipeServer() throws if it encounters a non-200/404 response.");

  /**
   * Handle the bulk DELETE request sent by wipeServer. Returns a 503.
   */
  function storageHandler(request, response) {
    Assert.equal("DELETE", request.method);
    Assert.ok(request.hasHeader("X-Confirm-Delete"));
    response.setStatusLine(request.httpVersion, 503, "Service Unavailable");
  }

  let server = httpd_setup({
    "/1.1/johndoe/storage": storageHandler,
  });
  await setUpTestFixtures(server);

  _("Try deletion.");
  let error;
  try {
    await SyncTestingInfrastructure(server, "johndoe", "irrelevant");
    await Service.wipeServer();
    do_throw("Should have thrown!");
  } catch (ex) {
    error = ex;
  }
  Assert.equal(error.status, 503);

  await promiseStopServer(server);
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
});

add_task(async function test_wipeServer_all_connectionRefused() {
  _("Service.wipeServer() throws if it encounters a network problem.");
  let server = httpd_setup({});
  await setUpTestFixtures(server);

  Service.clusterURL = "http://localhost:4352/";

  _("Try deletion.");
  try {
    await Service.wipeServer();
    do_throw("Should have thrown!");
  } catch (ex) {
    Assert.equal(ex.result, Cr.NS_ERROR_CONNECTION_REFUSED);
  }

  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  await promiseStopServer(server);
});
