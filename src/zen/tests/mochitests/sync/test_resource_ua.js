/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Resource } = ChromeUtils.importESModule(
  "resource://services-sync/resource.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

var httpProtocolHandler = Cc[
  "@mozilla.org/network/protocol;1?name=http"
].getService(Ci.nsIHttpProtocolHandler);

// Tracking info/collections.
var collectionsHelper = track_collections_helper();

var meta_global;
var server;

var expectedUA;
var ua;
function uaHandler(f) {
  return function (request, response) {
    ua = request.getHeader("User-Agent");
    return f(request, response);
  };
}

add_task(async function setup() {
  Log.repository.rootLogger.addAppender(new Log.DumpAppender());
  meta_global = new ServerWBO("global");
  server = httpd_setup({
    "/1.1/johndoe/info/collections": uaHandler(collectionsHelper.handler),
    "/1.1/johndoe/storage/meta/global": uaHandler(meta_global.handler()),
  });

  await configureIdentity({ username: "johndoe" }, server);
  _("Server URL: " + server.baseURI);

  // Note this string is missing the trailing ".destkop" as the test
  // adjusts the "client.type" pref where that portion comes from.
  expectedUA =
    Services.appinfo.name +
    "/" +
    Services.appinfo.version +
    " (" +
    httpProtocolHandler.oscpu +
    ")" +
    " FxSync/" +
    WEAVE_VERSION +
    "." +
    Services.appinfo.appBuildID;
});

add_task(async function test_fetchInfo() {
  _("Testing _fetchInfo.");
  await Service.login();
  await Service._fetchInfo();
  _("User-Agent: " + ua);
  Assert.equal(ua, expectedUA + ".desktop");
  ua = "";
});

add_task(async function test_desktop_post() {
  _("Testing direct Resource POST.");
  let r = new Resource(server.baseURI + "/1.1/johndoe/storage/meta/global");
  await r.post("foo=bar");
  _("User-Agent: " + ua);
  Assert.equal(ua, expectedUA + ".desktop");
  ua = "";
});

add_task(async function test_desktop_get() {
  _("Testing async.");
  Svc.PrefBranch.setStringPref("client.type", "desktop");
  let r = new Resource(server.baseURI + "/1.1/johndoe/storage/meta/global");
  await r.get();
  _("User-Agent: " + ua);
  Assert.equal(ua, expectedUA + ".desktop");
  ua = "";
});

add_task(async function test_mobile_get() {
  _("Testing mobile.");
  Svc.PrefBranch.setStringPref("client.type", "mobile");
  let r = new Resource(server.baseURI + "/1.1/johndoe/storage/meta/global");
  await r.get();
  _("User-Agent: " + ua);
  Assert.equal(ua, expectedUA + ".mobile");
  ua = "";
});

add_test(function tear_down() {
  server.stop(run_next_test);
});
