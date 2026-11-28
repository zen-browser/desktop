/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const LEGACY_PATH = ZenKeyboardShortcuts.legacyFilePath;

function legacyEntry(
  id,
  { key = "", keycode = "", modifiers = {}, group = "other", internal = false }
) {
  return {
    id,
    key,
    keycode,
    group,
    l10nId: "",
    modifiers: {
      control: false,
      alt: false,
      shift: false,
      meta: false,
      accel: false,
      ...modifiers,
    },
    action: "",
    disabled: false,
    reserved: false,
    internal,
  };
}

async function writeLegacy(shortcuts) {
  Services.prefs.setIntPref(LEGACY_VERSION_PREF, 21);
  await IOUtils.writeJSON(LEGACY_PATH, { shortcuts });
}

registerCleanupFunction(async function () {
  CustomKeys.resetAll();
  Services.prefs.clearUserPref(LEGACY_VERSION_PREF);
  await IOUtils.remove(LEGACY_PATH, { ignoreAbsent: true });
});

add_task(async function test_customizations_move_to_customkeys() {
  await writeLegacy([
    legacyEntry("key_gotoHistory", {
      key: UNUSED_KEY.toLowerCase(),
      modifiers: { accel: true, shift: true },
    }),
    legacyEntry("zen-compact-mode-toggle", {
      key: "s",
      modifiers: { accel: true },
    }),
    legacyEntry("zen-split-view-grid", {}),
    legacyEntry("zen-workspace-forward", {
      keycode: "VK_RIGHT",
      modifiers: { accel: true, alt: true },
    }),
    legacyEntry("key_savePage", {
      key: "s",
      modifiers: { accel: true, alt: true, shift: true },
    }),
    legacyEntry("key_undo", {
      key: "q",
      modifiers: { accel: true },
      internal: true,
    }),
    legacyEntry("zen-toggle-web-panel", {
      key: "p",
      modifiers: { accel: true },
    }),
  ]);

  await ZenKeyboardShortcuts.migrateLegacyShortcuts(window);

  Assert.deepEqual(
    CustomKeys.getDefaultKey("key_gotoHistory"),
    { modifiers: isMac ? "accel,shift" : "accel", key: "H" },
    "Customized Firefox key is marked as customized"
  );
  const history = document.getElementById("key_gotoHistory");
  is(history.getAttribute("key"), UNUSED_KEY, "Customized key is applied");
  is(
    history.getAttribute("modifiers"),
    UNUSED_MODIFIERS,
    "Customized modifiers are applied"
  );

  Assert.deepEqual(
    CustomKeys.getDefaultKey("zen-split-view-grid"),
    { modifiers: "accel,alt", key: "G" },
    "Cleared Zen key is marked as customized"
  );
  ok(
    isUnassigned(document.getElementById("zen-split-view-grid")),
    "Cleared Zen key has no binding"
  );

  for (const id of [
    "zen-compact-mode-toggle",
    "zen-workspace-forward",
    "key_savePage",
    "key_undo",
  ]) {
    is(CustomKeys.getDefaultKey(id), null, `${id} is left at its default`);
  }
  is(
    document.getElementById("key_undo").getAttribute("key"),
    "Z",
    "Internal key is untouched"
  );

  ok(!(await IOUtils.exists(LEGACY_PATH)), "Legacy file is removed");
  ok(
    !Services.prefs.prefHasUserValue(LEGACY_VERSION_PREF),
    "Legacy version pref is cleared"
  );

  await ZenKeyboardShortcuts.migrateLegacyShortcuts(window);
  is(
    history.getAttribute("key"),
    UNUSED_KEY,
    "Running again without a file changes nothing"
  );

  CustomKeys.resetAll();
  is(history.getAttribute("key"), "H", "Reset restores the Firefox default");
});

add_task(async function test_existing_customization_wins() {
  CustomKeys.changeKey("zen-library-toggle", {
    modifiers: UNUSED_MODIFIERS,
    key: UNUSED_KEY,
  });
  await writeLegacy([
    legacyEntry("zen-library-toggle", {
      key: "j",
      modifiers: { accel: true, alt: true },
    }),
  ]);

  await ZenKeyboardShortcuts.migrateLegacyShortcuts(window);

  const keyEl = document.getElementById("zen-library-toggle");
  is(keyEl.getAttribute("key"), UNUSED_KEY, "CustomKeys value is kept");
  ok(!(await IOUtils.exists(LEGACY_PATH)), "Legacy file is removed");

  CustomKeys.resetAll();
});

add_task(async function test_unreadable_file_is_dropped() {
  Services.prefs.setIntPref(LEGACY_VERSION_PREF, 21);
  await IOUtils.writeUTF8(LEGACY_PATH, "{ not json");

  await ZenKeyboardShortcuts.migrateLegacyShortcuts(window);

  ok(!(await IOUtils.exists(LEGACY_PATH)), "Unreadable file is removed");
  ok(
    !Services.prefs.prefHasUserValue(LEGACY_VERSION_PREF),
    "Legacy version pref is cleared"
  );
});

add_task(async function test_devtools_keys_wait_for_their_keyset() {
  const keyset = document.getElementById("devtoolsKeyset");
  ok(keyset, "DevTools keyset is present");
  const inspector = document.getElementById("key_inspector");
  const webconsole = document.getElementById("key_webconsole");
  const inspectorDefault = {
    modifiers: inspector.getAttribute("modifiers"),
    key: inspector.getAttribute("key"),
  };
  const webconsoleDefault = {
    modifiers: webconsole.getAttribute("modifiers"),
    key: webconsole.getAttribute("key"),
  };
  const parent = keyset.parentNode;
  keyset.remove();

  try {
    await writeLegacy([
      legacyEntry("key_inspector", {
        key: inspectorDefault.key.toLowerCase(),
        modifiers: Object.fromEntries(
          inspectorDefault.modifiers.split(",").map(m => [m, true])
        ),
        group: "devTools",
      }),
      legacyEntry("key_webconsole", {
        key: "j",
        modifiers: { accel: true, shift: true },
        group: "devTools",
      }),
    ]);

    await ZenKeyboardShortcuts.migrateLegacyShortcuts(window);
    ok(
      await IOUtils.exists(LEGACY_PATH),
      "Legacy file waits for the DevTools keys"
    );

    parent.append(keyset);
    await TestUtils.waitForCondition(
      async () => !(await IOUtils.exists(LEGACY_PATH)),
      "Legacy file is removed once the DevTools keys are applied"
    );

    is(
      CustomKeys.getDefaultKey("key_inspector"),
      null,
      "DevTools key at its default is not customized"
    );
    is(
      inspector.getAttribute("key"),
      inspectorDefault.key,
      "DevTools key keeps its default"
    );
    Assert.deepEqual(
      CustomKeys.getDefaultKey("key_webconsole"),
      webconsoleDefault,
      "Changed DevTools key is customized"
    );
    is(webconsole.getAttribute("key"), "J", "Changed DevTools key is applied");
  } finally {
    CustomKeys.resetAll();
    if (!keyset.isConnected) {
      parent.append(keyset);
    }
  }
});
