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

/*
 * This test exercises file I/O from web and file content processes using
 * nsIFile etc. methods to validate that calls that are meant to be blocked by
 * content sandboxing are blocked.
 */

//
// Checks that sandboxing is enabled and at the appropriate level
// setting before triggering tests that do the file I/O.
//
// Tests attempting to write to a file in the home directory from the
// content process--expected to fail.
//
// Tests attempting to write to a file in the content temp directory
// from the content process--expected to succeed. Uses "ContentTmpD".
//
// Tests reading various files and directories from file and web
// content processes.
//
add_task(async function () {
  sanityChecks();

  // Test creating a file in the home directory from a web content process
  add_task(createFileInHome); // eslint-disable-line no-undef

  // Test creating a file content temp from a web content process
  add_task(createTempFile); // eslint-disable-line no-undef

  // Test reading files/dirs from web and file content processes
  add_task(testFileAccessAllPlatforms); // eslint-disable-line no-undef

  add_task(testFileAccessMacOnly); // eslint-disable-line no-undef

  add_task(testFileAccessLinuxOnly); // eslint-disable-line no-undef

  add_task(testFileAccessWindowsOnly); // eslint-disable-line no-undef

  add_task(cleanupBrowserTabs); // eslint-disable-line no-undef
});
