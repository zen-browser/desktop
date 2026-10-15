/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const NEW_PASSWORD = "a long enough passphrase";
const PREFS_TO_CLEAR = [
  "peppermint.vault.enabled",
  "peppermint.vault.stepup-minutes",
  "peppermint.vault.autolock-minutes",
  "peppermint.vault.restore-password-sidebar",
];

function doc(tab) {
  return tab.linkedBrowser.contentDocument;
}

async function openVault() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:vault"
  );
  await TestUtils.waitForCondition(
    () => doc(tab)?.getElementById("vault-root")?.childElementCount,
    "The page rendered"
  );
  return tab;
}

function fill(tab, selector, value) {
  doc(tab).querySelector(selector).value = value;
}

function submitForm(tab) {
  const view = doc(tab).defaultView;
  doc(tab)
    .querySelector("form.vault-setup")
    .dispatchEvent(
      new view.Event("submit", { bubbles: true, cancelable: true })
    );
}

function errorShown(tab) {
  const error = doc(tab).querySelector(".vault-setup .vault-form-error");
  return error && !error.hidden;
}

async function resetEverything() {
  if (PeppermintVaultPassword.hasPassword) {
    for (const password of [PRIMARY_PASSWORD, NEW_PASSWORD]) {
      if (PeppermintVaultPassword.verify(password)) {
        await PeppermintVaultPassword.change(password, "");
        break;
      }
    }
  }
  PeppermintVault.testing.leave();
  for (const pref of PREFS_TO_CLEAR) {
    Services.prefs.clearUserPref(pref);
  }
  PeppermintVaultSession.testing.resetFailures();
}

add_setup(function () {
  Services.prefs.setIntPref("peppermint.vault.stepup-minutes", 0);
  registerCleanupFunction(resetEverything);
});

add_task(async function test_enable_with_new_password() {
  Assert.equal(PeppermintVault.state, "off");
  Assert.ok(PeppermintVault.canEnable.allowed);
  const tab = await openVault();
  Assert.ok(doc(tab).querySelector("form.vault-setup"), "Setup is shown");
  Assert.ok(
    doc(tab).querySelector(".vault-warning"),
    "The recovery warning is shown"
  );

  submitForm(tab);
  Assert.ok(errorShown(tab), "The warning must be acknowledged first");
  Assert.ok(!PeppermintVaultPassword.hasPassword, "Nothing was changed");

  doc(tab).getElementById("vault-setup-ack").checked = true;
  fill(tab, "#vault-setup-new", "short");
  fill(tab, "#vault-setup-confirm", "short");
  submitForm(tab);
  Assert.ok(errorShown(tab), "A short password is refused");
  Assert.ok(!PeppermintVaultPassword.hasPassword);

  fill(tab, "#vault-setup-new", NEW_PASSWORD);
  fill(tab, "#vault-setup-confirm", NEW_PASSWORD + "x");
  submitForm(tab);
  Assert.ok(errorShown(tab), "A mismatch is refused");
  Assert.ok(!PeppermintVaultPassword.hasPassword);

  fill(tab, "#vault-setup-new", NEW_PASSWORD);
  fill(tab, "#vault-setup-confirm", NEW_PASSWORD);
  submitForm(tab);
  await TestUtils.waitForCondition(
    () => PeppermintVault.state == "unlocked",
    "Vault is on and unlocked"
  );
  Assert.ok(PeppermintVaultPassword.hasPassword, "Primary Password was set");
  Assert.ok(Services.prefs.getBoolPref("peppermint.vault.enabled"));
  await TestUtils.waitForCondition(
    () => doc(tab).querySelector(".vault-page"),
    "The page switches to the vault"
  );
  for (const input of doc(tab).querySelectorAll("input")) {
    Assert.ok(!input.value, "No password stays in a field");
  }
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_disable_keeps_password_and_logins() {
  await Services.logins.addLoginAsync(
    newLogin("https://example.com", "alice", "keep-me-please")
  );
  PeppermintVault.disable();
  Assert.equal(PeppermintVault.state, "off");
  Assert.ok(!Services.prefs.getBoolPref("peppermint.vault.enabled"));
  Assert.ok(PeppermintVaultPassword.hasPassword, "Primary Password stays");
  PeppermintVaultPassword.verify(NEW_PASSWORD);
  const logins = await Services.logins.getAllLogins();
  Assert.equal(logins.length, 1, "Saved logins are untouched");
  Assert.equal(logins[0].password, "keep-me-please");
  await Services.logins.removeAllUserFacingLoginsAsync();
});

add_task(async function test_enable_with_existing_password() {
  Assert.equal(PeppermintVault.state, "off");
  const tab = await openVault();
  Assert.ok(
    doc(tab).getElementById("vault-setup-current"),
    "An existing Primary Password is asked for, not set again"
  );
  Assert.ok(!doc(tab).getElementById("vault-setup-new"));

  doc(tab).getElementById("vault-setup-ack").checked = true;
  fill(tab, "#vault-setup-current", "wrong password");
  submitForm(tab);
  Assert.ok(errorShown(tab), "A wrong password is refused");
  Assert.equal(PeppermintVault.state, "off");

  fill(tab, "#vault-setup-current", NEW_PASSWORD);
  submitForm(tab);
  await TestUtils.waitForCondition(
    () => PeppermintVault.state == "unlocked",
    "Vault is on"
  );
  BrowserTestUtils.removeTab(tab);
  PeppermintVault.disable();
});

add_task(async function test_complete_setup_needs_a_password() {
  await PeppermintVaultPassword.change(NEW_PASSWORD, "");
  Assert.throws(
    () => PeppermintVault.completeSetup(),
    /Primary Password is required/,
    "Vault cannot be turned on without a Primary Password"
  );
  Assert.ok(!Services.prefs.getBoolPref("peppermint.vault.enabled", false));
});

add_task(async function test_needs_password_state_and_restore() {
  Services.prefs.setBoolPref("peppermint.vault.enabled", true);
  PeppermintVault.testing.enter();
  Assert.equal(PeppermintVault.state, "needs-password");

  const tab = await openVault();
  Assert.ok(doc(tab).querySelector("form.vault-setup"));
  doc(tab).getElementById("vault-setup-ack").checked = true;
  fill(tab, "#vault-setup-new", NEW_PASSWORD);
  fill(tab, "#vault-setup-confirm", NEW_PASSWORD);
  submitForm(tab);
  await TestUtils.waitForCondition(
    () => PeppermintVault.state == "unlocked",
    "A new Primary Password restores Vault"
  );
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_policy_blocks_enabling() {
  await resetEverything();
  await EnterprisePolicyTesting.setupPolicyEngineWithJson({
    policies: { PasswordManagerEnabled: false },
  });
  try {
    const result = PeppermintVault.canEnable;
    Assert.ok(!result.allowed, "The policy blocks Vault");
    Assert.equal(result.reason, "policy");
  } finally {
    await EnterprisePolicyTesting.setupPolicyEngineWithJson("");
  }
});
