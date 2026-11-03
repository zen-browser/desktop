/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Verify that we wipe the server if we have to regenerate keys.
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_task(async function test_missing_crypto_collection() {
  enableValidationPrefs();

  let johnHelper = track_collections_helper();
  let johnU = johnHelper.with_updated_collection;
  let johnColls = johnHelper.collections;

  let empty = false;
  function maybe_empty(handler) {
    return function (request, response) {
      if (empty) {
        let body = "{}";
        response.setStatusLine(request.httpVersion, 200, "OK");
        response.bodyOutputStream.write(body, body.length);
      } else {
        handler(request, response);
      }
    };
  }

  let handlers = {
    "/1.1/johndoe/info/collections": maybe_empty(johnHelper.handler),
    "/1.1/johndoe/storage/crypto/keys": johnU(
      "crypto",
      new ServerWBO("keys").handler()
    ),
    "/1.1/johndoe/storage/meta/global": johnU(
      "meta",
      new ServerWBO("global").handler()
    ),
  };
  let collections = [
    "clients",
    "bookmarks",
    "forms",
    "history",
    "passwords",
    "prefs",
    "tabs",
  ];
  // Disable addon sync because AddonManager won't be initialized here.
  await Service.engineManager.unregister("addons");
  await Service.engineManager.unregister("extension-storage");

  for (let coll of collections) {
    handlers["/1.1/johndoe/storage/" + coll] = johnU(
      coll,
      new ServerCollection({}, true).handler()
    );
  }
  let server = httpd_setup(handlers);
  await configureIdentity({ username: "johndoe" }, server);

  try {
    let fresh = 0;
    let orig = Service._freshStart;
    Service._freshStart = async function () {
      _("Called _freshStart.");
      await orig.call(Service);
      fresh++;
    };

    _("Startup, no meta/global: freshStart called once.");
    await sync_and_validate_telem();
    Assert.equal(fresh, 1);
    fresh = 0;

    _("Regular sync: no need to freshStart.");
    await Service.sync();
    Assert.equal(fresh, 0);

    _("Simulate a bad info/collections.");
    delete johnColls.crypto;
    await sync_and_validate_telem();
    Assert.equal(fresh, 1);
    fresh = 0;

    _("Regular sync: no need to freshStart.");
    await sync_and_validate_telem();
    Assert.equal(fresh, 0);
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
    await promiseStopServer(server);
  }
});
