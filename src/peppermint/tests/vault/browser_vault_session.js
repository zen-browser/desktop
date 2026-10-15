/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

let cleanup;

add_setup(async function () {
  cleanup = await setUpVault({ stepUpMinutes: 5 });
  registerCleanupFunction(() => cleanup());
});

add_task(async function test_default_prefs() {
  const defaults = Services.prefs.getDefaultBranch("");
  Assert.equal(defaults.getBoolPref("peppermint.vault.enabled"), false);
  Assert.equal(defaults.getBoolPref("peppermint.vault.prompted"), false);
  Assert.equal(defaults.getIntPref("peppermint.vault.autolock-minutes"), 15);
  Assert.equal(defaults.getIntPref("peppermint.vault.stepup-minutes"), 5);
  Assert.equal(
    defaults.getIntPref("peppermint.vault.clipboard-clear-seconds"),
    30
  );
});

add_task(async function test_password_policy() {
  Assert.deepEqual(PeppermintVaultPassword.validateNew(""), {
    ok: false,
    reason: "empty",
  });
  Assert.deepEqual(PeppermintVaultPassword.validateNew("short"), {
    ok: false,
    reason: "too-short",
  });
  Assert.ok(PeppermintVaultPassword.validateNew("long enough").ok);
  Assert.greater(
    PeppermintVaultPassword.strength("Tr0ub4dor&3 horse staple"),
    PeppermintVaultPassword.strength("password"),
    "A longer mixed password is stronger"
  );
  Assert.equal(PeppermintVaultPassword.strength(""), 0);
});

add_task(async function test_unlock_and_wrong_password() {
  PeppermintVaultSession.lock("test");
  Assert.ok(!PeppermintVaultSession.isUnlocked, "Starts locked");

  const wrong = PeppermintVaultSession.unlock("not the password");
  Assert.ok(!wrong.ok, "A wrong password does not unlock");
  Assert.greater(wrong.retryAfterMs, 0, "A wrong password starts a backoff");
  Assert.ok(!PeppermintVaultSession.isUnlocked);
  Assert.ok(
    !PeppermintVaultPassword.isLoggedIn,
    "A wrong attempt leaves the token logged out"
  );

  const blocked = PeppermintVaultSession.unlock(PRIMARY_PASSWORD);
  Assert.ok(!blocked.ok && blocked.blocked, "Attempts are blocked in backoff");

  PeppermintVaultSession.testing.resetFailures();
  unlockVault();
  Assert.ok(PeppermintVaultSession.isUnlocked);
  Assert.ok(PeppermintVaultPassword.isLoggedIn);
});

add_task(async function test_lock_logs_out_and_notifies() {
  unlockVault();
  const states = [];
  const observer = {
    observe(_subject, _topic, data) {
      states.push(data);
    },
  };
  Services.obs.addObserver(observer, STATE_TOPIC);

  PeppermintVaultSession.lock("manual");
  Services.obs.removeObserver(observer, STATE_TOPIC);

  Assert.deepEqual(states, ["locked"], "Locking notifies once");
  Assert.ok(!PeppermintVaultPassword.isLoggedIn, "NSS token is logged out");
  Assert.equal(PeppermintVaultSession.lastLockReason, "manual");
});

add_task(async function test_idle_and_sleep_lock() {
  unlockVault();
  PeppermintVaultSession.observe(null, "idle");
  Assert.ok(!PeppermintVaultSession.isUnlocked, "Idle locks");
  Assert.equal(PeppermintVaultSession.lastLockReason, "idle");

  unlockVault();
  Services.prefs.setBoolPref("peppermint.vault.lock-on-sleep", false);
  PeppermintVaultSession.observe(null, "sleep_notification");
  Assert.ok(PeppermintVaultSession.isUnlocked, "Sleep lock can be turned off");

  Services.prefs.setBoolPref("peppermint.vault.lock-on-sleep", true);
  PeppermintVaultSession.observe(null, "sleep_notification");
  Assert.ok(!PeppermintVaultSession.isUnlocked, "Sleep locks");
  Assert.equal(PeppermintVaultSession.lastLockReason, "sleep");
  Services.prefs.clearUserPref("peppermint.vault.lock-on-sleep");
});

add_task(async function test_token_logged_out_elsewhere_locks() {
  unlockVault();
  PeppermintVaultPassword.logout();
  Assert.ok(
    !PeppermintVaultSession.isUnlocked,
    "A logged out token ends the session"
  );
});

add_task(async function test_step_up_tier() {
  let now = Date.now();
  PeppermintVaultSession.testing.setNow(() => now);
  unlockVault();

  Assert.ok(
    !PeppermintVaultSession.stepUpRequired,
    "Fresh entry needs no step-up"
  );
  PeppermintVaultSession.ensureRecentAuth();

  now += 6 * 60 * 1000;
  Assert.ok(PeppermintVaultSession.stepUpRequired, "Step-up after 5 minutes");
  PeppermintVaultSession.ensureUnlocked();
  await expectError(
    () => PeppermintVaultSession.ensureRecentAuth(),
    "VaultStepUpRequiredError",
    "Sensitive actions need the password again"
  );

  Assert.ok(PeppermintVaultSession.stepUp(PRIMARY_PASSWORD).ok);
  Assert.ok(!PeppermintVaultSession.stepUpRequired, "Step-up resets the clock");

  now += 6 * 60 * 1000;
  PeppermintVaultSession.testing.resetFailures();
  const wrong = PeppermintVaultSession.stepUp("wrong");
  Assert.ok(!wrong.ok);
  Assert.ok(
    !PeppermintVaultSession.isUnlocked,
    "A wrong step-up password ends the session"
  );
  PeppermintVaultSession.testing.resetFailures();
  PeppermintVaultSession.testing.setNow(() => Date.now());
});

