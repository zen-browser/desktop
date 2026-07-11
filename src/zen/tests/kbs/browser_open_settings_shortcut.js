/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { nsKeyShortcutModifiers } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenKeyboardShortcuts.mjs"
);

async function ensureShortcutsReady() {
  if (gZenKeyboardShortcutsManager._currentShortcutList?.length) {
    return;
  }
  await BrowserTestUtils.waitForEvent(window, "ZenKeyboardShortcutsReady");
}

function getOpenSettingsShortcut() {
  return gZenKeyboardShortcutsManager.getShortcutFromCommand(
    "cmd_zenOpenPreferences"
  );
}

add_task(async function test_Open_Settings_Command_And_Default_Shortcut() {
  await ensureShortcutsReady();

  const command = document.getElementById("cmd_zenOpenPreferences");
  Assert.ok(command, "cmd_zenOpenPreferences should exist");

  const shortcut = getOpenSettingsShortcut();
  Assert.ok(shortcut, "Open Settings shortcut should be registered");
  Assert.equal(shortcut.getID(), "zen-open-settings");
  Assert.equal(shortcut.getKeyName(), ",");
  Assert.ok(
    shortcut.getModifiers().accel,
    "Default shortcut should use the accel modifier (Ctrl/Cmd)"
  );
  Assert.equal(shortcut.getGroup(), "zen-other");
  Assert.ok(shortcut.isUserEditable(), "Shortcut should be user-editable");

  const keyEl = document.getElementById("zen-open-settings");
  Assert.ok(keyEl, "zen-open-settings key element should be in the DOM");
  Assert.equal(keyEl.getAttribute("command"), "cmd_zenOpenPreferences");
  Assert.equal(keyEl.getAttribute("key"), ",");
  Assert.ok(
    keyEl.getAttribute("modifiers").includes("accel"),
    "Key element should include accel modifier"
  );
});

add_task(async function test_Open_Settings_Command_Opens_Preferences() {
  await ensureShortcutsReady();

  // Close any existing preferences tabs so we can assert a fresh open.
  for (const tab of [...gBrowser.tabs]) {
    if (tab.linkedBrowser?.currentURI?.spec?.startsWith("about:preferences")) {
      BrowserTestUtils.removeTab(tab);
    }
  }

  const loaded = BrowserTestUtils.waitForNewTab(
    gBrowser,
    url => url.startsWith("about:preferences"),
    true
  );
  document.getElementById("cmd_zenOpenPreferences").doCommand();
  const prefsTab = await loaded;

  Assert.ok(
    gBrowser.selectedBrowser.currentURI.spec.startsWith("about:preferences"),
    "Command should open the settings page"
  );

  BrowserTestUtils.removeTab(prefsTab);
});

add_task(async function test_Open_Settings_Shortcut_Can_Be_Rebound() {
  await ensureShortcutsReady();

  const original = getOpenSettingsShortcut();
  Assert.ok(original, "Open Settings shortcut should exist before rebinding");

  const modifiers = nsKeyShortcutModifiers.fromObject({
    accel: true,
    shift: true,
  });
  await gZenKeyboardShortcutsManager.setShortcut(
    "zen-open-settings",
    ",",
    modifiers
  );

  const rebound = getOpenSettingsShortcut();
  Assert.equal(rebound.getKeyName(), ",");
  Assert.ok(rebound.getModifiers().accel);
  Assert.ok(rebound.getModifiers().shift);

  const keyEl = document.getElementById("zen-open-settings");
  Assert.ok(
    keyEl.getAttribute("modifiers").includes("shift"),
    "Rebound key element should include shift"
  );

  // Restore the default binding for later tests / clean state.
  await gZenKeyboardShortcutsManager.setShortcut(
    "zen-open-settings",
    ",",
    nsKeyShortcutModifiers.fromObject({ accel: true })
  );
});
