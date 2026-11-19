"use strict";

var nextUniqId = 0;
function getNewUtils() {
  const { Utils } = ChromeUtils.importESModule(
    `resource://services-settings/Utils.sys.mjs?_${++nextUniqId}`
  );
  return Utils;
}

// A collection with a dump that's packaged on all builds where this test runs,
// including on Android at mobile/android/installer/package-manifest.in
const TEST_BUCKET = "main";
const TEST_COLLECTION = "password-recipes";

async function importData(records) {
  await RemoteSettingsWorker._execute("_test_only_import", [
    TEST_BUCKET,
    TEST_COLLECTION,
    records,
    records[0]?.last_modified || 0,
  ]);
}

async function clear_state() {
  Services.env.set("MOZ_REMOTE_SETTINGS_DEVTOOLS", "0");
  Services.prefs.clearUserPref("services.settings.server");
  Services.prefs.clearUserPref("services.settings.preview_enabled");
}

add_setup(async function () {
  // Set this env vars in order to test the code path where the
  // server URL can only be overridden from Dev Tools.
  // See `isRunningTests` in `services/settings/Utils.sys.mjs`.
  const before = Services.env.get("MOZ_DISABLE_NONLOCAL_CONNECTIONS");
  Services.env.set("MOZ_DISABLE_NONLOCAL_CONNECTIONS", "0");

  registerCleanupFunction(() => {
    clear_state();
    Services.env.set("MOZ_DISABLE_NONLOCAL_CONNECTIONS", before);
  });
});

add_task(clear_state);

add_task(
  {
    skip_if: () => !AppConstants.RELEASE_OR_BETA,
  },
  async function test_server_url_cannot_be_toggled_in_release() {
    Services.prefs.setStringPref(
      "services.settings.server",
      "http://localhost:8888/v1"
    );

    const Utils = getNewUtils();

    Assert.equal(
      Utils.SERVER_URL,
      AppConstants.REMOTE_SETTINGS_SERVER_URLS[0],
      "Server url pref was not read in release"
    );
  }
);

add_task(
  {
    skip_if: () => AppConstants.RELEASE_OR_BETA,
  },
  async function test_server_url_cannot_be_toggled_in_dev_nightly() {
    Services.prefs.setStringPref(
      "services.settings.server",
      "http://localhost:8888/v1"
    );

    const Utils = getNewUtils();

    Assert.notEqual(
      Utils.SERVER_URL,
      AppConstants.REMOTE_SETTINGS_SERVER_URLS[0],
      "Server url pref was read in nightly/dev"
    );
  }
);
add_task(clear_state);

add_task(
  {
    skip_if: () => !AppConstants.RELEASE_OR_BETA,
  },
  async function test_preview_mode_cannot_be_toggled_in_release() {
    Services.prefs.setBoolPref("services.settings.preview_enabled", true);

    const Utils = getNewUtils();

    Assert.ok(!Utils.PREVIEW_MODE, "Preview mode pref was not read in release");
  }
);
add_task(clear_state);

add_task(
  {
    skip_if: () => AppConstants.RELEASE_OR_BETA,
  },
  async function test_preview_mode_cannot_be_toggled_in_dev_nightly() {
    Services.prefs.setBoolPref("services.settings.preview_enabled", true);

    const Utils = getNewUtils();

    Assert.ok(Utils.PREVIEW_MODE, "Preview mode pref is read in dev/nightly");
  }
);
add_task(clear_state);

add_task(
  {
    skip_if: () => !AppConstants.RELEASE_OR_BETA,
  },
  async function test_load_dumps_will_always_be_loaded_in_release() {
    Services.prefs.setStringPref(
      "services.settings.server",
      "http://localhost:8888/v1"
    );

    const Utils = getNewUtils();

    Assert.equal(
      Utils.SERVER_URL,
      AppConstants.REMOTE_SETTINGS_SERVER_URLS[0],
      "Server url pref was not read"
    );
    Assert.ok(Utils.LOAD_DUMPS, "Dumps will always be loaded");
  }
);

