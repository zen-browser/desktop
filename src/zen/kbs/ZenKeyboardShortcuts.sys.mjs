// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  CustomKeys: "moz-src:///browser/components/customkeys/CustomKeys.sys.mjs",
  CustomKeysParent:
    "moz-src:///browser/components/customkeys/CustomKeysParent.sys.mjs",
  ShortcutUtils: "resource://gre/modules/ShortcutUtils.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/preferences/zen-preferences.ftl"])
);

ChromeUtils.defineLazyGetter(
  lazy,
  "customKeysL10n",
  () => new Localization(["branding/brand.ftl", "browser/customkeys.ftl"])
);

const CUSTOM_KEYS_L10N_PREFIX = "customkeys-";

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

const BLOCKED_SHORTCUT_REPEAT_MS = 3000;

export const CONFLICT_ZEN = "zen";
export const CONFLICT_WEBSITE = "website";
export const CONFLICT_ASK = "ask";
const CONFLICT_VALUES = [CONFLICT_ZEN, CONFLICT_WEBSITE, CONFLICT_ASK];

const CONFLICT_DEFAULT_BY_ID = new Map(
  Object.entries({
    [CONFLICT_ZEN]: [
      "zen-copy-url",
      "zen-copy-url-markdown",
      "key_newNavigator",
      "key_newNavigatorTab",
      "key_privatebrowsing",
      "key_close",
      "key_closeWindow",
      "key_restoreLastClosedTabOrWindowOrSession",
      "goBackKb",
      "goForwardKb",
      "goBackKb2",
      "goForwardKb2",
      "focusURLBar",
      "focusURLBar2",
      "key_minimizeWindow",
      "key_hideThisAppCmdMac",
      "key_quitApplication",
    ],
    [CONFLICT_WEBSITE]: [
      "key_find",
      "key_findAgain",
      "key_findPrevious",
      "key_findAgain2",
      "key_findPrevious2",
      "key_findSelection",
      "key_selectAll",
      "key_reload",
      "key_reload_skip_cache",
      "key_reload2",
      "key_reload_skip_cache2",
      "key_stop",
      "key_stop_mac",
      "key_fullZoomReduce",
      "key_fullZoomEnlarge",
      "key_fullZoomReset",
      "key_savePage",
      "key_openDownloads",
      "showAllHistoryKb",
      "key_gotoHistory",
      "key_toggleReaderMode",
      "key_preferencesCmdMac",
      "key_hideOtherAppsCmdMac",
      "zen-workspace-forward",
      "zen-workspace-backward",
      "zen-close-all-unpinned-tabs",
      "zen-library-toggle",
    ],
  }).flatMap(([value, ids]) => ids.map(id => [id, value]))
);

// The category about:keyboard lists Firefox's navigation shortcuts in.
const FIREFOX_NAVIGATION_CATEGORY = "customkeys-category-navigation-2";

/**
 * Zen's own shortcuts, grouped the way about:keyboard shows them.
 */
