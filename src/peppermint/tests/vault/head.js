/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PeppermintVault } = ChromeUtils.importESModule(
  "moz-src:///peppermint/vault/PeppermintVault.sys.mjs"
);
const { PeppermintVaultPassword } = ChromeUtils.importESModule(
  "moz-src:///peppermint/vault/PeppermintVaultPassword.sys.mjs"
);
const { PeppermintVaultRegistry, VaultSectionError } =
  ChromeUtils.importESModule(
    "moz-src:///peppermint/vault/PeppermintVaultRegistry.sys.mjs"
  );
const { PeppermintVaultSession, STATE_TOPIC } = ChromeUtils.importESModule(
  "moz-src:///peppermint/vault/PeppermintVaultSession.sys.mjs"
);
const { PeppermintVaultClipboard } = ChromeUtils.importESModule(
  "moz-src:///peppermint/vault/PeppermintVaultClipboard.sys.mjs"
);

const { EnterprisePolicyTesting } = ChromeUtils.importESModule(
  "resource://testing-common/EnterprisePolicyTesting.sys.mjs"
);

const PRIMARY_PASSWORD = "correct horse battery";

function readClipboardText() {
  const trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(
    Ci.nsITransferable
  );
  trans.init(null);
  trans.addDataFlavor("text/plain");
  Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
  const data = {};
  try {
    trans.getTransferData("text/plain", data);
  } catch {
    return "";
  }
  return data.value?.QueryInterface(Ci.nsISupportsString)?.data ?? "";
}

/**
 * Sets a Primary Password and starts a Vault session on it. Returns a cleanup
 * function that undoes everything, including saved test logins.
 */
async function setUpVault({ stepUpMinutes = 0 } = {}) {
  await PeppermintVaultPassword.change("", PRIMARY_PASSWORD);
  Services.prefs.setBoolPref("peppermint.vault.enabled", true);
  Services.prefs.setIntPref("peppermint.vault.stepup-minutes", stepUpMinutes);
  Services.prefs.setIntPref("peppermint.vault.autolock-minutes", 0);
  PeppermintVault.testing.enter();
  PeppermintVaultSession.lock("test");

  return async () => {
    PeppermintVaultPassword.verify(PRIMARY_PASSWORD);
    await Services.logins.removeAllUserFacingLoginsAsync();
    PeppermintVault.testing.leave();
    await PeppermintVaultPassword.change(PRIMARY_PASSWORD, "");
    for (const pref of [
      "peppermint.vault.enabled",
      "peppermint.vault.stepup-minutes",
      "peppermint.vault.autolock-minutes",
      "peppermint.vault.restore-password-sidebar",
    ]) {
      Services.prefs.clearUserPref(pref);
    }
    PeppermintVaultSession.testing.resetFailures();
    PeppermintVaultSession.testing.setNow(() => Date.now());
  };
}

function unlockVault() {
  const result = PeppermintVaultSession.unlock(PRIMARY_PASSWORD);
  Assert.ok(result.ok, "Vault unlocks with the Primary Password");
}

function newLogin(origin, username, password) {
  const login = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(
    Ci.nsILoginInfo
  );
  login.init(origin, "", null, username, password, "", "");
  return login;
}

async function expectError(promiseOrFn, name, message) {
  try {
    await (typeof promiseOrFn == "function" ? promiseOrFn() : promiseOrFn);
  } catch (error) {
    Assert.equal(error.name, name, message);
    return error;
  }
  Assert.ok(false, `${message}: expected ${name}`);
  return null;
}
