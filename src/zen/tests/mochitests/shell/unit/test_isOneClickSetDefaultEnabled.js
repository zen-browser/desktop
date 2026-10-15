/* Any copyright is dedicated to the Public Domain.
http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

const USER_CHOICE_PREF = "browser.shell.setDefaultBrowserUserChoice";
const REG_RENAME_PREF = "browser.shell.setDefaultBrowserUserChoice.regRename";

function mockNativeShellService(overrides) {
  const mock = {
    QueryInterface: ChromeUtils.generateQI([Ci.nsIWindowsShellService]),
    checkAllProgIDsExist: () => true,
    checkBrowserUserChoiceHashes: () => true,
    isDefaultBrowser: () => false,
    isUserChoiceProtectionDriverRunning: () => false,
    canRenameUserChoiceAssociationKey: sinon.stub().returns(false),
    ...overrides,
  };
  sinon.stub(ShellService, "shellService").value(mock);
  return mock;
}

registerCleanupFunction(() => {
  sinon.restore();
  Services.prefs.clearUserPref(USER_CHOICE_PREF);
  Services.prefs.clearUserPref(REG_RENAME_PREF);
});

add_task(function test_pref_disabled() {
  Services.prefs.setBoolPref(USER_CHOICE_PREF, false);
  const native = mockNativeShellService({
    checkAllProgIDsExist: () => {
      Assert.ok(
        false,
        "Should not check capability when the user choice pref is off"
      );
      return true;
    },
  });

  Assert.strictEqual(
    ShellService.isOneClickSetDefaultEnabled(),
    false,
    "Should be false when the user choice pref is disabled, regardless of capability"
  );
  Assert.ok(
    native.canRenameUserChoiceAssociationKey.notCalled,
    "Should not probe the registry when the user choice pref is off"
  );

  sinon.restore();
});

add_task(function test_user_choice_impossible() {
  Services.prefs.setBoolPref(USER_CHOICE_PREF, true);
  const native = mockNativeShellService({
    checkBrowserUserChoiceHashes: () => false,
  });

  Assert.strictEqual(
    ShellService.isOneClickSetDefaultEnabled(),
    false,
    "Should be false when the existing UserChoice hashes can't be reproduced"
  );
  Assert.ok(
    native.canRenameUserChoiceAssociationKey.notCalled,
    "Should not probe the registry when a UserChoice write can't succeed anyway"
  );

  sinon.restore();
});

add_task(function test_ucpd_not_running() {
  Services.prefs.setBoolPref(USER_CHOICE_PREF, true);
  const native = mockNativeShellService({
    isUserChoiceProtectionDriverRunning: () => false,
  });

  Assert.strictEqual(
    ShellService.isOneClickSetDefaultEnabled(),
    true,
    "Should be true when UCPD isn't running to lock the UserChoice keys"
  );
  Assert.ok(
    native.canRenameUserChoiceAssociationKey.notCalled,
    "Should not probe the registry when UCPD isn't running"
  );

  sinon.restore();
});

add_task(function test_already_default_skips_probe() {
  Services.prefs.setBoolPref(USER_CHOICE_PREF, true);
  const native = mockNativeShellService({
    isUserChoiceProtectionDriverRunning: () => true,
    isDefaultBrowser: () => true,
  });

  Assert.strictEqual(
    ShellService.isOneClickSetDefaultEnabled(),
    true,
    "Should be true without probing when Firefox is already the default"
  );
  Assert.ok(
    native.canRenameUserChoiceAssociationKey.notCalled,
    "Should not probe the registry when Firefox is already the default"
  );

  sinon.restore();
});

add_task(function test_ucpd_running_rename_blocked() {
  Services.prefs.setBoolPref(USER_CHOICE_PREF, true);
  const native = mockNativeShellService({
    isUserChoiceProtectionDriverRunning: () => true,
    canRenameUserChoiceAssociationKey: sinon.stub().returns(false),
  });

  Assert.strictEqual(
    ShellService.isOneClickSetDefaultEnabled(),
    false,
    "Should be false when UCPD is running and blocks the registry rename"
  );
  Assert.ok(
    native.canRenameUserChoiceAssociationKey.calledOnceWith("http"),
    "Should probe the http association"
  );

  sinon.restore();
});

add_task(function test_ucpd_running_rename_permitted() {
  Services.prefs.setBoolPref(USER_CHOICE_PREF, true);
  mockNativeShellService({
    isUserChoiceProtectionDriverRunning: () => true,
    canRenameUserChoiceAssociationKey: sinon.stub().returns(true),
  });

  Assert.strictEqual(
    ShellService.isOneClickSetDefaultEnabled(),
    true,
    "Should be true when UCPD is running but permits the registry rename"
  );

  sinon.restore();
});

add_task(function test_reg_rename_disabled() {
  Services.prefs.setBoolPref(USER_CHOICE_PREF, true);
  Services.prefs.setBoolPref(REG_RENAME_PREF, false);
  const native = mockNativeShellService({
    isUserChoiceProtectionDriverRunning: () => true,
    canRenameUserChoiceAssociationKey: sinon.stub().returns(true),
  });

  Assert.strictEqual(
    ShellService.isOneClickSetDefaultEnabled(),
    false,
    "Should be false when the rename pref is false, as renaming is the only " +
      "way to reach a locked UserChoice key"
  );
  Assert.ok(
    native.canRenameUserChoiceAssociationKey.notCalled,
    "Should not probe the registry when a successful rename wouldn't be used"
  );

  sinon.restore();
  Services.prefs.clearUserPref(REG_RENAME_PREF);
});
