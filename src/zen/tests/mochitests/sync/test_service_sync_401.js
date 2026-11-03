/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

function login_handling(handler) {
  return function (request, response) {
    if (
      request.hasHeader("Authorization") &&
      request.getHeader("Authorization").includes('Hawk id="id"')
    ) {
      handler(request, response);
    } else {
      let body = "Unauthorized";
      response.setStatusLine(request.httpVersion, 401, "Unauthorized");
      response.bodyOutputStream.write(body, body.length);
    }
  };
}

add_task(async function run_test() {
  Log.repository.rootLogger.addAppender(new Log.DumpAppender());

  let collectionsHelper = track_collections_helper();
  let upd = collectionsHelper.with_updated_collection;

  let server = httpd_setup({
    "/1.1/johndoe/storage/crypto/keys": upd(
      "crypto",
      new ServerWBO("keys").handler()
    ),
    "/1.1/johndoe/storage/meta/global": upd(
      "meta",
      new ServerWBO("global").handler()
    ),
    "/1.1/johndoe/info/collections": login_handling(collectionsHelper.handler),
  });

  const GLOBAL_SCORE = 42;

  try {
    _("Set up test fixtures.");
    await SyncTestingInfrastructure(server, "johndoe", "ilovejane");
    Service.scheduler.globalScore = GLOBAL_SCORE;
    // Avoid daily ping
    Svc.PrefBranch.setIntPref("lastPing", Math.floor(Date.now() / 1000));

    let threw = false;
    Svc.Obs.add("weave:service:sync:error", function () {
      threw = true;
    });

    _("Initial state: We're successfully logged in.");
    await Service.login();
    Assert.ok(Service.isLoggedIn);
    Assert.equal(Service.status.login, LOGIN_SUCCEEDED);

    _("Simulate having changed the password somewhere else.");
    Service.identity._token.id = "somethingelse";
    Service.identity.unlockAndVerifyAuthState = () =>
      Promise.resolve(LOGIN_FAILED_LOGIN_REJECTED);

    _("Let's try to sync.");
    await Service.sync();

    _("Verify that sync() threw an exception.");
    Assert.ok(threw);

    _("We're no longer logged in.");
    Assert.ok(!Service.isLoggedIn);

    _("Sync status won't have changed yet, because we haven't tried again.");

    _("globalScore is reset upon starting a sync.");
    Assert.equal(Service.scheduler.globalScore, 0);

    _("Our next sync will fail appropriately.");
    try {
      await Service.sync();
    } catch (ex) {}
    Assert.equal(Service.status.login, LOGIN_FAILED_LOGIN_REJECTED);
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
    await promiseStopServer(server);
  }
});
