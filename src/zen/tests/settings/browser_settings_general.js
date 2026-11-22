/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_download_location() {
  const folder = Services.dirsvc.get("TmpD", Ci.nsIFile);
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.download.useDownloadDir", true],
      ["browser.download.folderList", 2],
      ["browser.download.dir", folder.path],
    ],
  });
  const win = await openSettingsWindow();
  const doc = win.document;
  const list = doc.getElementById("zen-settings-download-location");
  const item = doc.getElementById("zen-settings-download-folder");
  await TestUtils.waitForCondition(
    () => item.label == folder.leafName,
    "The download folder is named in the list"
  );
  is(list.value, "folder", "Saving to a folder selects that folder");
  ok(
    item.getAttribute("image").startsWith("moz-icon://"),
    "The folder is shown with its icon"
  );

  list.value = "ask";
  list.dispatchEvent(new win.Event("command", { bubbles: true }));
  ok(
    !Services.prefs.getBoolPref("browser.download.useDownloadDir"),
    "Ask every time stops saving to the folder"
  );
  await TestUtils.waitForCondition(
    () => list.value == "ask",
    "Ask every time stays selected"
  );
  list.value = "folder";
  list.dispatchEvent(new win.Event("command", { bubbles: true }));
  ok(
    Services.prefs.getBoolPref("browser.download.useDownloadDir"),
    "Choosing the folder saves there again"
  );

  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_sync_states() {
  const win = await openSettingsWindow();
  const doc = win.document;
  const part = id => doc.getElementById(`zen-settings-sync-${id}`);

  setSyncState({ status: UIState.STATUS_NOT_CONFIGURED });
  ok(!part("signed-out").hidden, "Signed out: the sign-in card is shown");
  ok(part("account").hidden, "Signed out: no account card");
  ok(!part("dialog").open, "The sync dialog starts closed");

  setSyncState({
    status: UIState.STATUS_SIGNED_IN,
    email: "zen@example.com",
    displayName: "Zen User",
    syncEnabled: true,
    syncing: false,
    lastSync: new Date(),
  });
  ok(part("signed-out").hidden, "Signed in: the sign-in card is gone");
  ok(!part("account").hidden, "Signed in: the account card is shown");
  ok(part("problem").hidden, "Signed in: no account problem");
  ok(!part("summary-row").hidden, "Signed in: sync is summarized");
  is(
    part("summary-text").dataset.l10nId,
    "zen-settings-window-sync-status-just-now",
    "The summary says when sync last ran"
  );

  doc.querySelector('[data-action="sync-open-dialog"]').click();
  ok(part("dialog").open, "Sync Settings opens the sync dialog");
  ok(part("setup").hidden, "Syncing: no offer to turn sync on");
  ok(!part("engines").hidden, "Syncing: the engines are shown");
  const unpinned = toggleFor(win, "zen.spaces-sync.normal-tabs");
  const unpinnedRow = unpinned.closest(".zen-settings-row");
  await SpecialPowers.pushPrefEnv({
    set: [["services.sync.engine.spaces", true]],
  });
  ok(!unpinnedRow.inert, "Unpinned tabs can be included with spaces sync on");
  Services.prefs.setBoolPref("services.sync.engine.spaces", false);
  ok(unpinnedRow.inert, "But not while spaces aren't synced");
  await SpecialPowers.popPrefEnv();
  doc.querySelector('[data-action="sync-close-dialog"]').click();
  ok(!part("dialog").open, "Done closes the dialog");
  doc.querySelector('[data-action="sync-open-dialog"]').click();
  is(part("name").textContent, "Zen User", "The display name is shown");
  is(part("email").textContent, "zen@example.com", "The email is shown");
  is(
    part("status-text").dataset.l10nId,
    "zen-settings-window-sync-status-just-now",
    "A sync that just finished says so"
  );
  ok(!part("now").disabled, "Sync Now is available when idle");

  setSyncState({
    status: UIState.STATUS_SIGNED_IN,
    email: "zen@example.com",
    syncEnabled: true,
    syncing: true,
    lastSync: new Date(),
  });
  is(part("name").textContent, "zen@example.com", "The email names the user");
  is(part("email").textContent, "", "The email isn't repeated");
  is(
    part("status-text").dataset.l10nId,
    "zen-settings-window-sync-status-syncing",
    "A running sync is reported"
  );
  ok(part("now").disabled, "Sync Now is unavailable during a sync");

  setSyncState({
    status: UIState.STATUS_SIGNED_IN,
    email: "zen@example.com",
    syncEnabled: false,
  });
  ok(!part("setup").hidden, "Sync off: turning it on is offered");
  ok(part("engines").hidden, "Sync off: no engines");
  is(
    part("summary-text").dataset.l10nId,
    "zen-settings-window-sync-off",
    "Sync off: the summary says so"
  );
  ok(part("dialog").open, "The dialog stays open while signed in");

  setSyncState({
    status: UIState.STATUS_LOGIN_FAILED,
    email: "zen@example.com",
  });
  ok(!part("problem").hidden, "Login failed: the problem is reported");
  ok(part("summary-row").hidden, "Login failed: no sync summary");
  ok(!part("dialog").open, "Login failed: the dialog closes");
  is(
    part("problem-text").dataset.l10nId,
    "zen-settings-window-sync-login-failed",
    "Login failed: the user is asked to sign in again"
  );

  await SpecialPowers.pushPrefEnv({
    set: [["identity.fxaccounts.enabled", false]],
  });
  ok(
    doc.getElementById("zen-settings-sync").hidden,
    "Without accounts General doesn't offer sync"
  );
  await SpecialPowers.popPrefEnv();

  UIState.get = originalUIStateGet;
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_launch_on_login() {
  const { LaunchOnLogin } = ChromeUtils.importESModule(
    "resource://gre/modules/LaunchOnLogin.sys.mjs"
  );
  const original = {
    isSupported: LaunchOnLogin.isSupported,
    isEnabled: LaunchOnLogin.isEnabled,
    isAllowed: LaunchOnLogin.isAllowed,
    enable: LaunchOnLogin.enable,
    disable: LaunchOnLogin.disable,
  };
  registerCleanupFunction(() => Object.assign(LaunchOnLogin, original));
  // The real service changes what the system starts at login, so the window
  // is given a stand-in for it.
  let enabled = false;
  let allowed = true;
  let supported = true;
  Object.assign(LaunchOnLogin, {
    isSupported: () => supported,
    isEnabled: async () => enabled,
    isAllowed: async () => allowed,
    enable: async () => {
      enabled = true;
    },
    disable: async () => {
      enabled = false;
    },
  });
  await SpecialPowers.pushPrefEnv({
    set: [["browser.startup.windowsLaunchOnLogin.enabled", true]],
  });

  const win = await openSettingsWindow();
  const toggle = win.document.getElementById("zen-settings-launch-on-login");
  const row = toggle.closest(".zen-settings-row");
  await TestUtils.waitForCondition(
    () => !row.hidden,
    "Launching on login is offered where it is supported"
  );
  ok(!toggle.pressed, "The toggle shows that it is off");
  ok(toggle.ariaLabel, "The toggle is named after its row");

  await clickToggle(toggle);
  await TestUtils.waitForCondition(() => enabled, "Turning it on enables it");
  await clickToggle(toggle);
  await TestUtils.waitForCondition(
    () => !enabled,
    "Turning it off disables it"
  );

  enabled = true;
  allowed = false;
  win.dispatchEvent(new win.Event("activate"));
  await TestUtils.waitForCondition(
    () => toggle.pressed && toggle.disabled,
    "A change made in the system settings shows when the window is active again"
  );

  Services.prefs.setBoolPref(
    "browser.startup.windowsLaunchOnLogin.enabled",
    false
  );
  await TestUtils.waitForCondition(
    () => row.hidden,
    "The row goes away when the feature is turned off"
  );

  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();

  supported = false;
  await SpecialPowers.pushPrefEnv({
    set: [["browser.startup.windowsLaunchOnLogin.enabled", true]],
  });
  const other = await openSettingsWindow();
  ok(
    other.document
      .getElementById("zen-settings-launch-on-login")
      .closest(".zen-settings-row").hidden,
    "It isn't offered where the system doesn't support it"
  );
  await BrowserTestUtils.closeWindow(other);
  await SpecialPowers.popPrefEnv();
});
