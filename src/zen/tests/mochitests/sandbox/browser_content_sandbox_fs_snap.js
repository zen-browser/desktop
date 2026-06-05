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

add_task(async function () {
  // Ensure that SNAP is there
  const snap = Services.env.get("SNAP");
  Assert.greater(snap.length, 1, "SNAP is defined");

  // If it is there, do actual testing
  sanityChecks();

  add_task(testFileAccessLinuxOnly); // eslint-disable-line no-undef

  add_task(testFileAccessLinuxSnap); // eslint-disable-line no-undef

  add_task(cleanupBrowserTabs); // eslint-disable-line no-undef
});
