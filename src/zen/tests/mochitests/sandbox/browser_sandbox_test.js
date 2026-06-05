/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

function test() {
  waitForExplicitFinish();

  // Types of processes to test, taken from GeckoProcessTypes.h
  // GPU process might not run depending on the platform, so we need it to be
  // the last one of the list to allow the remainingTests logic below to work
  // as expected.
  //
  // For UtilityProcess, allow constructing a string made of the process type
  // and the sandbox variant we want to test, e.g.,
  // utility:0 for GENERIC_UTILITY
  // utility:1 for AppleMedia/WMF on macOS/Windows
  var processTypes = ["tab", "socket", "rdd", "gmplugin", "utility:0", "gpu"];

  const platform = SpecialPowers.Services.appinfo.OS;
  if (platform === "WINNT" || platform === "Darwin") {
    processTypes.push("utility:1");
  }

  // A callback called after each test-result.
  let sandboxTestResult = (subject, topic, data) => {
    let { testid, passed, message } = JSON.parse(data);
    ok(
      passed,
      "Test " + testid + (passed ? " passed: " : " failed: ") + message
    );
  };
  Services.obs.addObserver(sandboxTestResult, "sandbox-test-result");

  var remainingTests = processTypes.length;

  // A callback that is notified when a child process is done running tests.
  let sandboxTestDone = () => {
    remainingTests = remainingTests - 1;
    if (remainingTests == 0) {
      // Clean up test file
      if (homeTestFile.exists()) {
        ok(homeTestFile.isFile(), "homeTestFile should be a file");
        if (homeTestFile.isFile()) {
          homeTestFile.remove(false);
        }
      }

      Services.obs.removeObserver(sandboxTestResult, "sandbox-test-result");
      Services.obs.removeObserver(sandboxTestDone, "sandbox-test-done");

      // Notify SandboxTest component that it should terminate the connection
      // with the child processes.
      comp.finishTests();
      // Notify mochitest that all process tests are complete.
      finish();
    }
  };
  Services.obs.addObserver(sandboxTestDone, "sandbox-test-done");

  var comp = Cc["@mozilla.org/sandbox/sandbox-test;1"].getService(
    Ci.mozISandboxTest
  );

  let homeTestFile;
  try {
    homeTestFile = Services.dirsvc.get("Home", Ci.nsIFile);
    homeTestFile.append(".mozilla_gpu_sandbox_read_test");
    if (!homeTestFile.exists()) {
      homeTestFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
    }
  } catch (e) {
    ok(false, "Failed to create home test file: " + e);
  }

  comp.startTests(processTypes);
}
