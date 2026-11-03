/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

add_test(function test_creation() {
  // Explicit callback for this one.
  let server = new SyncServer(Object.create(SyncServerCallback));
  Assert.ok(!!server); // Just so we have a check.
  server.start(null, function () {
    _("Started on " + server.port);
    server.stop(run_next_test);
  });
});

add_test(function test_url_parsing() {
  let server = new SyncServer();

  // Check that we can parse a WBO URI.
  let parts = server.pathRE.exec("/1.1/johnsmith/storage/crypto/keys");
  let [all, version, username, first, rest] = parts;
  Assert.equal(all, "/1.1/johnsmith/storage/crypto/keys");
  Assert.equal(version, "1.1");
  Assert.equal(username, "johnsmith");
  Assert.equal(first, "storage");
  Assert.equal(rest, "crypto/keys");
  Assert.equal(null, server.pathRE.exec("/nothing/else"));

  // Check that we can parse a collection URI.
  parts = server.pathRE.exec("/1.1/johnsmith/storage/crypto");
  [all, version, username, first, rest] = parts;
  Assert.equal(all, "/1.1/johnsmith/storage/crypto");
  Assert.equal(version, "1.1");
  Assert.equal(username, "johnsmith");
  Assert.equal(first, "storage");
  Assert.equal(rest, "crypto");

  // We don't allow trailing slash on storage URI.
  parts = server.pathRE.exec("/1.1/johnsmith/storage/");
  Assert.equal(parts, undefined);

  // storage alone is a valid request.
  parts = server.pathRE.exec("/1.1/johnsmith/storage");
  [all, version, username, first, rest] = parts;
  Assert.equal(all, "/1.1/johnsmith/storage");
  Assert.equal(version, "1.1");
  Assert.equal(username, "johnsmith");
  Assert.equal(first, "storage");
  Assert.equal(rest, undefined);

  parts = server.storageRE.exec("storage");
  let collection;
  [all, , collection] = parts;
  Assert.equal(all, "storage");
  Assert.equal(collection, undefined);

  run_next_test();
});

const { RESTRequest } = ChromeUtils.importESModule(
  "resource://services-common/rest.sys.mjs"
);
function localRequest(server, path) {
  _("localRequest: " + path);
  let url = server.baseURI.substr(0, server.baseURI.length - 1) + path;
  _("url: " + url);
  return new RESTRequest(url);
}

add_task(async function test_basic_http() {
  let server = new SyncServer();
  server.registerUser("john", "password");
  Assert.ok(server.userExists("john"));
  server.start();
  _("Started on " + server.port);

  let req = localRequest(server, "/1.1/john/storage/crypto/keys");
  _("req is " + req);
  // Shouldn't reject, beyond that we don't care.
  await req.get();

  await promiseStopServer(server);
});

add_task(async function test_info_collections() {
  let server = new SyncServer(Object.create(SyncServerCallback));
  function responseHasCorrectHeaders(r) {
    Assert.equal(r.status, 200);
    Assert.equal(r.headers["content-type"], "application/json");
    Assert.ok("x-weave-timestamp" in r.headers);
  }

  server.registerUser("john", "password");
  server.start();

  let req = localRequest(server, "/1.1/john/info/collections");
  await req.get();
  responseHasCorrectHeaders(req.response);
  Assert.equal(req.response.body, "{}");

  let putReq = localRequest(server, "/1.1/john/storage/crypto/keys");
  let payload = JSON.stringify({ foo: "bar" });
  let putResp = await putReq.put(payload);

  responseHasCorrectHeaders(putResp);

  let putResponseBody = putResp.body;
  _("PUT response body: " + JSON.stringify(putResponseBody));

  // When we PUT something to crypto/keys, "crypto" appears in the response.
  req = localRequest(server, "/1.1/john/info/collections");

  await req.get();
  responseHasCorrectHeaders(req.response);
  let expectedColl = server.getCollection("john", "crypto");
  Assert.ok(!!expectedColl);
  let modified = expectedColl.timestamp;
  Assert.greater(modified, 0);
  Assert.equal(putResponseBody, modified);
  Assert.equal(JSON.parse(req.response.body).crypto, modified);

  await promiseStopServer(server);
});