add_task(async function test_registry_enforces_gate() {
  const calls = [];
  PeppermintVaultRegistry.register({
    id: "fake",
    titleL10nId: "peppermint-vault-section-logins",
    fields: [
      { id: "name", kind: "text", copy: true },
      { id: "secret", kind: "secret", copy: true, reveal: true },
    ],
    async list() {
      calls.push("list");
      return [];
    },
    async getSecret() {
      calls.push("getSecret");
      return "s3cret";
    },
    async copy(id, fieldId) {
      calls.push(`copy:${fieldId}`);
    },
  });
  registerCleanupFunction(() => PeppermintVaultRegistry.unregister("fake"));

  PeppermintVaultSession.lock("test");
  for (const method of ["list", "getSecret", "copy"]) {
    await expectError(
      () => PeppermintVaultRegistry.call("fake", method, "id", "name"),
      "VaultLockedError",
      `${method} is refused while locked`
    );
  }
  await expectError(
    () => PeppermintVaultRegistry.describeAll(),
    "VaultLockedError",
    "Section descriptions are refused while locked"
  );
  Assert.deepEqual(calls, [], "No section code ran while locked");

  unlockVault();
  await PeppermintVaultRegistry.call("fake", "list");
  Assert.deepEqual(calls, ["list"]);

  const error = await expectError(
    () => PeppermintVaultRegistry.call("fake", "nonsense"),
    "VaultSectionError",
    "Unknown methods are refused"
  );
  Assert.equal(error.code, "unknown-call");
  await expectError(
    () => PeppermintVaultRegistry.call("fake", "create", {}),
    "VaultSectionError",
    "Methods a section does not implement are refused"
  );

  const now = Date.now() + 6 * 60 * 1000;
  PeppermintVaultSession.testing.setNow(() => now);
  await PeppermintVaultRegistry.call("fake", "copy", "id", "name");
  await expectError(
    () => PeppermintVaultRegistry.call("fake", "copy", "id", "secret"),
    "VaultStepUpRequiredError",
    "Copying a secret needs a recent password entry"
  );
  await expectError(
    () => PeppermintVaultRegistry.call("fake", "getSecret", "id", "secret"),
    "VaultStepUpRequiredError",
    "Revealing needs a recent password entry"
  );
  Assert.deepEqual(
    calls,
    ["list", "copy:name"],
    "Plain fields need the session only, secrets need the step-up"
  );
  PeppermintVaultSession.testing.setNow(() => Date.now());
});

add_task(async function test_registry_rejects_bad_sections() {
  Assert.throws(
    () => PeppermintVaultRegistry.register({ id: "x" }),
    /titleL10nId/,
    "A section needs a title"
  );
  Assert.throws(
    () =>
      PeppermintVaultRegistry.register({
        id: "x",
        titleL10nId: "t",
        fields: [{ id: "a" }, { id: "a" }],
        list() {},
        copy() {},
        getSecret() {},
      }),
    /bad field id/,
    "Field ids must be unique"
  );
});

add_task(async function test_clipboard_clear_only_when_unchanged() {
  Services.prefs.setIntPref("peppermint.vault.clipboard-clear-seconds", 30);
  PeppermintVaultClipboard.copy("vault-secret-1");
  Assert.equal(readClipboardText(), "vault-secret-1");
  Assert.ok(PeppermintVaultClipboard.hasPending);
  Assert.ok(
    PeppermintVaultClipboard.clearPending(),
    "Clears an unchanged copy"
  );
  Assert.equal(readClipboardText(), "", "Clipboard is empty");
  Assert.ok(!PeppermintVaultClipboard.hasPending);

  PeppermintVaultClipboard.copy("vault-secret-2");
  Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper)
    .copyString("something else");
  Assert.ok(
    !PeppermintVaultClipboard.clearPending(),
    "Does not clear something the user copied afterwards"
  );
  Assert.equal(readClipboardText(), "something else");

  PeppermintVaultClipboard.copy("vault-secret-3");
  PeppermintVaultSession.unlock(PRIMARY_PASSWORD);
  PeppermintVaultSession.lock("test");
  Assert.equal(readClipboardText(), "", "Locking clears a pending copy");

  Services.prefs.setIntPref("peppermint.vault.clipboard-clear-seconds", 0);
  PeppermintVaultClipboard.copy("vault-secret-4");
  Assert.ok(!PeppermintVaultClipboard.hasPending, "0 turns clearing off");
  Services.prefs.clearUserPref("peppermint.vault.clipboard-clear-seconds");
  Services.clipboard.emptyClipboard(Services.clipboard.kGlobalClipboard);
});

add_task(async function test_removing_password_locks() {
  unlockVault();
  await PeppermintVaultPassword.change(PRIMARY_PASSWORD, "");
  Assert.ok(!PeppermintVaultSession.isUnlocked, "No password means locked");
  Assert.equal(PeppermintVault.state, "needs-password");
  await PeppermintVaultPassword.change("", PRIMARY_PASSWORD);
  PeppermintVaultSession.lock("test");
  Assert.equal(PeppermintVault.state, "locked");
});
