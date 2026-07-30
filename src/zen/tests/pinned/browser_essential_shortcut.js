/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Essential_Shortcut() {
  ok(
    gZenKeyboardShortcutsManager._currentShortcutList?.length,
    "The keyboard shortcut registry should be loaded"
  );

  const shortcut = gZenKeyboardShortcutsManager.getShortcutFromCommand(
    "cmd_zenAddToEssentials"
  );
  ok(shortcut, "A shortcut should be registered for cmd_zenAddToEssentials");
  Assert.equal(shortcut.getKeyName(), "e", "The default key should be E");
  const modifiers = shortcut.getModifiers();
  ok(
    modifiers.accel && modifiers.alt && modifiers.shift,
    "The default modifiers should be accel+alt+shift"
  );

  // Accel+E alone is "key_findSelection" and Accel+Alt+E is "key_netmonitor",
  //  which is why the default carries the extra shift. The registry here has
  //  Firefox's own keyset merged in, so this catches a collision with any of
  //  the bindings, not just the ones Zen declares in this file.
  const conflict = gZenKeyboardShortcutsManager.checkForConflicts(
    shortcut.getKeyName(),
    modifiers,
    shortcut.getID()
  );
  ok(
    !conflict.hasConflicts,
    `Default binding is free, conflicts with: ${conflict.conflictShortcut?.getID()}`
  );

  await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    "https://example.com/",
    true
  );

  const newTab = gBrowser.selectedTab;
  gBrowser.pinTab(newTab);

  ok(newTab.pinned, "The tab should be pinned after calling gBrowser.pinTab()");

  const addedToEssentials = BrowserTestUtils.waitForEvent(
    newTab,
    "TabAddedToEssentials"
  );
  EventUtils.synthesizeKey("e", {
    accelKey: true,
    altKey: true,
    shiftKey: true,
  });
  await addedToEssentials;

  ok(
    newTab.hasAttribute("zen-essential") &&
      newTab.parentNode.getAttribute("container") == "0",
    "The selected tab should be marked as essential."
  );

  gZenPinnedTabManager.removeEssentials(newTab);
  await BrowserTestUtils.removeTab(newTab);
});

add_task(async function test_Essential_Shortcut_Cannot_Be_Added() {
  // A maximum of zero essentials makes canEssentialBeAdded() always fail, the
  // same gate the tab context menu and the urlbar action use.
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tabs.essentials.max", 0]],
  });

  await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    "https://example.com/",
    true
  );

  const newTab = gBrowser.selectedTab;
  gBrowser.pinTab(newTab);

  ok(
    !gZenPinnedTabManager.canEssentialBeAdded(newTab),
    "The tab should not be allowed to become an essential"
  );

  EventUtils.synthesizeKey("e", {
    accelKey: true,
    altKey: true,
    shiftKey: true,
  });
  await TestUtils.waitForTick();

  ok(
    !newTab.hasAttribute("zen-essential"),
    "The tab should stay non-essential when it cannot be added"
  );

  await BrowserTestUtils.removeTab(newTab);
  await SpecialPowers.popPrefEnv();
});