add_task(async function test_storage_request() {
  let keysURL = "/1.1/john/storage/crypto/keys?foo=bar";
  let foosURL = "/1.1/john/storage/crypto/foos";
  let storageURL = "/1.1/john/storage";

  let server = new SyncServer();
  let creation = server.timestamp();
  server.registerUser("john", "password");

  server.createContents("john", {
    crypto: { foos: { foo: "bar" } },
  });
  let coll = server.user("john").collection("crypto");
  Assert.ok(!!coll);

  _("We're tracking timestamps.");
  Assert.greaterOrEqual(coll.timestamp, creation);

  async function retrieveWBONotExists() {
    let req = localRequest(server, keysURL);
    let response = await req.get();
    _("Body is " + response.body);
    _("Modified is " + response.newModified);
    Assert.equal(response.status, 404);
    Assert.equal(response.body, "Not found");
  }

  async function retrieveWBOExists() {
    let req = localRequest(server, foosURL);
    let response = await req.get();
    _("Body is " + response.body);
    _("Modified is " + response.newModified);
    let parsedBody = JSON.parse(response.body);
    Assert.equal(parsedBody.id, "foos");
    Assert.equal(parsedBody.modified, coll.wbo("foos").modified);
    Assert.equal(JSON.parse(parsedBody.payload).foo, "bar");
  }

  async function deleteWBONotExists() {
    let req = localRequest(server, keysURL);
    server.callback.onItemDeleted = function () {
      do_throw("onItemDeleted should not have been called.");
    };

    let response = await req.delete();

    _("Body is " + response.body);
    _("Modified is " + response.newModified);
    Assert.equal(response.status, 200);
    delete server.callback.onItemDeleted;
  }

  async function deleteWBOExists() {
    let req = localRequest(server, foosURL);
    server.callback.onItemDeleted = function (username, collection, wboID) {
      _("onItemDeleted called for " + collection + "/" + wboID);
      delete server.callback.onItemDeleted;
      Assert.equal(username, "john");
      Assert.equal(collection, "crypto");
      Assert.equal(wboID, "foos");
    };
    await req.delete();
    _("Body is " + req.response.body);
    _("Modified is " + req.response.newModified);
    Assert.equal(req.response.status, 200);
  }

  async function deleteStorage() {
    _("Testing DELETE on /storage.");
    let now = server.timestamp();
    _("Timestamp: " + now);
    let req = localRequest(server, storageURL);
    await req.delete();

    _("Body is " + req.response.body);
    _("Modified is " + req.response.newModified);
    let parsedBody = JSON.parse(req.response.body);
    Assert.greaterOrEqual(parsedBody, now);
    do_check_empty(server.users.john.collections);
  }

  async function getStorageFails() {
    _("Testing that GET on /storage fails.");
    let req = localRequest(server, storageURL);
    await req.get();
    Assert.equal(req.response.status, 405);
    Assert.equal(req.response.headers.allow, "DELETE");
  }

  async function getMissingCollectionWBO() {
    _("Testing that fetching a WBO from an on-existent collection 404s.");
    let req = localRequest(server, storageURL + "/foobar/baz");
    await req.get();
    Assert.equal(req.response.status, 404);
  }

  server.start(null);

  await retrieveWBONotExists();
  await retrieveWBOExists();
  await deleteWBOExists();
  await deleteWBONotExists();
  await getStorageFails();
  await getMissingCollectionWBO();
  await deleteStorage();

  await promiseStopServer(server);
});

add_task(async function test_x_weave_records() {
  let server = new SyncServer();
  server.registerUser("john", "password");

  server.createContents("john", {
    crypto: { foos: { foo: "bar" }, bars: { foo: "baz" } },
  });
  server.start();

  let wbo = localRequest(server, "/1.1/john/storage/crypto/foos");
  await wbo.get();
  Assert.equal(false, "x-weave-records" in wbo.response.headers);
  let col = localRequest(server, "/1.1/john/storage/crypto");
  await col.get();
  // Collection fetches do.
  Assert.equal(col.response.headers["x-weave-records"], "2");

  await promiseStopServer(server);
});
