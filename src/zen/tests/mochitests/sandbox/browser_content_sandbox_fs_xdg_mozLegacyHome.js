/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
/* import-globals-from browser_content_sandbox_utils.js */
"use strict";

Services.scriptloader.loadSubScript(
  "chrome://mochitests/content/browser/" +
    "security/sandbox/test/browser_content_sandbox_utils.js",
  this
);

Services.scriptloader.loadSubScript(
  "chrome://mochitests/content/browser/" +
    "security/sandbox/test/browser_content_sandbox_fs_tests.js",
  this
);

SimpleTest.requestCompleteLog();

add_setup(async function setup() {
  const xdgConfigHome = Services.env.exists("XDG_CONFIG_HOME");
  Assert.equal(xdgConfigHome, true, "XDG_CONFIG_HOME is defined");

  if (isXdgEnabled()) {
    const mozLegacyHome = Services.env.get("MOZ_LEGACY_HOME");
    Assert.equal(mozLegacyHome, 1, "MOZ_LEGACY_HOME is set to 1");
  }

  // If it is there, do actual testing
  sanityChecks();
});

add_task(async function () {
  // Make sure we dont break others.
  add_task(testFileAccessAllPlatforms); // eslint-disable-line no-undef

  // The linux only tests are the ones that can behave differently based on
  // existence of XDG_CONFIG_HOME
  add_task(testFileAccessLinuxOnly); // eslint-disable-line no-undef

  add_task(cleanupBrowserTabs); // eslint-disable-line no-undef
});
