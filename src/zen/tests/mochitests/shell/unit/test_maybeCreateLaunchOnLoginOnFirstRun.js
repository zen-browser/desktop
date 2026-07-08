/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  StartupOSIntegration:
    "moz-src:///browser/components/shell/StartupOSIntegration.sys.mjs",
  WindowsLaunchOnLogin: "resource://gre/modules/WindowsLaunchOnLogin.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

const PREF = "browser.startup.windowsLaunchOnLogin.defaultEnabled";

async function runWith({ isFirstRun, prefValue, approved }) {
  let sandbox = sinon.createSandbox();
  let approvedStub = sandbox
    .stub(WindowsLaunchOnLogin, "getLaunchOnLoginApproved")
    .resolves(approved);
  let createStub = sandbox
    .stub(WindowsLaunchOnLogin, "createLaunchOnLogin")
    .resolves();

  if (prefValue === null) {
    Services.prefs.clearUserPref(PREF);
  } else {
    Services.prefs.setBoolPref(PREF, prefValue);
  }

  try {
    await StartupOSIntegration.maybeCreateLaunchOnLoginOnFirstRun(isFirstRun);
    return { approvedStub, createStub };
  } finally {
    sandbox.restore();
    Services.prefs.clearUserPref(PREF);
  }
}

add_task(async function test_creates_when_all_conditions_true() {
  let { createStub } = await runWith({
    isFirstRun: true,
    prefValue: true,
    approved: true,
  });
  Assert.ok(
    createStub.calledOnce,
    "createLaunchOnLogin should be called when isFirstRun, pref, and approval are all true"
  );
});

add_task(async function test_skips_when_not_first_run() {
  let { createStub, approvedStub } = await runWith({
    isFirstRun: false,
    prefValue: true,
    approved: true,
  });
  Assert.ok(
    !createStub.called,
    "createLaunchOnLogin should not be called when isFirstRun is false"
  );
  Assert.ok(
    !approvedStub.called,
    "getLaunchOnLoginApproved should be short-circuited when isFirstRun is false"
  );
});

add_task(async function test_skips_when_pref_disabled() {
  let { createStub, approvedStub } = await runWith({
    isFirstRun: true,
    prefValue: false,
    approved: true,
  });
  Assert.ok(
    !createStub.called,
    "createLaunchOnLogin should not be called when pref is false"
  );
  Assert.ok(
    !approvedStub.called,
    "getLaunchOnLoginApproved should be short-circuited when pref is false"
  );
});

add_task(async function test_skips_when_windows_policy_denies() {
  let { createStub, approvedStub } = await runWith({
    isFirstRun: true,
    prefValue: true,
    approved: false,
  });
  Assert.ok(
    approvedStub.calledOnce,
    "getLaunchOnLoginApproved should be consulted when pref and isFirstRun are true"
  );
  Assert.ok(
    !createStub.called,
    "createLaunchOnLogin should not be called when Windows policy denies"
  );
});

add_task(async function test_uses_pref_default_when_unset() {
  let { createStub } = await runWith({
    isFirstRun: true,
    prefValue: null,
    approved: true,
  });
  Assert.ok(
    createStub.calledOnce,
    "createLaunchOnLogin should be called when pref is at its built-in default of true"
  );
});
