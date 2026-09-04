/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { AddonUtils } = ChromeUtils.importESModule(
  "resource://services-sync/addonutils.sys.mjs"
);

const HTTP_PORT = 8888;
const SERVER_ADDRESS = "http://127.0.0.1:8888";

Services.prefs.setStringPref(
  "extensions.getAddons.get.url",
  SERVER_ADDRESS + "/search/guid:%IDS%"
);

AddonTestUtils.init(this);
AddonTestUtils.createAppInfo(
  "xpcshell@tests.mozilla.org",
  "XPCShell",
  "1",
  "1.9.2"
);

add_task(async function setup() {
  await AddonTestUtils.promiseStartupManager();
});

function createAndStartHTTPServer(port = HTTP_PORT) {
  try {
    let server = new HttpServer();

    server.registerFile(
      "/search/guid:missing-sourceuri%40tests.mozilla.org",
      do_get_file("missing-sourceuri.json")
    );

    server.registerFile(
      "/search/guid:rewrite%40tests.mozilla.org",
      do_get_file("rewrite-search.json")
    );

    server.start(port);

    return server;
  } catch (ex) {
    _("Got exception starting HTTP server on port " + port);
    _("Error: " + Log.exceptionStr(ex));
    do_throw(ex);
  }
  return null; /* not hit, but keeps eslint happy! */
}

function run_test() {
  syncTestLogging();

  run_next_test();
}

add_task(async function test_handle_empty_source_uri() {
  _("Ensure that search results without a sourceURI are properly ignored.");

  let server = createAndStartHTTPServer();

  const ID = "missing-sourceuri@tests.mozilla.org";

  const result = await AddonUtils.installAddons([
    { id: ID, requireSecureURI: false },
  ]);

  Assert.ok("installedIDs" in result);
  Assert.equal(0, result.installedIDs.length);

  Assert.ok("skipped" in result);
  Assert.ok(result.skipped.includes(ID));

  await promiseStopServer(server);
});

add_test(function test_ignore_untrusted_source_uris() {
  _("Ensures that source URIs from insecure schemes are rejected.");

  const bad = [
    "http://example.com/foo.xpi",
    "ftp://example.com/foo.xpi",
    "silly://example.com/foo.xpi",
  ];

  const good = ["https://example.com/foo.xpi"];

  for (let s of bad) {
    let sourceURI = Services.io.newURI(s);
    let addon = { sourceURI, name: "bad", id: "bad" };

    let canInstall = AddonUtils.canInstallAddon(addon);
    Assert.ok(!canInstall, "Correctly rejected a bad URL");
  }

  for (let s of good) {
    let sourceURI = Services.io.newURI(s);
    let addon = { sourceURI, name: "good", id: "good" };

    let canInstall = AddonUtils.canInstallAddon(addon);
    Assert.ok(canInstall, "Correctly accepted a good URL");
  }
  run_next_test();
});

add_task(async function test_source_uri_rewrite() {
  _("Ensure that a 'src=api' query string is rewritten to 'src=sync'");

  // This tests for conformance with bug 708134 so server-side metrics aren't
  // skewed.

  // We resort to monkeypatching because of the API design.
  let oldFunction =
    Object.getPrototypeOf(AddonUtils).installAddonFromSearchResult;

  let installCalled = false;
  Object.getPrototypeOf(AddonUtils).installAddonFromSearchResult =
    async function testInstallAddon(addon) {
      Assert.equal(
        SERVER_ADDRESS + "/require.xpi?src=sync",
        addon.sourceURI.spec
      );

      installCalled = true;

      const install = await AddonUtils.getInstallFromSearchResult(addon);
      Assert.equal(
        SERVER_ADDRESS + "/require.xpi?src=sync",
        install.sourceURI.spec
      );
      Assert.deepEqual(
        install.installTelemetryInfo,
        { source: "sync" },
        "Got the expected installTelemetryInfo"
      );

      return { id: addon.id, addon, install };
    };

  let server = createAndStartHTTPServer();

  let installOptions = {
    id: "rewrite@tests.mozilla.org",
    requireSecureURI: false,
  };
  await AddonUtils.installAddons([installOptions]);

  Assert.ok(installCalled);
  Object.getPrototypeOf(AddonUtils).installAddonFromSearchResult = oldFunction;

  await promiseStopServer(server);
});
