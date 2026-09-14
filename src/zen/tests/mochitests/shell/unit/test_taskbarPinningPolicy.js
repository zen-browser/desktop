/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { MockRegistry } = ChromeUtils.importESModule(
  "resource://testing-common/MockRegistry.sys.mjs"
);

const EXPLORER_POLICY_KEY = String.raw`Software\Policies\Microsoft\Windows\Explorer`;
const POLICY_LOG_PREFIX = "Pinning disabled by policy";

const HIVES = {
  HKCU: Ci.nsIWindowsRegKey.ROOT_KEY_CURRENT_USER,
  HKLM: Ci.nsIWindowsRegKey.ROOT_KEY_LOCAL_MACHINE,
};
const POLICIES = ["NoPinningToTaskbar", "TaskbarNoPinnedList"];

const shellService = Cc["@mozilla.org/browser/shell-service;1"].getService(
  Ci.nsIWindowsShellService
);

let gRegistry;
let gLogFile;

add_setup(async function () {
  // The pinning policy diagnostic only reaches MOZ_LOG, never the console
  // service, so route the module to a file and read it back.
  // logging.config.sync flushes each line, so the message is on disk by the
  // time canPinToTaskbar() returns.
  const logBase = PathUtils.join(
    do_get_profile().path,
    "taskbar_policy_test.log"
  );
  gLogFile = `${logBase}-main.${Services.appinfo.processID}.moz_log`;

  Services.prefs.setBoolPref("logging.config.sync", true);
  Services.prefs.setCharPref("logging.config.LOG_FILE", logBase);
  Services.prefs.setIntPref("logging.shell_windows::taskbar", 3);

  gRegistry = new MockRegistry();

  registerCleanupFunction(async () => {
    gRegistry.shutdown();
    Services.prefs.clearUserPref("logging.shell_windows::taskbar");
    Services.prefs.clearUserPref("logging.config.LOG_FILE");
    Services.prefs.clearUserPref("logging.config.sync");
    await IOUtils.remove(gLogFile, { ignoreAbsent: true });
  });
});

async function readLog() {
  if (!(await IOUtils.exists(gLogFile))) {
    return "";
  }
  return IOUtils.readUTF8(gLogFile);
}

function clearPolicies() {
  for (const root of Object.values(HIVES)) {
    for (const policy of POLICIES) {
      gRegistry.setValue(root, EXPLORER_POLICY_KEY, policy, null);
    }
  }
}

function setPolicy(hive, policy, value) {
  clearPolicies();
  gRegistry.setValue(
    HIVES[hive],
    EXPLORER_POLICY_KEY,
    policy,
    value,
    Ci.nsIWindowsRegKey.TYPE_INT
  );
}

// Calls canPinToTaskbar and returns what it threw (if anything) along with the
// log output it produced. The log file accumulates across tasks, so only the
// appended portion is returned.
async function callCanPinToTaskbar() {
  const offset = (await readLog()).length;

  let error = null;
  try {
    shellService.canPinToTaskbar();
  } catch (e) {
    error = e;
  }

  let log = (await readLog()).slice(offset);

  return { error, log };
}

// Set of hive/group policy combinations known to block pinning.
const BLOCKING_POLICIES = [
  ["HKCU", "NoPinningToTaskbar"],
  ["HKCU", "TaskbarNoPinnedList"],
  ["HKLM", "TaskbarNoPinnedList"],
];

add_task(async function test_policiesBlockPinning() {
  for (const [hive, policy] of BLOCKING_POLICIES) {
    info(`Testing ${policy} in ${hive}`);
    setPolicy(hive, policy, 1);

    const { error, log } = await callCanPinToTaskbar();

    Assert.equal(
      error?.result,
      Cr.NS_ERROR_NOT_AVAILABLE,
      `canPinToTaskbar threw NS_ERROR_NOT_AVAILABLE for ${policy} in ${hive}`
    );
    Assert.stringContains(
      log,
      `${POLICY_LOG_PREFIX} ${policy} in hive ${hive}.`,
      `The blocking policy ${policy} in ${hive} was logged`
    );
  }
});

// Policies that apply in other hives, but not the ones paired here.
const INVALID_HIVE_FOR_POLICY = [["HKLM", "NoPinningToTaskbar"]];

add_task(async function test_invalidPoliciesDoNotBlockPinning() {
  for (const [hive, policy] of INVALID_HIVE_FOR_POLICY) {
    info(`Testing ${policy} in ${hive}`);
    setPolicy(hive, policy, 1);

    // Whether pinning is actually available depends on the host machine, so only
    // the absence of the policy diagnostic is asserted here.
    const { log } = await callCanPinToTaskbar();

    Assert.ok(
      !log.includes(POLICY_LOG_PREFIX),
      `The policy ${policy} in ${hive} is invalid and should not block pinning`
    );
  }
});

add_task(async function test_policySetToZeroDoesNotBlockPinning() {
  setPolicy("HKCU", "NoPinningToTaskbar", 0);

  // Whether pinning is actually available depends on the host machine, so only
  // the absence of the policy diagnostic is asserted here.
  const { log } = await callCanPinToTaskbar();

  Assert.ok(
    !log.includes(POLICY_LOG_PREFIX),
    "A policy present but set to zero does not block pinning"
  );
});

add_task(async function test_noPoliciesSet() {
  clearPolicies();

  // Whether pinning is actually available depends on the host machine, so only
  // the absence of the policy diagnostic is asserted here.
  const { log } = await callCanPinToTaskbar();

  Assert.ok(
    !log.includes(POLICY_LOG_PREFIX),
    "No policy is reported when none are set"
  );
});
