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
  // Ensure that XDG_CONFIG_HOME is there
  const xdgConfigHome = Services.env.get("XDG_CONFIG_HOME");
  Assert.greater(xdgConfigHome.length, 1, "XDG_CONFIG_HOME is defined");

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
