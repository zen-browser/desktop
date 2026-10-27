// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  CustomKeys: "moz-src:///browser/components/customkeys/CustomKeys.sys.mjs",
  ShortcutUtils: "resource://gre/modules/ShortcutUtils.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/preferences/zen-preferences.ftl"])
);

// Shortcuts used to live in this file, managed entirely by Zen. They are now
// plain <key> elements in zen-keysets.inc.xhtml and customizations are
// handled by Firefox's CustomKeys (about:keyboard). The file is read once to
// carry the user's customizations over and then deleted.
const LEGACY_FILE = "zen-keyboard-shortcuts.json";
const LEGACY_VERSION_PREF = "zen.keyboard.shortcuts.version";
// Legacy entries in this group belong to a keyset that DevTools only adds
// to the window later, so they cannot be compared to their defaults until
// then.
const LEGACY_DEVTOOLS_GROUP = "devTools";

/**
 * Zen's own shortcuts, grouped the way about:keyboard shows them.
 */
const ZEN_KEY_CATEGORIES = [
  {
    l10nId: "zenCKSOption-group-zen-compact-mode",
    keys: [
      ["zen-compact-mode-toggle", "zen-compact-mode-shortcut-toggle"],
      [
        "zen-compact-mode-show-sidebar",
        "zen-compact-mode-shortcut-show-sidebar",
      ],
    ],
  },
  {
    l10nId: "zenCKSOption-group-zen-workspace",
    menuId: "zen-spaces-menubar",
    keys: [
      ...Array.from({ length: 10 }, (_, i) => [
        `zen-workspace-switch-${i + 1}`,
        `zen-workspace-shortcut-switch-${i + 1}`,
      ]),
      ["zen-workspace-create", "zen-workspace-shortcut-create"],
      ["zen-close-all-unpinned-tabs", "zen-close-all-unpinned-tabs-shortcut"],
    ],
  },
  {
    l10nId: "zenCKSOption-group-zen-split-view",
    keys: [
      ["zen-split-view-grid", "zen-split-view-shortcut-grid"],
      ["zen-split-view-vertical", "zen-split-view-shortcut-vertical"],
      ["zen-split-view-horizontal", "zen-split-view-shortcut-horizontal"],
      ["zen-split-view-unsplit", "zen-split-view-shortcut-unsplit"],
      ["zen-new-empty-split-view", "zen-new-empty-split-view-shortcut"],
    ],
  },
  {
    l10nId: "zenCKSOption-group-zen-other",
    keys: [
      ["zen-toggle-sidebar", "zen-sidebar-shortcut-toggle"],
      ["zen-library-toggle", "zen-library-shortcut-toggle"],
      ["zen-glance-expand", "zen-glance-expand"],
      ["zen-toggle-pin-tab", "zen-toggle-pin-tab-shortcut"],
      ["zen-pinned-tab-reset-shortcut", "zen-pinned-tab-shortcut-reset"],
      ["zen-duplicate-tab", "zen-duplicate-tab-shortcut"],
      ["zen-copy-url", "zen-text-action-copy-url-shortcut"],
      ["zen-copy-url-markdown", "zen-text-action-copy-url-markdown-shortcut"],
    ],
  },
];

/**
 * Normalize a list of modifier names into the comma separated form that
 * CustomKeys stores, folding together the modifiers that mean the same
 * thing on this platform. The legacy format treated Control as Accel
 * outside macOS and Meta as Accel on macOS, and about:keyboard records
 * modifiers the same way, so this makes both comparable.
 *
 * @param {string[]} names
 * @returns {string}
 */
function normalizeModifiers(names) {
  const isMac = AppConstants.platform == "macosx";
  const out = new Set();
  for (let name of names) {
    name = name.trim().toLowerCase();
    switch (name) {
      case "ctrl":
      case "control":
        out.add(isMac ? "control" : "accel");
        break;
      case "accel":
        out.add("accel");
        break;
      case "meta":
        if (isMac) {
          out.add("accel");
        } else if (AppConstants.platform != "win") {
          out.add("meta");
        }
        break;
      case "alt":
      case "shift":
        out.add(name);
        break;
    }
  }
  return [...out].sort().join(",");
}