const ZEN_KEY_CATEGORIES = [
  {
    l10nId: "zenCKSOption-group-zen-workspace",
    menuId: "zen-spaces-menubar",
    keys: [
      ...Array.from({ length: 10 }, (_, i) => [
        `zen-workspace-switch-${i + 1}`,
        `zen-workspace-shortcut-switch-${i + 1}`,
      ]),
      ["zen-workspace-create", "zen-workspace-shortcut-create"],
    ],
  },
  {
    l10nId: "zenCKSOption-group-zen-tabs",
    keys: [
      ["zen-tab-switcher-cycle", "zen-tab-switcher-shortcut-cycle"],
      ["zen-tab-switcher-next", "zen-tab-switcher-shortcut-next"],
      ["zen-tab-switcher-previous", "zen-tab-switcher-shortcut-previous"],
      ["zen-toggle-pin-tab", "zen-toggle-pin-tab-shortcut"],
      ["zen-pinned-tab-reset-shortcut", "zen-pinned-tab-shortcut-reset"],
      ["zen-duplicate-tab", "zen-duplicate-tab-shortcut"],
      ["zen-close-all-unpinned-tabs", "zen-close-all-unpinned-tabs-shortcut"],
      ["zen-glance-expand", "zen-glance-expand"],
      ["zen-copy-url", "zen-text-action-copy-url-shortcut"],
      ["zen-copy-url-markdown", "zen-text-action-copy-url-markdown-shortcut"],
    ],
    // Firefox's shortcuts that are moved here, keeping their titles.
    firefoxKeys: {
      category: FIREFOX_NAVIGATION_CATEGORY,
      ids: [
        ...Array.from({ length: 8 }, (_, i) => `key_selectTab${i + 1}`),
        "key_selectLastTab",
      ],
    },
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
    l10nId: "zenCKSOption-group-zen-layout",
    keys: [
      ["zen-compact-mode-toggle", "zen-compact-mode-shortcut-toggle"],
      [
        "zen-compact-mode-show-sidebar",
        "zen-compact-mode-shortcut-show-sidebar",
      ],
      ["zen-toggle-sidebar", "zen-sidebar-shortcut-toggle"],
      ["zen-library-toggle", "zen-library-shortcut-toggle"],
    ],
  },
];

/**
 * Firefox handles tab switching (Ctrl+Tab, Ctrl+Page Down, Ctrl+Page Up and
 * their platform variants) in ShortcutUtils.getSystemActionForEvent instead
 * of through <key> elements, so about:keyboard can't change them. Zen mirrors
 * them with disabled <key> elements that only hold the binding. Until one is
 * customized Firefox's built-in shortcuts apply; once it is, its binding
 * replaces them.
 */
export const TAB_SWITCHER_KEYS = Object.freeze({
  CYCLE_TABS: "zen-tab-switcher-cycle",
  NEXT_TAB: "zen-tab-switcher-next",
  PREVIOUS_TAB: "zen-tab-switcher-previous",
});

/**
 * Read the binding of a <key> element into the modifier state a keyboard
 * event needs to have to trigger it.
 *
 * @param {Element} keyEl
 */
function parseKeyElement(keyEl) {
  const isMac = AppConstants.platform == "macosx";
  const binding = {
    key: keyEl.getAttribute("key")?.toUpperCase() ?? "",
    keycode: keyEl.getAttribute("keycode")?.toUpperCase() ?? "",
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };
  for (const name of (keyEl.getAttribute("modifiers") ?? "").split(/[\s,]+/)) {
    switch (name) {
      case "accel":
        binding[isMac ? "meta" : "ctrl"] = true;
        break;
      case "control":
        binding.ctrl = true;
        break;
      case "alt":
      case "shift":
        binding[name] = true;
        break;
      case "meta":
      case "os":
        binding.meta = true;
        break;
    }
  }
  return binding;
}

/**
 * Whether the key pressed in a keyboard event is the one of a binding,
 * without looking at modifiers.
 *
 * @param {object} binding As returned by parseKeyElement.
 * @param {KeyboardEvent} event
 */
function isBindingKey(binding, event) {
  if (binding.keycode) {
    return event.keyCode == event["DOM_" + binding.keycode];
  }
  if (!binding.key) {
    return false;
  }
  if (event.key.toUpperCase() == binding.key) {
    return true;
  }
  // With Alt on macOS, or Shift on a digit, event.key is the character the
  // combination produces rather than the key itself.
  const { keyCode } = event;
  const isAlphanumeric =
    (keyCode >= event.DOM_VK_A && keyCode <= event.DOM_VK_Z) ||
    (keyCode >= event.DOM_VK_0 && keyCode <= event.DOM_VK_9);
  return isAlphanumeric && String.fromCharCode(keyCode) == binding.key;
}

