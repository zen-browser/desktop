/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function deepFind(root, id) {
  if (root.id === id) {
    return root;
  }
  if (root.shadowRoot) {
    const found = deepFind(root.shadowRoot, id);
    if (found) {
      return found;
    }
  }
  for (const child of root.children ?? []) {
    const found = deepFind(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

function isShown(element) {
  if (!element) {
    return false;
  }
  // Only look inside the setting group: the panes around it may be hidden
  // for reasons that have nothing to do with the Vault row.
  for (let node = element; node; node = node.parentNode ?? node.host) {
    if (node.localName == "setting-group") {
      break;
    }
    if (node.hidden) {
      return false;
    }
  }
  return true;
}

async function openPasswordSettings() {
  window.openPreferences("privacy-logins");
  await TestUtils.waitForCondition(
    () =>
      gBrowser.selectedBrowser.currentURI.spec.startsWith("about:preferences"),
    "Settings opened"
  );
  const tab = gBrowser.selectedTab;
  await TestUtils.waitForCondition(
    () =>
      deepFind(
        tab.linkedBrowser.contentDocument.documentElement,
        "peppermintVaultSetUp"
      ),
    "The Vault row exists in the password settings"
  );
  return tab;
}

add_task(async function test_vault_rows_in_password_settings() {
  Services.prefs.clearUserPref("peppermint.vault.enabled");
  const tab = await openPasswordSettings();
  const root = tab.linkedBrowser.contentDocument.documentElement;

  const setUp = deepFind(root, "peppermintVaultSetUp");
  Assert.ok(isShown(setUp), "Set up is shown while Vault is off");
  Assert.ok(
    !isShown(deepFind(root, "peppermintVaultOpen")),
    "Open is hidden while Vault is off"
  );

  Services.prefs.setBoolPref("peppermint.vault.enabled", true);
  await TestUtils.waitForCondition(
    () => isShown(deepFind(root, "peppermintVaultOpen")),
    "Open appears once Vault is on"
  );
  Assert.ok(
    !isShown(deepFind(root, "peppermintVaultSetUp")),
    "Set up disappears once Vault is on"
  );

  Services.prefs.clearUserPref("peppermint.vault.enabled");
  await TestUtils.waitForCondition(
    () => isShown(deepFind(root, "peppermintVaultSetUp")),
    "Set up returns when Vault is turned off"
  );
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_primary_password_cannot_be_turned_off_while_on() {
  await PeppermintVaultPassword.change("", PRIMARY_PASSWORD);
  Services.prefs.setBoolPref("peppermint.vault.enabled", true);
  const tab = await openPasswordSettings();
  const root = tab.linkedBrowser.contentDocument.documentElement;
  const turnOff = await TestUtils.waitForCondition(
    () => deepFind(root, "turnOffPrimaryPassword"),
    "The turn off button exists"
  );
  Assert.ok(turnOff.hasAttribute("disabled"), "Turning it off is blocked");
  BrowserTestUtils.removeTab(tab);

  Services.prefs.clearUserPref("peppermint.vault.enabled");
  PeppermintVaultPassword.verify(PRIMARY_PASSWORD);
  await PeppermintVaultPassword.change(PRIMARY_PASSWORD, "");
});