add_task(
  {
    skip_if: () => AppConstants.RELEASE_OR_BETA,
  },
  async function test_load_dumps_can_be_disabled_in_dev_nightly() {
    Services.prefs.setStringPref(
      "services.settings.server",
      "http://localhost:8888/v1"
    );

    const Utils = getNewUtils();

    Assert.notEqual(
      Utils.SERVER_URL,
      AppConstants.REMOTE_SETTINGS_SERVER_URLS[0],
      "Server url pref was read"
    );
    Assert.ok(!Utils.LOAD_DUMPS, "Dumps are not loaded if server is not prod");
  }
);
add_task(clear_state);

add_task(
  async function test_server_url_can_be_changed_in_all_versions_if_running_for_devtools() {
    Services.env.set("MOZ_REMOTE_SETTINGS_DEVTOOLS", "1");
    Services.prefs.setStringPref(
      "services.settings.server",
      "http://localhost:8888/v1"
    );

    const Utils = getNewUtils();

    Assert.notEqual(
      Utils.SERVER_URL,
      AppConstants.REMOTE_SETTINGS_SERVER_URLS[0],
      "Server url pref was read"
    );
  }
);
add_task(clear_state);

add_task(
  async function test_preview_mode_can_be_changed_in_all_versions_if_running_for_devtools() {
    Services.env.set("MOZ_REMOTE_SETTINGS_DEVTOOLS", "1");
    Services.prefs.setBoolPref("services.settings.preview_enabled", true);

    const Utils = getNewUtils();

    Assert.ok(Utils.PREVIEW_MODE, "Preview mode pref was read");
  }
);
add_task(clear_state);

add_task(
  async function test_dumps_are_not_loaded_if_server_is_not_prod_if_running_for_devtools() {
    Services.env.set("MOZ_REMOTE_SETTINGS_DEVTOOLS", "1");
    Services.prefs.setStringPref(
      "services.settings.server",
      "http://localhost:8888/v1"
    );

    const Utils = getNewUtils();
    Assert.ok(!Utils.LOAD_DUMPS, "Dumps won't be loaded");

    // The section below ensures that the LOAD_DUMPS flag properly takes effect.
    // The client is set up here rather than add_setup to avoid triggering the
    // lazy getters that are behind the global Utils.LOAD_DUMPS. If they are
    // triggered too early, then they will potentially cache different values
    // for the server urls and environment variables and this test then won't be
    // testing what we expect it to.

    let client = new RemoteSettingsClient(TEST_COLLECTION);

    const dump = await SharedUtils.loadJSONDump(TEST_BUCKET, TEST_COLLECTION);
    let DUMP_LAST_MODIFIED = dump.timestamp;

    // Dump is updated regularly, verify that the dump matches our expectations
    // before running the test.
    Assert.greater(
      DUMP_LAST_MODIFIED,
      1234,
      "Assuming dump to be newer than dummy 1234"
    );

    await client.db.clear();
    await importData([{ last_modified: 1234, id: "dummy" }]);

    const after = await client.get();
    Assert.deepEqual(
      after,
      [{ last_modified: 1234, id: "dummy" }],
      "Should have kept the original import"
    );
    Assert.equal(
      await client.getLastModified(),
      1234,
      "Should have kept the import's timestamp"
    );
    await client.db.clear();
  }
);
add_task(clear_state);

add_task(
  async function test_dumps_are_loaded_if_server_is_prod_if_running_for_devtools() {
    Services.env.set("MOZ_REMOTE_SETTINGS_DEVTOOLS", "1");
    Services.prefs.setStringPref(
      "services.settings.server",
      AppConstants.REMOTE_SETTINGS_SERVER_URLS[0]
    );

    const Utils = getNewUtils();

    Assert.ok(Utils.LOAD_DUMPS, "dumps are loaded if prod");
  }
);
add_task(clear_state);
