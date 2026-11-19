/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

function login_handling(handler) {
  return function (request, response) {
    if (has_hawk_header(request)) {
      handler(request, response);
    } else {
      let body = "Unauthorized";
      response.setStatusLine(request.httpVersion, 401, "Unauthorized");
      response.bodyOutputStream.write(body, body.length);
    }
  };
}

function service_unavailable(request, response) {
  let body = "Service Unavailable";
  response.setStatusLine(request.httpVersion, 503, "Service Unavailable");
  response.setHeader("Retry-After", "42");
  response.bodyOutputStream.write(body, body.length);
}

function run_test() {
  Log.repository.rootLogger.addAppender(new Log.DumpAppender());

  run_next_test();
}

add_task(async function test_verifyLogin() {
  // This test expects a clean slate -- no saved passphrase.
  await Services.logins.removeAllUserFacingLoginsAsync();
  let johnHelper = track_collections_helper();
  let johnU = johnHelper.with_updated_collection;

  do_test_pending();

  let server = httpd_setup({
    "/1.1/johndoe/info/collections": login_handling(johnHelper.handler),
    "/1.1/janedoe/info/collections": service_unavailable,

    "/1.1/johndoe/storage/crypto/keys": johnU(
      "crypto",
      new ServerWBO("keys").handler()
    ),
    "/1.1/johndoe/storage/meta/global": johnU(
      "meta",
      new ServerWBO("global").handler()
    ),
  });

  try {
    _("Force the initial state.");
    Service.status.service = STATUS_OK;
    Assert.equal(Service.status.service, STATUS_OK);

    _("Credentials won't check out because we're not configured yet.");
    Service.status.resetSync();
    Assert.equal(false, await Service.verifyLogin());
    Assert.equal(Service.status.service, CLIENT_NOT_CONFIGURED);
    Assert.equal(Service.status.login, LOGIN_FAILED_NO_USERNAME);

    _("Success if syncBundleKey is set.");
    Service.status.resetSync();
    await configureIdentity({ username: "johndoe" }, server);
    Assert.ok(await Service.verifyLogin());
    Assert.equal(Service.status.service, STATUS_OK);
    Assert.equal(Service.status.login, LOGIN_SUCCEEDED);

    _(
      "If verifyLogin() encounters a server error, it flips on the backoff flag and notifies observers on a 503 with Retry-After."
    );
    Service.status.resetSync();
    await configureIdentity({ username: "janedoe" }, server);
    Service._updateCachedURLs();
    Assert.ok(!Service.status.enforceBackoff);
    let backoffInterval;
    Svc.Obs.add("weave:service:backoff:interval", function observe(subject) {
      Svc.Obs.remove("weave:service:backoff:interval", observe);
      backoffInterval = subject;
    });
    Assert.equal(false, await Service.verifyLogin());
    Assert.ok(Service.status.enforceBackoff);
    Assert.equal(backoffInterval, 42);
    Assert.equal(Service.status.service, LOGIN_FAILED);
    Assert.equal(Service.status.login, SERVER_MAINTENANCE);

    _(
      "Ensure a network error when finding the cluster sets the right Status bits."
    );
    Service.status.resetSync();
    Service.clusterURL = "";
    Service.identity._findCluster = () => "http://localhost:12345/";
    Assert.equal(false, await Service.verifyLogin());
    Assert.equal(Service.status.service, LOGIN_FAILED);
    Assert.equal(Service.status.login, LOGIN_FAILED_NETWORK_ERROR);

    _(
      "Ensure a network error when getting the collection info sets the right Status bits."
    );
    Service.status.resetSync();
    Service.clusterURL = "http://localhost:12345/";
    Assert.equal(false, await Service.verifyLogin());
    Assert.equal(Service.status.service, LOGIN_FAILED);
    Assert.equal(Service.status.login, LOGIN_FAILED_NETWORK_ERROR);
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
    server.stop(do_test_finished);
  }
});
