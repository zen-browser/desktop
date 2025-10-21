/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test the macOS ShowSecurityPreferences shell service method.
 */

"use strict";

// eslint-disable-next-line mozilla/no-redeclare-with-import-autofix
const { AppConstants } = ChromeUtils.importESModule(
  "resource://gre/modules/AppConstants.sys.mjs"
);

function killSystemPreferences() {
  let killallFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  killallFile.initWithPath("/usr/bin/killall");
  let sysPrefsArg = ["System Preferences"];
  if (AppConstants.isPlatformAndVersionAtLeast("macosx", 22)) {
    sysPrefsArg = ["System Settings"];
  }
  let process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
  process.init(killallFile);
  process.run(true, sysPrefsArg, 1);
  return process.exitValue;
}

add_setup(async function () {
  info("Ensure System Preferences isn't already running");
  killSystemPreferences();
});

add_task(async function test_prefsOpen() {
  let shellSvc = Cc["@mozilla.org/browser/shell-service;1"].getService(
    Ci.nsIMacShellService
  );
  shellSvc.showSecurityPreferences("Privacy_AllFiles");

  equal(killSystemPreferences(), 0, "Ensure System Preferences was started");
});