/**
 * Build a CustomKeys binding ({ modifiers, key, keycode }, each only present
 * when set) from raw attribute-like values.
 *
 * @param {string[]} modifierNames
 * @param {string} key
 * @param {string} keycode
 */
function bindingFrom(modifierNames, key, keycode) {
  const binding = {};
  const modifiers = normalizeModifiers(modifierNames);
  if (modifiers) {
    binding.modifiers = modifiers;
  }
  if (keycode) {
    binding.keycode = keycode.toUpperCase();
  } else if (key) {
    binding.key = key.toUpperCase();
  }
  return binding;
}

function bindingFromLegacy({ key, keycode, modifiers }) {
  const names = Object.entries(modifiers ?? {})
    .filter(([, active]) => active)
    .map(([name]) => name);
  return bindingFrom(names, key, keycode);
}

function bindingFromAttributes(modifiers, key, keycode) {
  return bindingFrom(modifiers ? modifiers.split(",") : [], key, keycode);
}

function sameBinding(a, b) {
  return (
    normalizeModifiers(a.modifiers?.split(",") ?? []) ==
      normalizeModifiers(b.modifiers?.split(",") ?? []) &&
    (a.key ?? "").toUpperCase() == (b.key ?? "").toUpperCase() &&
    (a.keycode ?? "").toUpperCase() == (b.keycode ?? "").toUpperCase()
  );
}

/**
 * The binding a <key> element ships with. Keys defined through Fluent get
 * their key attribute asynchronously, so fall back to the translation when
 * the attribute is not there yet.
 *
 * @param {Element} keyEl
 */
async function defaultBindingOf(keyEl) {
  let key = keyEl.getAttribute("key");
  let keycode = keyEl.getAttribute("keycode");
  const l10nId = keyEl.getAttribute("data-l10n-id");
  if (!key && !keycode && l10nId) {
    try {
      const [message] = await keyEl.ownerDocument.l10n.formatMessages([
        { id: l10nId },
      ]);
      for (const { name, value } of message?.attributes ?? []) {
        if (name == "key") {
          key = value;
        } else if (name == "keycode") {
          keycode = value;
        }
      }
    } catch (e) {
      console.error("Zen CKS: Could not resolve default key for", l10nId, e);
    }
  }
  return bindingFromAttributes(keyEl.getAttribute("modifiers"), key, keycode);
}

class nsZenKeyboardShortcuts {
  #legacyMigration = null;

  get legacyFilePath() {
    return PathUtils.join(PathUtils.profileDir, LEGACY_FILE);
  }

  /**
   * Get the shortcut bound to a command, formatted for display.
   *
   * @param {Window} window The browser window to look in.
   * @param {string} command The id of the <command> the key triggers.
   * @returns {string|null} The shortcut, or null when nothing is bound.
   */
  getShortcutDisplayFromCommand(window, command) {
    if (!command) {
      return null;
    }
    const keyEl = window.document.querySelector(
      `key[command="${window.CSS.escape(command)}"]:not([disabled="true"])`
    );
    if (!keyEl?.hasAttribute("key") && !keyEl?.hasAttribute("keycode")) {
      return null;
    }
    return lazy.ShortcutUtils.prettifyShortcut(keyEl);
  }

