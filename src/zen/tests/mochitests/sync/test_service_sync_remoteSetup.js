/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

// This sucks, but this test fails if this engine is enabled, due to dumb
// things that aren't related to this engine. In short:
// * Because the addon manager isn't initialized, the addons engine fails to
//   initialize. So we end up writing a meta/global with `extension-storage`
//   but not addons.
// * After we sync, we discover 'addons' is locally enabled, but because it's
//   not in m/g, we decide it's been remotely declined (and it decides this
//   without even considering `declined`). So we disable 'addons'.
// * Disabling 'addons' means 'extension-storage' is disabled - but because
//   that *is* in meta/global we re-update meta/global to remove it.
// * This test fails due to the extra, unexpected update of m/g.
//
// Another option would be to ensure the addons manager is initialized, but
// that's a larger patch and still isn't strictly relevant to what's being
// tested here, so...
Services.prefs.setBoolPref(
  "services.sync.engine.extension-storage.force",
  false
);

add_task(async function run_test() {
  enableValidationPrefs();

  validate_all_future_pings();
  Log.repository.rootLogger.addAppender(new Log.DumpAppender());

  let clients = new ServerCollection();
  let meta_global = new ServerWBO("global");

  let collectionsHelper = track_collections_helper();
  let upd = collectionsHelper.with_updated_collection;
  let collections = collectionsHelper.collections;

  function wasCalledHandler(wbo) {
    let handler = wbo.handler();
    return function () {
      wbo.wasCalled = true;
      handler.apply(this, arguments);
    };
  }

  let keysWBO = new ServerWBO("keys");
  let cryptoColl = new ServerCollection({ keys: keysWBO });
  let metaColl = new ServerCollection({ global: meta_global });
  do_test_pending();

  /**
   * Handle the bulk DELETE request sent by wipeServer.
   */
  function storageHandler(request, response) {
    Assert.equal("DELETE", request.method);
    Assert.ok(request.hasHeader("X-Confirm-Delete"));

    _("Wiping out all collections.");
    cryptoColl.delete({});
    clients.delete({});
    metaColl.delete({});

    let ts = new_timestamp();
    collectionsHelper.update_collection("crypto", ts);
    collectionsHelper.update_collection("clients", ts);
    collectionsHelper.update_collection("meta", ts);
    return_timestamp(request, response, ts);
  }

  const GLOBAL_PATH = "/1.1/johndoe/storage/meta/global";

  let handlers = {
    "/1.1/johndoe/storage": storageHandler,
    "/1.1/johndoe/storage/crypto/keys": upd("crypto", keysWBO.handler()),
    "/1.1/johndoe/storage/crypto": upd("crypto", cryptoColl.handler()),
    "/1.1/johndoe/storage/clients": upd("clients", clients.handler()),
    "/1.1/johndoe/storage/meta": upd("meta", wasCalledHandler(metaColl)),
    "/1.1/johndoe/storage/meta/global": upd(
      "meta",
      wasCalledHandler(meta_global)
    ),
    "/1.1/johndoe/info/collections": collectionsHelper.handler,
  };

  function mockHandler(path, mock) {
    server.registerPathHandler(path, mock(handlers[path]));
    return {
      restore() {
        server.registerPathHandler(path, handlers[path]);
      },
    };
  }

  let server = httpd_setup(handlers);

  try {
    _("Checking Status.sync with no credentials.");
    await Service.verifyAndFetchSymmetricKeys();
    Assert.equal(Service.status.sync, CREDENTIALS_CHANGED);
    Assert.equal(Service.status.login, LOGIN_FAILED_NO_PASSPHRASE);

    await configureIdentity({ username: "johndoe" }, server);

    await Service.login();
    _("Checking that remoteSetup returns true when credentials have changed.");
    (await Service.recordManager.get(Service.metaURL)).payload.syncID =
      "foobar";
    Assert.ok(await Service._remoteSetup());

    let returnStatusCode = (method, code) => oldMethod => (req, res) => {
      if (req.method === method) {
        res.setStatusLine(req.httpVersion, code, "");
      } else {
        oldMethod(req, res);
      }
    };

    let mock = mockHandler(GLOBAL_PATH, returnStatusCode("GET", 401));
    Service.recordManager.del(Service.metaURL);
    _(
      "Checking that remoteSetup returns false on 401 on first get /meta/global."
    );
    Assert.equal(false, await Service._remoteSetup());
    mock.restore();

    await Service.login();
    mock = mockHandler(GLOBAL_PATH, returnStatusCode("GET", 503));
    Service.recordManager.del(Service.metaURL);
    _(
      "Checking that remoteSetup returns false on 503 on first get /meta/global."
    );
    Assert.equal(false, await Service._remoteSetup());
    Assert.equal(Service.status.sync, METARECORD_DOWNLOAD_FAIL);
    mock.restore();

    await Service.login();
    mock = mockHandler(GLOBAL_PATH, returnStatusCode("GET", 404));
    Service.recordManager.del(Service.metaURL);
    _("Checking that remoteSetup recovers on 404 on first get /meta/global.");
    Assert.ok(await Service._remoteSetup());
    mock.restore();

    let makeOutdatedMeta = async () => {
      Service.metaModified = 0;
      let infoResponse = await Service._fetchInfo();
      return {
        status: infoResponse.status,
        obj: {
          crypto: infoResponse.obj.crypto,
          clients: infoResponse.obj.clients,
          meta: 1,
        },
      };
    };

    _(
      "Checking that remoteSetup recovers on 404 on get /meta/global after clear cached one."
    );
    mock = mockHandler(GLOBAL_PATH, returnStatusCode("GET", 404));
    Service.recordManager.set(Service.metaURL, { isNew: false });
    Assert.ok(await Service._remoteSetup(await makeOutdatedMeta()));
    mock.restore();

    _(
      "Checking that remoteSetup returns false on 503 on get /meta/global after clear cached one."
    );
    mock = mockHandler(GLOBAL_PATH, returnStatusCode("GET", 503));
    Service.status.sync = "";
    Service.recordManager.set(Service.metaURL, { isNew: false });
    Assert.equal(false, await Service._remoteSetup(await makeOutdatedMeta()));
    Assert.equal(Service.status.sync, "");
    mock.restore();

    metaColl.delete({});

    _("Do an initial sync.");
    await Service.sync();

    _("Checking that remoteSetup returns true.");
    Assert.ok(await Service._remoteSetup());

    _("Verify that the meta record was uploaded.");
    Assert.equal(meta_global.data.syncID, Service.syncID);
    Assert.equal(meta_global.data.storageVersion, STORAGE_VERSION);
    Assert.equal(
      meta_global.data.engines.clients.version,
      Service.clientsEngine.version
    );
    Assert.equal(
      meta_global.data.engines.clients.syncID,
      await Service.clientsEngine.getSyncID()
    );

    _(
      "Set the collection info hash so that sync() will remember the modified times for future runs."
    );
    let lastSync = await Service.clientsEngine.getLastSync();
    collections.meta = lastSync;
    collections.clients = lastSync;
    await Service.sync();

    _("Sync again and verify that meta/global wasn't downloaded again");
    meta_global.wasCalled = false;
    await Service.sync();
    Assert.ok(!meta_global.wasCalled);

    _(
      "Fake modified records. This will cause a redownload, but not reupload since it hasn't changed."
    );
    collections.meta += 42;
    meta_global.wasCalled = false;

    let metaModified = meta_global.modified;

    await Service.sync();
    Assert.ok(meta_global.wasCalled);
    Assert.equal(metaModified, meta_global.modified);

    // Try to screw up HMAC calculation.
    // Re-encrypt keys with a new random keybundle, and upload them to the
    // server, just as might happen with a second client.
    _("Attempting to screw up HMAC by re-encrypting keys.");
    let keys = Service.collectionKeys.asWBO();
    let b = new BulkKeyBundle("hmacerror");
    await b.generateRandom();
    collections.crypto = keys.modified = 100 + Date.now() / 1000; // Future modification time.
    await keys.encrypt(b);
    await keys.upload(Service.resource(Service.cryptoKeysURL));

    Assert.equal(false, await Service.verifyAndFetchSymmetricKeys());
    Assert.equal(Service.status.login, LOGIN_FAILED_INVALID_PASSPHRASE);
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
    server.stop(do_test_finished);
  }
});
