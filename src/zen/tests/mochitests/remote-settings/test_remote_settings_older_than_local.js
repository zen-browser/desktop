const PREF_SETTINGS_SERVER = "services.settings.server";

let server;
let client;

async function clear_state() {
  await client.db.clear();
}

function setJSONResponse(response, changeset) {
  response.setStatusLine(null, 200, "OK");
  response.setHeader("Content-Type", "application/json; charset=UTF-8");
  response.setHeader("Date", new Date().toUTCString());
  response.write(JSON.stringify(changeset));
}

add_setup(() => {
  Services.prefs.setStringPref("services.settings.loglevel", "debug");

  // Set up an HTTP Server
  server = new HttpServer();
  server.start(-1);

  Services.prefs.setStringPref(
    PREF_SETTINGS_SERVER,
    `http://localhost:${server.identity.primaryPort}/v1`
  );

  client = RemoteSettings("some-cid");

  const bodies = {
    // First successful sync at timestamp=333
    "/v1/buckets/main/collections/some-cid/changeset?_expected=333": {
      timestamp: 333,
      metadata: {
        signatures: [{ signature: "abc", x5u: "data:text/plain;base64,pem" }],
      },
      changes: [
        { id: "rid2", last_modified: 22 },
        { id: "rid1", last_modified: 11 },
      ],
    },
    // Client fetches with _expected=222&_since=333
    "/v1/buckets/main/collections/some-cid/changeset?_expected=222&_since=333":
      {
        timestamp: 222,
        metadata: {
          signatures: [{ signature: "ghi", x5u: "data:text/plain;base64,pem" }],
        },
        changes: [{ id: "rid1", last_modified: 11 }],
      },
    // Client refetches full collection with _expected=222 after signature fails.
    "/v1/buckets/main/collections/some-cid/changeset?_expected=222": {
      timestamp: 222,
      metadata: {
        signatures: [{ signature: "ghi", x5u: "data:text/plain;base64,pem" }],
      },
      changes: [{ id: "rid1", last_modified: 11 }],
    },
  };
  const handler = (request, response) => {
    const body = bodies[`${request.path}?${request.queryString}`];
    if (!body) {
      const err = new Error(
        `Unexpected request ${request.path}?${request.queryString}`
      );
      console.error(err);
      throw err;
    }
    setJSONResponse(response, body);
  };
  Object.keys(bodies).map(path =>
    server.registerPathHandler(path.split("?")[0], handler)
  );

  // In this test suite, the only valid data is the one at timestamp=222 or timestamp=333, but not a mix of the two.
  let backup = client._verifier;
  client._verifier = {
    asyncVerifyContentSignature: serialized => {
      return (
        serialized ==
          '{"data":[{"id":"rid2","last_modified":22}],"last_modified":"444"}' ||
        serialized ==
          '{"data":[{"id":"rid1","last_modified":11},{"id":"rid2","last_modified":22}],"last_modified":"333"}' ||
        serialized ==
          '{"data":[{"id":"rid1","last_modified":11}],"last_modified":"222"}'
      );
    },
  };

  registerCleanupFunction(() => {
    client._verifier = backup;
    server.stop(() => {});
    Services.prefs.clearUserPref(PREF_SETTINGS_SERVER);

    Services.prefs.clearUserPref("services.settings.loglevel");
  });
});

add_task(clear_state);

add_task(async function test_ignores_if_local_signature_is_valid() {
  await client.maybeSync(333);
  Assert.deepEqual(
    [
      await client.db.getLastModified(),
      (await client.get()).map(({ id }) => id),
    ],
    [333, ["rid1", "rid2"]]
  );

  await client.maybeSync(222);

  // The client should detect that timestamp is older,
  // but it ignores it because local data is good.
  Assert.deepEqual(
    [
      await client.db.getLastModified(),
      (await client.get()).map(({ id }) => id),
    ],
    [333, ["rid1", "rid2"]]
  );
});
add_task(clear_state);

add_task(async function test_uses_old_data_if_local_signature_is_invalid() {
  // Import some data in the local DB. Signature will be bad.
  await client.db.importChanges({}, 333, [{ id: "myid", last_modified: 1234 }]);
  Assert.deepEqual(
    [
      await client.db.getLastModified(),
      (await client.get()).map(({ id }) => id),
    ],
    [333, ["myid"]]
  );

  await client.maybeSync(222);

  // The client should detect that timestamp is older,
  // but will replace local data with this old data.
  Assert.deepEqual(
    [
      await client.db.getLastModified(),
      (await client.get()).map(({ id }) => id),
    ],
    [222, ["rid1"]]
  );
});
add_task(clear_state);
