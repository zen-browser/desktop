/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { WBORecord, Collection } = ChromeUtils.importESModule(
  "resource://services-sync/record.sys.mjs"
);
const { Resource } = ChromeUtils.importESModule(
  "resource://services-sync/resource.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_test(function test_toJSON() {
  _("Create a record, for now without a TTL.");
  let wbo = new WBORecord("coll", "a_record");
  wbo.modified = 12345;
  wbo.sortindex = 42;
  wbo.payload = {};

  _(
    "Verify that the JSON representation contains the WBO properties, but not TTL."
  );
  let json = JSON.parse(JSON.stringify(wbo));
  Assert.equal(json.modified, 12345);
  Assert.equal(json.sortindex, 42);
  Assert.equal(json.payload, "{}");
  Assert.equal(false, "ttl" in json);

  _("Set a TTL, make sure it's present in the JSON representation.");
  wbo.ttl = 30 * 60;
  json = JSON.parse(JSON.stringify(wbo));
  Assert.equal(json.ttl, 30 * 60);
  run_next_test();
});

add_task(async function test_fetch() {
  let record = {
    id: "asdf-1234-asdf-1234",
    modified: 2454725.98283,
    payload: JSON.stringify({ cheese: "roquefort" }),
  };
  let record2 = {
    id: "record2",
    modified: 2454725.98284,
    payload: JSON.stringify({ cheese: "gruyere" }),
  };
  let coll = [
    {
      id: "record2",
      modified: 2454725.98284,
      payload: JSON.stringify({ cheese: "gruyere" }),
    },
  ];

  _("Setting up server.");
  let server = httpd_setup({
    "/record": httpd_handler(200, "OK", JSON.stringify(record)),
    "/record2": httpd_handler(200, "OK", JSON.stringify(record2)),
    "/coll": httpd_handler(200, "OK", JSON.stringify(coll)),
  });

  try {
    _("Fetching a WBO record");
    let rec = new WBORecord("coll", "record");
    await rec.fetch(Service.resource(server.baseURI + "/record"));
    Assert.equal(rec.id, "asdf-1234-asdf-1234"); // NOT "record"!

    Assert.equal(rec.modified, 2454725.98283);
    Assert.equal(typeof rec.payload, "object");
    Assert.equal(rec.payload.cheese, "roquefort");

    _("Fetching a WBO record using the record manager");
    let rec2 = await Service.recordManager.get(server.baseURI + "/record2");
    Assert.equal(rec2.id, "record2");
    Assert.equal(rec2.modified, 2454725.98284);
    Assert.equal(typeof rec2.payload, "object");
    Assert.equal(rec2.payload.cheese, "gruyere");
    Assert.equal(Service.recordManager.response.status, 200);

    // Testing collection extraction.
    _("Extracting collection.");
    let rec3 = new WBORecord("tabs", "foo"); // Create through constructor.
    Assert.equal(rec3.collection, "tabs");
  } finally {
    await promiseStopServer(server);
  }
});

class FakeService {
  constructor(storageURL) {
    this.storageURL = storageURL;
  }
  resource(uri) {
    // allow ease of ctor without auth.
    return new Resource(uri);
  }
}

add_task(async function test_collection_invalid_url_handling() {
  const service = new FakeService("http://example.com/storage/");

  // Invalid string: Resource will leave coll.uri === null
  const coll = new Collection("not-a-valid-url", WBORecord, service);

  // Verify the error reporting scenario is handled
  Assert.throws(() => {
    coll.full = true; // Triggers _rebuildURL
  }, /_rebuildURL called with null uri/);
});

add_task(async function test_wborecord_uri_makeURI_null() {
  let record = new WBORecord("tabs", "abc123");

  // Test that we get a helpful error when makeURI returns null
  Assert.throws(() => {
    record.uri("not-a-valid-base-url");
  }, /WBORecord\.uri\(\): makeURI returned null for base=/);
});
