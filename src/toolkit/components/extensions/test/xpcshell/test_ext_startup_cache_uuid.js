/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

AddonTestUtils.init(this);
AddonTestUtils.overrideCertDB();
AddonTestUtils.createAppInfo(
  "xpcshell@tests.mozilla.org",
  "XPCShell",
  "42",
  "42"
);

add_task(async function test_manifest_cache_after_uuid_change() {
  const id = "startup-cache-uuid@tests.mozilla.org";
  const uuidPref = "extensions.webextensions.uuids";

  await AddonTestUtils.promiseStartupManager();

  const extension = ExtensionTestUtils.loadExtension({
    useAddonManager: "permanent",
    manifest: {
      browser_specific_settings: { gecko: { id } },
      background: { page: "background.html" },
      options_ui: { page: "options.html" },
      browser_action: { default_popup: "popup.html" },
    },
    files: {
      "background.html": '<script src="background.js"></script>',
      "background.js": function () {
        browser.test.sendMessage("ready", browser.runtime.getURL(""));
      },
      "options.html": "<!DOCTYPE html><title>Options</title>",
      "popup.html": "<!DOCTYPE html><title>Popup</title>",
    },
  });

  await extension.startup();
  const oldOrigin = await extension.awaitMessage("ready");

  // Populate and reuse the cache before changing the profile's UUID mapping.
  await AddonTestUtils.promiseRestartManager();
  await extension.awaitBackgroundStarted();
  equal(
    await extension.awaitMessage("ready"),
    oldOrigin,
    "Stable UUID on restart"
  );

  // Also retain the cache layout written by builds that did not key by UUID.
  // Its locale entry is a manifest object, not a map for another key component.
  const { StartupCache } = ExtensionParent;
  await StartupCache.manifests.set(
    [id, extension.version, Services.locale.appLocaleAsBCP47],
    await extension.extension.parseManifest()
  );

  await AddonTestUtils.promiseShutdownManager();
  const uuids = JSON.parse(Services.prefs.getStringPref(uuidPref));
  uuids[id] = Services.uuid.generateUUID().number.slice(1, -1);
  Services.prefs.setStringPref(uuidPref, JSON.stringify(uuids));

  // Keep the installed XPI, its version, locale, and startup cache unchanged.
  // Only the UUID changes, as can happen when profile data is copied.
  await AddonTestUtils.promiseStartupManager();
  await extension.awaitStartup();

  const newOrigin = extension.extension.getURL("");
  notEqual(newOrigin, oldOrigin, "The extension has a different origin");
  const { manifest } = extension.extension;
  // Check URLs before waiting for the background, so stale cached URLs fail
  // directly instead of hanging while waiting for a background that cannot load.
  equal(manifest.background.page, `${newOrigin}background.html`);
  equal(manifest.options_ui.page, `${newOrigin}options.html`);
  equal(manifest.browser_action.default_popup, `${newOrigin}popup.html`);

  await extension.awaitBackgroundStarted();
  equal(await extension.awaitMessage("ready"), newOrigin, "Background runs");

  await AddonTestUtils.promiseRestartManager();
  await extension.awaitBackgroundStarted();
  equal(
    await extension.awaitMessage("ready"),
    newOrigin,
    "The cache remains usable on subsequent restarts"
  );

  await extension.unload();
  await AddonTestUtils.promiseShutdownManager();
});
