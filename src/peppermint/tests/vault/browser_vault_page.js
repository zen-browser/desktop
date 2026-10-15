/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SECRET = "page-test-password-42";
let cleanup;

function doc(tab) {
  return tab.linkedBrowser.contentDocument;
}

async function waitFor(tab, selector, message) {
  await TestUtils.waitForCondition(
    () => doc(tab)?.querySelector(selector),
    message ?? `Waiting for ${selector}`
  );
  return doc(tab).querySelector(selector);
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

function type(tab, selector, value) {
  const input = doc(tab).querySelector(selector);
  input.value = value;
  input.dispatchEvent(
    new (doc(tab).defaultView.Event)("input", { bubbles: true })
  );
}

function submit(tab, formSelector) {
  doc(tab)
    .querySelector(formSelector)
    .dispatchEvent(
      new (doc(tab).defaultView.Event)("submit", {
        bubbles: true,
        cancelable: true,
      })
    );
}

add_setup(async function () {
  cleanup = await setUpVault({ stepUpMinutes: 0 });
  registerCleanupFunction(() => cleanup());
  unlockVault();
  await Services.logins.addLoginAsync(
    newLogin("https://example.com", "alice", SECRET)
  );
});

add_task(async function test_locked_page_shows_no_data() {
  PeppermintVaultSession.lock("test");
  const tab = await openVault();
  await waitFor(tab, ".vault-lock", "Lock screen is shown");

  const text = doc(tab).body.textContent;
  Assert.ok(!text.includes(SECRET), "No password on the lock screen");
  Assert.ok(!text.includes("example.com"), "No site names while locked");
  Assert.ok(!doc(tab).querySelector(".vault-row"), "No rows while locked");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_unlock_list_reveal_lock() {
  PeppermintVaultSession.lock("test");
  const tab = await openVault();
  await waitFor(tab, ".vault-lock");

  type(tab, "#vault-unlock-password", "wrong password here");
  submit(tab, ".vault-lock");
  const error = await waitFor(tab, ".vault-form-error:not([hidden])");
  Assert.ok(error, "A wrong password shows an error");
  PeppermintVaultSession.testing.resetFailures();

  type(tab, "#vault-unlock-password", PRIMARY_PASSWORD);
  submit(tab, ".vault-lock");
  const row = await waitFor(tab, ".vault-row", "Rows appear after unlock");

  Assert.equal(row.querySelector(".vault-site").textContent, "example.com");
  Assert.equal(
    row.querySelector(".vault-site").getAttribute("href"),
    "https://example.com",
    "The site is a link"
  );
  const values = [...row.querySelectorAll(".vault-value")].map(
    v => v.textContent
  );
  Assert.equal(values[0], "alice", "Username is always visible");
  Assert.notEqual(values[1], SECRET, "Password is masked");
  Assert.ok(
    !doc(tab).body.textContent.includes(SECRET),
    "The password is not in the DOM while masked"
  );

  const toggle = row.querySelector("button[aria-pressed]");
  toggle.click();
  await TestUtils.waitForCondition(
    () => row.querySelectorAll(".vault-value")[1].textContent == SECRET,
    "Reveal shows the password"
  );
  Assert.equal(toggle.getAttribute("aria-pressed"), "true");
  toggle.click();
  Assert.notEqual(
    row.querySelectorAll(".vault-value")[1].textContent,
    SECRET,
    "Hide masks it again"
  );
  toggle.click();
  await TestUtils.waitForCondition(
    () => row.querySelectorAll(".vault-value")[1].textContent == SECRET
  );

  PeppermintVaultSession.lock("idle");
  await waitFor(tab, ".vault-lock", "Locking returns to the lock screen");
  Assert.ok(
    !doc(tab).body.textContent.includes(SECRET),
    "Locking removes a revealed password from the DOM"
  );
  Assert.ok(
    doc(tab).querySelector(".vault-notice"),
    "The page explains an automatic lock"
  );
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_copy_does_not_reveal() {
  unlockVault();
  const tab = await openVault();
  const row = await waitFor(tab, ".vault-row");

  const copyButtons = row.querySelectorAll(".vault-field-actions button");
  const copyPassword = [...copyButtons].at(-1);
  copyPassword.click();
  await TestUtils.waitForCondition(
    () => readClipboardText() == SECRET,
    "The password reached the clipboard"
  );
  Assert.notEqual(
    row.querySelectorAll(".vault-value")[1].textContent,
    SECRET,
    "Copying does not reveal"
  );
  PeppermintVaultClipboard.clearPending();
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_edit_modal() {
  unlockVault();
  const tab = await openVault();
  const row = await waitFor(tab, ".vault-row");

  row.querySelector(".vault-row-head .vault-icon-button").click();
  const dialog = await waitFor(tab, "dialog.vault-modal[open]");
  const inputs = dialog.querySelectorAll("input");
  Assert.equal(inputs[0].value, "alice");
  Assert.equal(inputs[1].type, "password", "Password hidden in the modal");
  for (const input of inputs) {
    Assert.equal(
      input.getAttribute("autocomplete"),
      "off",
      "Modal fields opt out of autofill and session restore"
    );
  }

  inputs[0].value = "alice-renamed";
  dialog.querySelector("form").dispatchEvent(
    new (doc(tab).defaultView.Event)("submit", {
      bubbles: true,
      cancelable: true,
    })
  );
  await TestUtils.waitForCondition(
    () => !doc(tab).querySelector("dialog"),
    "Modal closed and removed"
  );
  await TestUtils.waitForCondition(
    () =>
      doc(tab).querySelector(".vault-row .vault-value")?.textContent ==
      "alice-renamed",
    "List refreshed with the new username"
  );
  const [login] = await Services.logins.getAllLogins();
  Assert.equal(login.username, "alice-renamed");
  Assert.equal(login.password, SECRET, "Password unchanged");
  login.username = "alice";
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_legacy_about_logins_redirects() {
  unlockVault();
  PeppermintVault.testing.watchWindow(window);
  const tab = BrowserTestUtils.addTab(gBrowser, "about:logins?filter=example");
  await TestUtils.waitForCondition(
    () => tab.linkedBrowser.currentURI.spec.startsWith("about:vault"),
    "about:logins is redirected to about:vault"
  );
  Assert.equal(
    tab.linkedBrowser.currentURI.spec,
    "about:vault?filter=example",
    "The filter is kept"
  );
  BrowserTestUtils.removeTab(tab);

  Services.prefs.setBoolPref("peppermint.vault.allow-legacy-logins", true);
  const legacy = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:logins"
  );
  await new Promise(resolve => setTimeout(resolve, 500));
  Assert.ok(
    legacy.linkedBrowser.currentURI.spec.startsWith("about:logins"),
    "about:logins is left alone when the escape hatch is on"
  );
  Services.prefs.clearUserPref("peppermint.vault.allow-legacy-logins");
  BrowserTestUtils.removeTab(legacy);
});

add_task(async function test_sidebar_password_manager_switched_off() {
  PeppermintVault.testing.leave();
  Services.prefs.setBoolPref(
    "browser.contextual-password-manager.enabled",
    true
  );
  PeppermintVault.testing.enter();
  Assert.ok(
    !Services.prefs.getBoolPref("browser.contextual-password-manager.enabled"),
    "The password sidebar is switched off while Vault is on"
  );
  PeppermintVault.testing.leave();
  Assert.ok(
    Services.prefs.getBoolPref("browser.contextual-password-manager.enabled"),
    "It is restored when Vault turns off"
  );
  Services.prefs.clearUserPref("browser.contextual-password-manager.enabled");
  PeppermintVault.testing.enter();
});
