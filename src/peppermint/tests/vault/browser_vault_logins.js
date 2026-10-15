/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SECRET = "hunter2-test-password";
let cleanup;

async function call(method, ...args) {
  return PeppermintVaultRegistry.call("logins", method, ...args);
}

add_setup(async function () {
  cleanup = await setUpVault({ stepUpMinutes: 0 });
  registerCleanupFunction(() => cleanup());
  // Saving a login while the token is logged out would open the real
  // Primary Password prompt and block the test.
  unlockVault();
  await Services.logins.addLoginAsync(
    newLogin("https://example.com", "alice", SECRET)
  );
  await Services.logins.addLoginAsync(
    newLogin("http://insecure.example.org", "bob", "another-pass")
  );
  await Services.logins.addLoginAsync(
    newLogin("https://www.nouser.test", "", "third-pass")
  );
});

add_task(async function test_list_has_no_secrets() {
  const items = await call("list");
  Assert.deepEqual(
    items.map(item => item.title),
    ["example.com", "insecure.example.org", "nouser.test"],
    "Sorted by name, www. removed"
  );
  const json = JSON.stringify(items);
  for (const password of [SECRET, "another-pass", "third-pass"]) {
    Assert.ok(!json.includes(password), "List payload carries no password");
  }
  const first = items[0];
  Assert.equal(first.link, "https://example.com", "Site is a link");
  Assert.equal(first.values.username, "alice");
  Assert.deepEqual(first.secrets, { password: true });
  Assert.ok(items[1].insecure, "http logins are flagged");
  Assert.ok(!first.insecure);
});

add_task(async function test_search_and_filter() {
  Assert.deepEqual(
    (await call("list", { query: "ALI" })).map(i => i.title),
    ["example.com"],
    "Search matches usernames, case-insensitively"
  );
  Assert.deepEqual(
    (await call("list", { query: "insecure" })).map(i => i.title),
    ["insecure.example.org"],
    "Search matches sites"
  );
  Assert.deepEqual(
    (await call("list", { filter: "insecure" })).map(i => i.title),
    ["insecure.example.org"]
  );
  Assert.deepEqual(
    (await call("list", { filter: "no-username" })).map(i => i.title),
    ["nouser.test"]
  );
  Assert.equal((await call("list", { query: "zzz" })).length, 0);
});

add_task(async function test_secrets_only_through_getSecret() {
  const [item] = await call("list", { query: "example.com" });
  Assert.equal(await call("getSecret", item.id, "password"), SECRET);
  const error = await expectError(
    () => call("getSecret", item.id, "username"),
    "VaultSectionError",
    "Only the password is a secret"
  );
  Assert.equal(error.code, "unknown-field");
  const editable = await call("getEditable", item.id);
  Assert.deepEqual(editable, { username: "alice", password: SECRET });
});

add_task(async function test_copy_without_reveal() {
  const [item] = await call("list", { query: "example.com" });
  const result = await call("copy", item.id, "password");
  Assert.equal(result, undefined, "copy never returns the value");
  Assert.equal(readClipboardText(), SECRET);
  await call("copy", item.id, "username");
  Assert.equal(readClipboardText(), "alice");
  PeppermintVaultClipboard.clearPending();
});

add_task(async function test_reveal_blocked_by_policy() {
  const [item] = await call("list", { query: "example.com" });
  await EnterprisePolicyTesting.setupPolicyEngineWithJson({
    policies: { DisablePasswordReveal: true },
  });
  try {
    Assert.ok(!Services.policies.isAllowed("passwordReveal"));
    const error = await expectError(
      () => call("getSecret", item.id, "password"),
      "VaultSectionError",
      "The password reveal policy is honored"
    );
    Assert.equal(error.code, "reveal-blocked");
  } finally {
    await EnterprisePolicyTesting.setupPolicyEngineWithJson("");
  }
});

add_task(async function test_edit_login() {
  const [item] = await call("list", { query: "example.com" });
  await call("update", item.id, { username: "alice2", password: "new-pass-1" });
  Assert.deepEqual(await call("getEditable", item.id), {
    username: "alice2",
    password: "new-pass-1",
  });
  const error = await expectError(
    () => call("update", item.id, { password: "" }),
    "VaultSectionError",
    "An empty password is refused"
  );
  Assert.equal(error.code, "empty-password");
  await call("update", item.id, { username: "alice", password: SECRET });
});

add_task(async function test_create_and_duplicate_and_remove() {
  await call("create", {
    origin: "https://added.example.net/some/path?x=1",
    username: "carol",
    password: "carol-pass",
  });
  const [added] = await call("list", { query: "added.example.net" });
  Assert.equal(added.link, "https://added.example.net", "Path is dropped");

  const dup = await expectError(
    () =>
      call("create", {
        origin: "https://added.example.net",
        username: "carol",
        password: "other",
      }),
    "VaultSectionError",
    "Duplicates are refused"
  );
  Assert.equal(dup.code, "exists");
  Assert.equal(
    dup.details.existingId,
    added.id,
    "Points at the existing login"
  );

  const invalid = await expectError(
    () => call("create", { origin: "", username: "x", password: "y" }),
    "VaultSectionError",
    "A missing website is refused"
  );
  Assert.equal(invalid.code, "invalid-origin");

  await call("remove", added.id);
  Assert.equal((await call("list", { query: "added.example.net" })).length, 0);
  const gone = await expectError(
    () => call("remove", added.id),
    "VaultSectionError",
    "Removing twice fails cleanly"
  );
  Assert.equal(gone.code, "not-found");
});

add_task(async function test_nothing_reachable_when_locked() {
  const [item] = await call("list", { query: "example.com" });
  PeppermintVaultSession.lock("test");
  for (const [method, args] of [
    ["list", []],
    ["getSecret", [item.id, "password"]],
    ["getEditable", [item.id]],
    ["copy", [item.id, "password"]],
    ["update", [item.id, { password: "x" }]],
    ["remove", [item.id]],
    ["create", [{ origin: "https://x.test", password: "x" }]],
  ]) {
    await expectError(
      () => call(method, ...args),
      "VaultLockedError",
      `${method} is refused while locked`
    );
  }
  unlockVault();
  Assert.equal(
    (await Services.logins.getAllLogins()).length,
    3,
    "Nothing changed while locked"
  );
});
