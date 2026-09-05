/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SHORTCUT_ID = "zen-workspace-switch-1";
const COMMAND_ID = "cmd_zenWorkspaceSwitch1";

add_task(async function test_shifted_shortcuts_use_physical_keycodes() {
  const manager = window.gZenKeyboardShortcutsManager;
  const shortcut = manager.getShortcutFromCommand(COMMAND_ID);

  Assert.ok(shortcut, "Workspace shortcut should be available");

  const originalKey = shortcut.getKeyName();
  const originalModifiers = shortcut.getModifiers();

  registerCleanupFunction(async () => {
    if (originalKey) {
      await manager.setShortcut(SHORTCUT_ID, originalKey, originalModifiers);
    } else {
      await manager.setShortcut(SHORTCUT_ID, null, null);
    }
  });

  const modifiers = originalModifiers.constructor.fromObject({
    accel: true,
    shift: true,
  });

  for (const [keyName, keycode] of [
    ["1", "VK_1"],
    ["=", "VK_EQUALS"],
  ]) {
    await manager.setShortcut(SHORTCUT_ID, keyName, modifiers);

    const key = document.getElementById(SHORTCUT_ID);
    Assert.equal(
      key.getAttribute("keycode"),
      keycode,
      `${keyName} should use its physical keycode`
    );
    Assert.ok(!key.hasAttribute("key"), "Character key should be removed");
    Assert.equal(
      key.getAttribute("modifiers"),
      "accel,shift",
      "Shift should remain part of the shortcut"
    );
    Assert.equal(
      key.getAttribute("event"),
      "keydown",
      "Physical keycodes should be matched before printable keypress"
    );
  }

  await manager.setShortcut(SHORTCUT_ID, "1", modifiers);

  const command = document.getElementById(COMMAND_ID);
  let commandFired = false;
  command.addEventListener(
    "command",
    event => {
      commandFired = true;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true, once: true }
  );

  EventUtils.synthesizeKey("1", { accelKey: true, shiftKey: true }, window);
  await TestUtils.waitForCondition(
    () => commandFired,
    "Shifted digit shortcut should trigger its command"
  );
  Assert.ok(commandFired, "Shifted digit shortcut should trigger its command");
});