  /**
   * Extend the key list that about:keyboard shows with Zen's shortcuts.
   *
   * @param {JSWindowActorParent} actor The CustomKeysParent actor serving the page.
   * @param {object} keys Firefox's categories, as built by the actor's getKeys().
   * @returns {Promise<object>} The same object with Zen's categories added.
   */
  async addKeys(actor, keys) {
    const document = actor.browsingContext.topChromeWindow.document;
    const l10nIds = new Set();
    for (const category of ZEN_KEY_CATEGORIES) {
      l10nIds.add(category.l10nId);
      for (const [, l10nId] of category.keys) {
        l10nIds.add(l10nId);
      }
    }
    const ids = [...l10nIds];
    const values = await lazy.l10n.formatValues(ids.map(id => ({ id })));
    const text = Object.fromEntries(ids.map((id, i) => [id, values[i] ?? id]));

    for (const category of ZEN_KEY_CATEGORIES) {
      const menu = category.menuId
        ? document.getElementById(category.menuId)
        : null;
      const label = menu?.label || text[category.l10nId];
      const entries = {};
      for (const [id, l10nId] of category.keys) {
        const data = actor.getKeyData(id);
        if (!data) {
          continue;
        }
        data.title = text[l10nId];
        entries[id] = data;
      }
      if (Object.keys(entries).length) {
        Object.assign((keys[label] ??= {}), entries);
      }
    }
    return keys;
  }

  /**
   * Move the customizations from Zen's old shortcuts file into CustomKeys.
   *
   * @param {Window} window
   * @returns {Promise<void>}
   */
  migrateLegacyShortcuts(window) {
    this.#legacyMigration ??= this.#migrateLegacyShortcuts(window)
      .catch(e => console.error("Zen CKS: Legacy shortcut migration failed", e))
      .finally(() => {
        this.#legacyMigration = null;
      });
    return this.#legacyMigration;
  }

  async #migrateLegacyShortcuts(window) {
    const path = this.legacyFilePath;
    let legacy;
    try {
      legacy = await IOUtils.readJSON(path);
    } catch (e) {
      if (e.name == "NotFoundError") {
        return;
      }
      console.error("Zen CKS: Dropping unreadable legacy shortcuts file", e);
      await this.#finishLegacyMigration(path);
      return;
    }

    // Keys that are not in the window yet, mapped to the binding they get.
    const pending = new Map();
    for (const shortcut of legacy?.shortcuts ?? []) {
      const id = shortcut?.id;
      if (!id || shortcut.internal) {
        continue;
      }
      const binding = bindingFromLegacy(shortcut);
      const keyEl = window.document.getElementById(id);
      if (!keyEl || keyEl.tagName != "key") {
        if (shortcut.group == LEGACY_DEVTOOLS_GROUP) {
          pending.set(id, binding);
        }
        continue;
      }
      if (keyEl.getAttribute("internal") == "true") {
        continue;
      }
      // A key that CustomKeys already customized keeps that customization.
      if (lazy.CustomKeys.getDefaultKey(id)) {
        continue;
      }
      if (sameBinding(binding, await defaultBindingOf(keyEl))) {
        continue;
      }
      lazy.CustomKeys.changeKey(id, binding);
    }

    Services.prefs.clearUserPref(LEGACY_VERSION_PREF);
    if (!pending.size) {
      await this.#finishLegacyMigration(path);
      return;
    }
    for (const [id, binding] of pending) {
      lazy.CustomKeys.changeKey(id, binding);
    }
    this.#resetDefaultsOnceAdded(window, pending, path);
  }

  #resetDefaultsOnceAdded(window, pending, path) {
    const check = () => {
      for (const [id, binding] of pending) {
        const defaultKey = lazy.CustomKeys.getDefaultKey(id);
        if (!defaultKey) {
          continue;
        }
        pending.delete(id);
        if (sameBinding(binding, defaultKey)) {
          lazy.CustomKeys.resetKey(id);
        }
      }
      if (!pending.size) {
        observer.disconnect();
        this.#finishLegacyMigration(path);
      }
    };
    const observer = new window.MutationObserver(() => {
      if (pending.size) {
        Promise.resolve().then(check);
      }
    });
    observer.observe(window.document.body, { childList: true });
    window.addEventListener("unload", () => observer.disconnect(), {
      once: true,
    });
  }

  async #finishLegacyMigration(path) {
    Services.prefs.clearUserPref(LEGACY_VERSION_PREF);
    await IOUtils.remove(path, { ignoreAbsent: true });
  }
}

export const ZenKeyboardShortcuts = new nsZenKeyboardShortcuts();
