/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { AppConstants } = ChromeUtils.importESModule(
  "resource://gre/modules/AppConstants.sys.mjs"
);

// Svc.PrefBranch.setStringPref("services.sync.log.appender.dump", "All");
Svc.PrefBranch.setStringPref("registerEngines", "Tab,Bookmarks,Form,History");

add_task(function test_perDeviceEngineChoices() {
  const { Weave } = ChromeUtils.importESModule(
    "resource://services-sync/main.sys.mjs"
  );
  const pref = "services.sync.perDeviceEngineChoices";
  const serviceModule = "resource://services-sync/service.sys.mjs";

  Assert.ok(!Cu.isESModuleLoaded(serviceModule));
  Assert.ok(!Services.prefs.getBoolPref(pref), "Disabled by default.");
  Assert.ok(!Weave.perDeviceEngineChoices);
  try {
    Services.prefs.setBoolPref(pref, true);
    Assert.ok(Weave.perDeviceEngineChoices);
    Services.prefs.setBoolPref(pref, false);
    Assert.ok(!Weave.perDeviceEngineChoices);
    Assert.ok(
      !Cu.isESModuleLoaded(serviceModule),
      "Reading the feature flag does not initialize Sync."
    );
  } finally {
    Services.prefs.clearUserPref(pref);
  }
});

add_task(async function run_test() {
  validate_all_future_pings();
  _("When imported, Service.onStartup is called");

  let xps = Cc["@mozilla.org/weave/service;1"].getService(
    Ci.nsISupports
  ).wrappedJSObject;
  Assert.ok(!xps.enabled);

  // Test fixtures
  let { Service } = ChromeUtils.importESModule(
    "resource://services-sync/service.sys.mjs"
  );
  Services.prefs.setStringPref("services.sync.username", "johndoe");
  Assert.ok(xps.enabled);

  _("Service is enabled.");
  Assert.equal(Service.enabled, true);

  _("Observers are notified of startup");
  Assert.ok(!Service.status.ready);
  Assert.ok(!xps.ready);

  await promiseOneObserver("weave:service:ready");

  Assert.ok(Service.status.ready);
  Assert.ok(xps.ready);

  _("Engines are registered.");
  let engines = Service.engineManager.getAll();
  if (AppConstants.MOZ_APP_NAME == "thunderbird") {
    // Thunderbird's engines are registered later, so they're not here yet.
    Assert.deepEqual(
      engines.map(engine => engine.name),
      []
    );
  } else {
    Assert.deepEqual(
      engines.map(engine => engine.name),
      ["tabs", "bookmarks", "forms", "history"]
    );
  }

  // Clean up.
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }

  do_test_finished();
});