/**
 * @param {object} binding As returned by parseKeyElement.
 * @param {KeyboardEvent} event
 * @param {object} [options]
 * @param {boolean} [options.shiftReverses] Also match with Shift held when
 *   the binding doesn't use it, since Shift reverses the direction of the
 *   tab switcher.
 */
function bindingMatchesEvent(binding, event, { shiftReverses = false } = {}) {
  // Like ShortcutUtils, ignore the Windows key on Windows.
  const metaKey = event.metaKey && AppConstants.platform != "win";
  return (
    isBindingKey(binding, event) &&
    event.ctrlKey == binding.ctrl &&
    event.altKey == binding.alt &&
    metaKey == binding.meta &&
    (event.shiftKey == binding.shift || (shiftReverses && !binding.shift))
  );
}

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
  /** @type {WeakMap<Window, {key: Element, time: number}>} */
  #lastBlocked = new WeakMap();

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

  initWindow(window) {
    window.addEventListener("ZenShortcutBlocked", event =>
      this.#onShortcutBlocked(window, event)
    );
    this.#applyDefaultConflicts(window);
  }

  #onShortcutBlocked(window, event) {
    const keyEl = event.target;
    const now = ChromeUtils.now();
    const last = this.#lastBlocked.get(window);
    if (last?.key == keyEl && now - last.time < BLOCKED_SHORTCUT_REPEAT_MS) {
      this.#lastBlocked.delete(window);
      window.gZenUIManager.hideToast("zen-shortcut-blocked-toast");
      event.preventDefault();
      return;
    }
    this.#lastBlocked.set(window, { key: keyEl, time: now });
    this.#showBlockedToast(window, keyEl);
  }

  async #showBlockedToast(window, keyEl) {
    const armed = this.#lastBlocked.get(window);
    let action = null;
    try {
      const categories = await this.getShortcuts(window);
      action = categories
        .flatMap(category => category.keys)
        .find(key => key.id == keyEl.id)?.title;
    } catch (e) {
      console.error("Zen CKS: Could not name the blocked shortcut", e);
    }
    action ||= await window.document.l10n.formatValue(
      "zen-shortcut-blocked-toast-default-action"
    );
    if (window.closed || this.#lastBlocked.get(window) !== armed) {
      return;
    }
    window.gZenUIManager.showToast("zen-shortcut-blocked-toast", {
      l10nArgs: {
        shortcut: lazy.ShortcutUtils.prettifyShortcut(keyEl),
        action,
      },
      timeout: BLOCKED_SHORTCUT_REPEAT_MS,
    });
  }

  get conflictsEnabled() {
    return Services.prefs.getBoolPref(
      "zen.keyboard.shortcuts.override-page-shortcuts",
      true
    );
  }

  /**
   * @param {string} id The id of a <key> element.
   * @returns {string} CONFLICT_ZEN, CONFLICT_WEBSITE or CONFLICT_ASK.
   */
  getConflict(id) {
    const value = lazy.CustomKeys.getZenConflict(id);
    return CONFLICT_VALUES.includes(value)
      ? value
      : this.getDefaultConflict(id);
  }

  /**
   * @param {string} id The id of a <key> element.
   * @returns {string} CONFLICT_ZEN, CONFLICT_WEBSITE or CONFLICT_ASK.
   */
  getDefaultConflict(id) {
    return CONFLICT_DEFAULT_BY_ID.get(id) ?? CONFLICT_ASK;
  }

  setConflict(id, value) {
    if (!CONFLICT_VALUES.includes(value)) {
      throw new Error(`Unknown shortcut conflict choice: ${value}`);
    }
    lazy.CustomKeys.setZenConflict(
      id,
      value == this.getDefaultConflict(id) ? null : value
    );
  }

  /**
   * Marks the keys of a browser window that don't default to CONFLICT_ASK.
   *
   * @param {Window} window
   */
  #applyDefaultConflicts(window) {
    for (const [id, value] of CONFLICT_DEFAULT_BY_ID) {
      window.document
        .getElementById(id)
        ?.setAttribute("zen-website-conflict-default", value);
    }
  }

  /**
   * @param {Window} window A browser window.
   * @param {string} id The id of a <key> element.
   * @returns {boolean} Whether Firefox reserves the shortcut itself, so that
   *   pages can never take it over whatever is chosen.
   */
  isConflictLocked(window, id) {
    const keyEl = window.document.getElementById(id);
    return keyEl?.tagName == "key" && keyEl.getAttribute("reserved") == "true";
  }

  /**
   * The tab switcher key with this id, if the user customized it.
   *
   * @param {Document} document The browser window's document.
   * @param {string} id
   * @returns {Element|null}
   */
  #customizedTabSwitcherKey(document, id) {
    if (!lazy.CustomKeys.getDefaultKey(id)) {
      return null;
    }
    return document.getElementById(id);
  }

  /**
   * ShortcutUtils.getSystemActionForEvent, with the tab switching shortcuts
   * the user customized in place of Firefox's built-in ones.
   *
   * @param {KeyboardEvent} event
   * @param {Document} document The document the event is handled in.
   * @returns {string|null} One of ShortcutUtils' action constants, or null.
   */
  getSystemActionForEvent(event, document) {
    for (const [action, id] of Object.entries(TAB_SWITCHER_KEYS)) {
      const keyEl = this.#customizedTabSwitcherKey(document, id);
      if (
        keyEl &&
        bindingMatchesEvent(parseKeyElement(keyEl), event, {
          shiftReverses: action == "CYCLE_TABS",
        })
      ) {
        return lazy.ShortcutUtils[action];
      }
    }
    const action = lazy.ShortcutUtils.getSystemActionForEvent(event);
    const id = TAB_SWITCHER_KEYS[action];
    if (id && this.#customizedTabSwitcherKey(document, id)) {
      return null;
    }
    return action;
  }

  /**
   * Whether a press of the cycle key goes backwards. Shift reverses the
   * direction, unless the user's binding for cycling uses Shift itself.
   *
   * @param {KeyboardEvent} event
   * @param {Document} document The document the event is handled in.
   * @returns {boolean}
   */
  isTabSwitcherReverseEvent(event, document) {
    if (!event.shiftKey) {
      return false;
    }
    const keyEl = this.#customizedTabSwitcherKey(
      document,
      TAB_SWITCHER_KEYS.CYCLE_TABS
    );
    return !keyEl || !parseKeyElement(keyEl).shift;
  }

  /**
   * Whether this keyup ends a round of cycling through tabs, i.e. the user
   * let go of the modifier they hold down while pressing the cycle key. With
   * the default Ctrl+Tab that's Control.
   *
   * @param {KeyboardEvent} event
   * @param {Document} document The browser window's document.
   * @returns {boolean}
   */
  isTabSwitcherReleaseEvent(event, document) {
    const keyEl = this.#customizedTabSwitcherKey(
      document,
      TAB_SWITCHER_KEYS.CYCLE_TABS
    );
    if (!keyEl) {
      return event.keyCode == event.DOM_VK_CONTROL;
    }
    const binding = parseKeyElement(keyEl);
    const heldKeys = [];
    if (binding.ctrl) {
      heldKeys.push("Control");
    }
    if (binding.alt) {
      heldKeys.push("Alt");
    }
    if (binding.meta) {
      heldKeys.push("Meta", "OS");
    }
    // Shift normally reverses the direction, so only treat it as the held key
    // when the binding has no other modifier.
    if (!heldKeys.length && binding.shift) {
      heldKeys.push("Shift");
    }
    // A shortcut without modifiers has nothing to hold down, so it switches
    // as soon as the key itself is released.
    if (!heldKeys.length) {
      return isBindingKey(binding, event);
    }
    return heldKeys.includes(event.key);
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

    const zenKeys = {};
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
      const { category: from, ids: firefoxIds = [] } =
        category.firefoxKeys ?? {};
      for (const id of firefoxIds) {
        if (keys[from]?.[id]) {
          entries[id] = keys[from][id];
          delete keys[from][id];
        }
      }
      if (Object.keys(entries).length) {
        zenKeys[label] = { ...keys[label], ...entries };
        delete keys[label];
      }
    }
    return { ...zenKeys, ...keys };
  }

  /**
   * about:keyboard's actor knows how to list the shortcuts of a browser
   * window and how to turn a key press into a binding. This gives its logic
   * a browser window to work on without a page being involved.
   *
   * @param {Window} window The browser window whose keys are meant.
   * @param {(name: string, data: object) => void} [onMessage]
   *   Receives what the actor would have sent to its page.
   */
  #customKeysFor(window, onMessage = () => {}) {
    return Object.create(lazy.CustomKeysParent.prototype, {
      browsingContext: { value: { topChromeWindow: window } },
      sendAsyncMessage: { value: onMessage },
    });
  }

  /**
   * Every shortcut that can be customized, Firefox's and Zen's, with the
   * titles ready for display.
   *
   * @param {Window} window The browser window to read the keys from.
   * @returns {Promise<Array<{label: string, keys: object[]}>>}
   *   The categories, each key being { id, title, shortcut, isCustomized,
   *   internal }.
   */
  async getShortcuts(window) {
    const actor = this.#customKeysFor(window);
    const categories = await this.addKeys(actor, actor.getKeys());
    const l10nIds = new Set();
    for (const [label, keys] of Object.entries(categories)) {
      for (const text of [label, ...Object.values(keys).map(k => k.title)]) {
        if (text?.startsWith(CUSTOM_KEYS_L10N_PREFIX)) {
          l10nIds.add(text);
        }
      }
    }
    const ids = [...l10nIds];
    const messages = await lazy.customKeysL10n.formatMessages(
      ids.map(id => ({ id }))
    );
    const text = Object.fromEntries(
      ids.map((id, i) => [
        id,
        messages[i]?.value ??
          messages[i]?.attributes?.find(a => a.name == "heading")?.value ??
          id,
      ])
    );
    return Object.entries(categories)
      .map(([label, keys]) => ({
        label: text[label] ?? label,
        keys: Object.entries(keys).map(([id, data]) => ({
          ...data,
          id,
          title: text[data.title] ?? data.title ?? id,
        })),
      }))
      .filter(category => category.keys.length);
  }

  /**
   * @param {Window} window The browser window to read the key from.
   * @param {string} id The id of the <key> element.
   * @returns {{shortcut: string, isCustomized: boolean, internal: boolean}|null}
   */
  getShortcut(window, id) {
    return this.#customKeysFor(window).getKeyData(id);
  }

  /**
   * Turns a key press into the binding it would make as a shortcut.
   *
   * @param {Window} window A browser window.
   * @param {KeyboardEvent} event A keydown event, which gets consumed.
   * @returns {object} { isModifier, modifierString } while only modifiers are
   *   held, otherwise { isValid, modifiers, key, keycode, shortcut }.
   */
  describeKeyEvent(window, event) {
    let described = null;
    this.#customKeysFor(window, (name, data) => {
      described = data;
    }).handleEvent(event);
    return described;
  }

  /**
   * @param {Window} window A browser window.
   * @param {string} id The id of the <key> element.
   * @returns {string} What the key is bound to by default, formatted for
   *   display, or "" when it isn't customized or has no default.
   */
  getDefaultShortcutDisplay(window, id) {
    const binding = lazy.CustomKeys.getDefaultKey(id);
    if (!binding || (!binding.key && !binding.keycode)) {
      return "";
    }
    return this.#customKeysFor(window).prettifyShortcut(binding);
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
