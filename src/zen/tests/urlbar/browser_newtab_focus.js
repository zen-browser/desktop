/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  ExtensionControlledPopup:
    "resource:///modules/ExtensionControlledPopup.sys.mjs",
  ExtensionSettingsStore:
    "resource://gre/modules/ExtensionSettingsStore.sys.mjs",
});

let newTabExtension;

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.urlbar.replace-newtab", false],
      ["zen.theme.hide-unified-extensions-button", true],
      ["zen.window-sync.enabled", false],
    ],
  });
  const originalTestingEnabled = gZenUIManager.testingEnabled;
  gZenUIManager.testingEnabled = false;
  registerCleanupFunction(() => {
    gZenUIManager.testingEnabled = originalTestingEnabled;
  });

  newTabExtension = ExtensionTestUtils.loadExtension({
    manifest: { chrome_url_overrides: { newtab: "newtab.html" } },
    files: {
      "newtab.html": "<!DOCTYPE html><title>New Tab focus test</title>",
    },
    useAddonManager: "temporary",
  });
  await newTabExtension.startup();
  registerCleanupFunction(() => newTabExtension.unload());
});

add_task(async function test_first_newtab_confirmation_restores_focus() {
  const originalTabs = new Set(gBrowser.tabs);
  const panel = ExtensionControlledPopup._getAndMaybeCreatePanel(document);
  const shown = BrowserTestUtils.waitForEvent(panel, "popupshown");
  await TestUtils.waitForCondition(
    () => AboutNewTab.willNotifyUser,
    "The first new-tab confirmation is pending"
  );

  await SimpleTest.promiseFocus(window);
  gBrowser.selectedBrowser.focus();
  document.getElementById("cmd_newNavigatorTabNoEvent").doCommand();
  await shown;

  Assert.equal(
    panel.anchorNode,
    gUnifiedExtensions._button,
    "The confirmation uses Zen's active extensions button"
  );
  Assert.ok(
    BrowserTestUtils.isVisible(panel.anchorNode),
    "The confirmation anchor is visible"
  );

  panel.dispatchEvent(
    new Event("buttoncommand", { bubbles: true, cancelable: true })
  );
  await TestUtils.waitForCondition(
    () => gURLBar.focused,
    "Keeping the extension's new-tab page focuses the address bar"
  );
  Assert.ok(
    ExtensionSettingsStore.getSetting("newTabNotification", newTabExtension.id)
      .value,
    "The user's confirmation is saved"
  );

  gBrowser.selectedBrowser.focus();
  document.getElementById("cmd_newNavigatorTabNoEvent").doCommand();
  await TestUtils.waitForCondition(
    () => gURLBar.focused,
    "The next new tab also focuses the address bar"
  );
  for (const tab of gBrowser.tabs) {
    if (!originalTabs.has(tab)) {
      BrowserTestUtils.removeTab(tab);
    }
  }
});

add_task(async function test_window_startup_preserves_newtab_focus() {
  const win = await BrowserTestUtils.openNewBrowserWindow({
    url: AboutNewTab.newTabURL,
  });
  try {
    await win.gZenWorkspaces.promiseInitialized;
    await SimpleTest.promiseFocus(win);
    const tab = win.gBrowser.selectedTab;

    // Testing mode skips selectStartPage during window initialization.
    // Recreate Firefox's initial focus before running Zen's deferred step.
    win.gZenWorkspaces._initialTab = tab;
    tab._veryPossiblyEmpty = false;
    win.gURLBar.select();
    win.gZenUIManager.testingEnabled = false;
    await win.gZenWorkspaces.selectStartPage();
    await TestUtils.waitForTick();

    Assert.ok(
      win.gURLBar.focused,
      "Zen preserves the address-bar focus Firefox set for the new-tab page"
    );
    EventUtils.sendString("example.com", win);
    Assert.ok(
      win.gURLBar.value.includes("example.com"),
      "Typing reaches the address bar without another new-tab shortcut"
    );
  } finally {
    await BrowserTestUtils.closeWindow(win);
  }
});
