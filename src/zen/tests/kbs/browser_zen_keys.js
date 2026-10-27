/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

add_setup(async function () {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);
  registerCleanupFunction(() => {
    CustomKeys.resetAll();
    BrowserTestUtils.removeTab(tab);
  });
});

add_task(function test_zen_keys_have_defaults() {
  const keyset = document.getElementById("zenKeyset");
  ok(keyset, "Zen keyset exists");

  const expected = {
    "zen-compact-mode-toggle": {
      key: "S",
      modifiers: "accel",
      command: "cmd_toggleCompactModeIgnoreHover",
    },
    "zen-workspace-forward": {
      keycode: "VK_RIGHT",
      modifiers: "accel,alt",
      command: "cmd_zenWorkspaceForward",
    },
    "zen-new-empty-split-view": {
      key: "*",
      modifiers: "accel,shift",
      command: "cmd_zenNewEmptySplit",
    },
    "zen-library-toggle": {
      key: "L",
      modifiers: "alt,shift",
      command: "cmd_zenToggleLibrary",
    },
  };
  for (const [id, attributes] of Object.entries(expected)) {
    const keyEl = document.getElementById(id);
    ok(keyEl, `${id} exists`);
    is(keyEl.parentElement, keyset, `${id} is in the Zen keyset`);
    for (const [name, value] of Object.entries(attributes)) {
      is(keyEl.getAttribute(name), value, `${id} has ${name}="${value}"`);
    }
  }

  const switchKey = document.getElementById("zen-workspace-switch-1");
  is(switchKey.getAttribute("key"), "1", "Space switch is bound to its digit");
  is(
    switchKey.getAttribute("modifiers"),
    isMac ? "control" : "alt",
    "with Control on macOS and Alt elsewhere"
  );
  ok(
    isUnassigned(document.getElementById("zen-toggle-sidebar")),
    "Toggle sidebar is unbound by default"
  );
});

add_task(function test_firefox_keys_adjusted() {
  ok(
    document
      .getElementById("mainKeyset")
      .contains(document.getElementById("key_newNavigator")),
    "Firefox keys stay in their own keyset"
  );
  is(
    document.getElementById("key_savePage").getAttribute("modifiers"),
    "accel,alt,shift",
    "Save page moved away from accel+S"
  );
  for (const id of [
    "openFileKb",
    "bookmarkAllTabsKb",
    "key_stop",
    "key_undoCloseWindow",
  ]) {
    const keyEl = document.getElementById(id);
    ok(keyEl, `${id} still exists`);
    ok(isUnassigned(keyEl), `${id} is unbound by default`);
  }
  for (const id of [
    "key_duplicateTab",
    "key_addTabSplitView",
    "key_separateTabSplitView",
    "viewOpenTabsSidebarKb",
  ]) {
    ok(!document.getElementById(id), `${id} is removed`);
  }
});

add_task(function test_shortcut_display_from_command() {
  const display = ZenKeyboardShortcuts.getShortcutDisplayFromCommand(
    window,
    "cmd_zenCopyCurrentURL"
  );
  is(
    display,
    ShortcutUtils.prettifyShortcut(document.getElementById("zen-copy-url")),
    "Display matches the key element"
  );
  is(display, isMac ? "⇧⌘C" : "Ctrl+Shift+C", "Display is prettified");
  is(
    ZenKeyboardShortcuts.getShortcutDisplayFromCommand(
      window,
      "cmd_zenToggleSidebar"
    ),
    null,
    "Unbound command has no display"
  );
  is(
    ZenKeyboardShortcuts.getShortcutDisplayFromCommand(window, "cmd_nope"),
    null,
    "Unknown command has no display"
  );
  is(
    ZenKeyboardShortcuts.getShortcutDisplayFromCommand(window, ""),
    null,
    "Empty command has no display"
  );
});

add_task(async function test_customized_zen_key_runs_command() {
  const sandbox = sinon.createSandbox();
  const forward = sandbox.stub(gZenWorkspaces, "changeWorkspaceShortcut");
  try {
    CustomKeys.changeKey("zen-workspace-forward", {
      modifiers: UNUSED_MODIFIERS,
      key: UNUSED_KEY,
    });
    Assert.deepEqual(
      CustomKeys.getDefaultKey("zen-workspace-forward"),
      { modifiers: "accel,alt", keycode: "VK_RIGHT" },
      "Default is remembered"
    );
    is(
      ZenKeyboardShortcuts.getShortcutDisplayFromCommand(
        window,
        "cmd_zenWorkspaceForward"
      ),
      ShortcutUtils.getModifierString(UNUSED_MODIFIERS) + UNUSED_KEY,
      "Display follows the customization"
    );

    EventUtils.synthesizeKey(UNUSED_KEY, UNUSED_OPTIONS, window);
    await TestUtils.waitForCondition(
      () => forward.called,
      "the customized key to run its command"
    );
    await TestUtils.waitForTick();
    sinon.assert.calledOnce(forward);

    CustomKeys.resetKey("zen-workspace-forward");
    is(
      CustomKeys.getDefaultKey("zen-workspace-forward"),
      null,
      "Key is back to its default"
    );
    EventUtils.synthesizeKey(
      "KEY_ArrowRight",
      { accelKey: true, altKey: true },
      window
    );
    await TestUtils.waitForCondition(
      () => forward.callCount >= 2,
      "the default key to run its command again"
    );
    await TestUtils.waitForTick();
    sinon.assert.calledTwice(forward);
  } finally {
    sandbox.restore();
    CustomKeys.resetAll();
  }
});

add_task(async function test_legacy_migration_keeps_customkeys_settings() {
  const legacyPath = ZenKeyboardShortcuts.legacyFilePath;
  const libraryKey = document.getElementById("zen-library-toggle");
  const glanceKey = document.getElementById("zen-glance-expand");
  try {
    CustomKeys.resetAll();
    CustomKeys.uninitWindow(window);
    CustomKeys.changeKey("zen-library-toggle", {
      modifiers: UNUSED_MODIFIERS,
      key: UNUSED_KEY,
    });
    is(
      CustomKeys.getDefaultKey("zen-library-toggle"),
      null,
      "Nothing is applied yet"
    );
    await IOUtils.writeJSON(legacyPath, {
      shortcuts: [
        {
          id: "zen-library-toggle",
          key: "Y",
          modifiers: { accel: true, alt: true },
        },
        { id: "zen-glance-expand", key: "G", modifiers: { alt: true } },
      ],
    });

    CustomKeys.initWindow(window);
    await TestUtils.waitForCondition(
      async () => !(await IOUtils.exists(legacyPath)),
      "the legacy file to be migrated and removed"
    );

    Assert.deepEqual(
      CustomKeys.getDefaultKey("zen-library-toggle"),
      { modifiers: "alt,shift", key: "L" },
      "The key's default is remembered"
    );
    is(
      libraryKey.getAttribute("modifiers"),
      UNUSED_MODIFIERS,
      "The customKeys.json setting wins over the legacy file"
    );
    is(libraryKey.getAttribute("key"), UNUSED_KEY, "and is applied");
    is(glanceKey.getAttribute("key"), "G", "Legacy values still migrate");
    is(glanceKey.getAttribute("modifiers"), "alt", "and are applied at once");
  } finally {
    await IOUtils.remove(legacyPath, { ignoreAbsent: true });
    CustomKeys.resetAll();
  }
});
