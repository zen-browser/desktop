const { Database } = ChromeUtils.importESModule(
  "resource://services-settings/Database.sys.mjs"
);
const { RemoteSettings } = ChromeUtils.importESModule(
  "resource://services-settings/remote-settings.sys.mjs"
);

let server;
let startupClients;

add_setup(async () => {
  // Disable signature verification of collections listed in test startup.json.mzlz4
  // since their metadata will eventually expire.
  startupClients = [
    "message-groups",
    "nimbus-desktop-experiments",
    "search-categorization",
    "tracking-protection-lists",
    "query-stripping",
    "cfr",
  ].map(id => {
    const c = RemoteSettings(id);
    c.verifySignature = false;
    return c;
  });

  // Setup an HTTP server to serve the 'startup.json.mzlz4' bundle.
  server = new HttpServer();
  server.start(-1);
  server.registerDirectory(
    "/cdn/bundles/",
    do_get_file("test_remote_settings_startup_bundle")
  );
  server.registerPathHandler("/v1/", (request, response) => {
    response.write(
      JSON.stringify({
        capabilities: {
          attachments: {
            base_url: `http://localhost:${server.identity.primaryPort}/cdn/`,
          },
        },
      })
    );
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setStatusLine(null, 200, "OK");
  });
  Services.prefs.setStringPref(
    "services.settings.server",
    `http://localhost:${server.identity.primaryPort}/v1`
  );
  registerCleanupFunction(() => {
    server.stop(() => {});
    Services.prefs.clearUserPref("services.settings.loglevel");
  });
});

async function clear_state() {
  await Database.destroy();
  RemoteSettings._ongoingExtractBundlePromise = null;
}

add_task(async function test_bundle_is_pulled_when_get_needs_sync() {
  const client = startupClients[0];

  Assert.ok(
    !(await Utils.hasLocalDump(client.bucketName, client.collectionName)),
    "Client has no packaged dump"
  );

  const records = await client.get();

  Assert.equal(records.length, 6, "Records were read from startup bundle");
});
add_task(clear_state);

add_task(
  async function test_signature_of_extracted_data_from_bundle_is_verified() {
    const c = RemoteSettings("tracking-protection-lists"); // part of startup.json.mzlz4
    c.verifySignature = true;

    let called = null;
    c.validateCollectionSignature = (records, timestamp, metadata) => {
      called = { records, timestamp, metadata };
    };

    await c.get();

    Assert.ok(!!called.records.length);
    Assert.greaterOrEqual(called.timestamp, 1694684362860);
    Assert.ok(called.metadata.flags.includes("startup"));
  }
);
add_task(clear_state);

add_task(async function test_bundle_is_not_importent_when_signature_fails() {
  const c = RemoteSettings("tracking-protection-lists"); // part of startup.json.mzlz4
  c.verifySignature = true;

  let called = false;
  c.validateCollectionSignature = () => {
    called = true;
    throw new Error("boom!");
  };

  let error;
  try {
    await c.get({ emptyListFallback: false });
    Assert.ok(false, ".get() should fail without network");
  } catch (e) {
    error = e;
  }
  Assert.ok(called, "Signature was verified");
  Assert.equal(
    error.name,
    "UnknownCollectionError",
    ".get() fails without network and with bad startup bundle"
  );
});
add_task(clear_state);

add_task(async function test_sync_occurs_if_collection_not_part_of_bundle() {
  const c = RemoteSettings("foo");

  let error;
  try {
    await c.get({ emptyListFallback: false });
    Assert.ok(false, ".get() should fail when bundle disabled");
  } catch (e) {
    error = e;
  }
  Assert.equal(
    error.name,
    "UnknownCollectionError",
    ".get() fails to sync data"
  );
});
add_task(clear_state);

add_task(async function test_several_clients_wait_for_bundle() {
  // several clients calling .get() in parallel will all take content from bundle.
  const results = await Promise.allSettled(
    startupClients.map(c => c.get({ emptyListFallback: false }))
  );

  Assert.deepEqual(
    [6, 70, 5, "UnknownCollectionError", 3, 11],
    results.map(({ status, value, reason }) =>
      status == "fulfilled" ? value.length : reason.name
    )
  );
});
add_task(clear_state);
