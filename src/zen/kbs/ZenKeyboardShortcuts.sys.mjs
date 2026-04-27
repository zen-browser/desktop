/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyServiceGetter(
  lazy,
  "ZenGlobalShortcuts",
  "@mozilla.org/zen/global-shortcuts;1",
  Ci.nsIZenGlobalShortcuts
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "GLOBAL_SHORTCUTS_ENABLED",
  "zen.keyboard.shortcuts.global.enabled",
  true,
  () => ZenKeyboardShortcuts.triggerShortcutRebuild()
);

const KEYCODE_MAP = {
  F1: "VK_F1",
  F2: "VK_F2",
  F3: "VK_F3",
  F4: "VK_F4",
  F5: "VK_F5",
  F6: "VK_F6",
  F7: "VK_F7",
  F8: "VK_F8",
  F9: "VK_F9",
  F10: "VK_F10",
  F11: "VK_F11",
  F12: "VK_F12",
  F13: "VK_F13",
  F14: "VK_F14",
  F15: "VK_F15",
  F16: "VK_F16",
  F17: "VK_F17",
  F18: "VK_F18",
  F19: "VK_F19",
  F20: "VK_F20",
  F21: "VK_F21",
  F22: "VK_F22",
  F23: "VK_F23",
  F24: "VK_F24",
  TAB: "VK_TAB",
  ENTER: "VK_RETURN",
  ESCAPE: "VK_ESCAPE",
  SPACE: "VK_SPACE",
  ARROWLEFT: "VK_LEFT",
  ARROWRIGHT: "VK_RIGHT",
  ARROWUP: "VK_UP",
  ARROWDOWN: "VK_DOWN",
  DELETE: "VK_DELETE",
  BACKSPACE: "VK_BACK",
  HOME: "VK_HOME",
  NUM_LOCK: "VK_NUMLOCK",
  SCROLL_LOCK: "VK_SCROLL",
};

const defaultKeyboardGroups = {
  windowAndTabManagement: [
    "zen-window-new-shortcut",
    "zen-new-unsynced-window-shortcut",
    "zen-tab-new-shortcut",
    "zen-key-enter-full-screen",
    "zen-key-exit-full-screen",
    "zen-quit-app-shortcut",
    "zen-close-all-unpinned-tabs-shortcut",
    "zen-close-tab-shortcut",
    "zen-close-shortcut",
    "id:key_selectTab1",
    "id:key_selectTab2",
    "id:key_selectTab3",
    "id:key_selectTab4",
    "id:key_selectTab5",
    "id:key_selectTab6",
    "id:key_selectTab7",
    "id:key_selectTab8",
    "id:key_selectLastTab",
  ],
  navigation: [
    "zen-nav-back-shortcut-alt",
    "zen-nav-fwd-shortcut-alt",
    "zen-nav-reload-shortcut-2",
    "zen-nav-reload-shortcut-skip-cache",
    "zen-nav-reload-shortcut",
    "zen-key-stop",
    "zen-private-browsing-shortcut",
    "id:goHome",
    "id:key_gotoHistory",
    "id:goBackKb",
    "id:goForwardKb",
  ],
  searchAndFind: [
    "zen-search-focus-shortcut",
    "zen-search-focus-shortcut-alt",
    "zen-find-shortcut",
    "zen-search-find-again-shortcut-2",
    "zen-search-find-again-shortcut",
    "zen-search-find-again-shortcut-prev",
  ],
  pageOperations: [
    "zen-text-action-copy-url-markdown-shortcut",
    "zen-text-action-copy-url-shortcut",
    "zen-location-open-shortcut",
    "zen-location-open-shortcut-alt",
    "zen-save-page-shortcut",
    "zen-print-shortcut",
    "zen-page-source-shortcut",
    "zen-page-info-shortcut",
    "zen-reader-mode-toggle-shortcut-other",
    "zen-picture-in-picture-toggle-shortcut",
  ],
  historyAndBookmarks: [
    "zen-history-show-all-shortcut",
    "zen-bookmark-this-page-shortcut",
    "zen-bookmark-show-library-shortcut",
  ],
  mediaAndDisplay: [
    "zen-mute-toggle-shortcut",
    "zen-full-zoom-reduce-shortcut",
    "zen-full-zoom-enlarge-shortcut",
    "zen-full-zoom-reset-shortcut",
    "zen-bidi-switch-direction-shortcut",
    "zen-screenshot-shortcut",
  ],
  devTools: [/*Filled automatically*/],
};

const fixedL10nIds = {
  cmd_findPrevious: "zen-search-find-again-shortcut-prev",
  "Browser:ReloadSkipCache": "zen-nav-reload-shortcut-skip-cache",
  cmd_close: "zen-close-tab-shortcut",
  "History:RestoreLastClosedTabOrWindowOrSession":
    "zen-restore-last-closed-tab-shortcut",
};

const ZEN_MAIN_KEYSET_ID = "mainKeyset";
const ZEN_DEVTOOLS_KEYSET_ID = "devtoolsKeyset";
const ZEN_KEYSET_ID = "zenKeyset";

const ZEN_COMPACT_MODE_SHORTCUTS_GROUP = "zen-compact-mode";
const ZEN_WORKSPACE_SHORTCUTS_GROUP = "zen-workspace";
const ZEN_OTHER_SHORTCUTS_GROUP = "zen-other";
const ZEN_SPLIT_VIEW_SHORTCUTS_GROUP = "zen-split-view";
const FIREFOX_SHORTCUTS_GROUP = "zen-kbs-invalid";
export const VALID_SHORTCUT_GROUPS = [
  ZEN_COMPACT_MODE_SHORTCUTS_GROUP,
  ZEN_WORKSPACE_SHORTCUTS_GROUP,
  ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
  ZEN_OTHER_SHORTCUTS_GROUP,
  ...Object.keys(defaultKeyboardGroups),
  "other",
];

export class nsKeyShortcutModifiers {
  #control = false;
  #alt = false;
  #shift = false;
  #meta = false;
  #accel = false;

  constructor(ctrl, alt, shift, meta, accel) {
    this.#control = ctrl;
    this.#alt = alt;
    this.#shift = shift;
    this.#meta = meta;
    this.#accel = accel;

    if (AppConstants.platform != "macosx") {
      // Replace control with accel, to make it more consistent
      this.#accel = ctrl || accel;
      this.#control = false;
    }
  }

  static parseFromJSON(modifiers) {
    if (!modifiers) {
      return new nsKeyShortcutModifiers(false, false, false, false, false);
    }

    return new nsKeyShortcutModifiers(
      modifiers.control,
      modifiers.alt,
      modifiers.shift,
      modifiers.meta,
      modifiers.accel
    );
  }

  static parseFromXHTMLAttribute(modifiers) {
    if (!modifiers) {
      return new nsKeyShortcutModifiers(false, false, false, false, false);
    }

    return new nsKeyShortcutModifiers(
      modifiers.includes("control"),
      modifiers.includes("alt"),
      modifiers.includes("shift"),
      modifiers.includes("meta"),
      modifiers.includes("accel")
    );
  }

  // used to avoid any future changes to the object
  static fromObject({
    ctrl = false,
    alt = false,
    shift = false,
    meta = false,
    accel = false,
  }) {
    return new nsKeyShortcutModifiers(ctrl, alt, shift, meta, accel);
  }

  toDisplayString() {
    let str = "";
    const separation = AppConstants.platform == "macosx" ? " " : "+";
    if (this.#control && !this.#accel) {
      str += AppConstants.platform == "macosx" ? "⌃" : "Ctrl";
      str += separation;
    }
    if (this.#meta) {
      str += AppConstants.platform == "macosx" ? "⌘" : "Win";
      str += separation;
    }
    if (this.#accel) {
      str += AppConstants.platform == "macosx" ? "⌘" : "Ctrl";
      str += separation;
    }
    if (this.#alt) {
      str += AppConstants.platform == "macosx" ? "⌥" : "Alt";
      str += separation;
    }
    if (this.#shift) {
      str += "⇧";
      str += separation;
    }
    return str;
  }

  equals(other) {
    if (!other) {
      return false;
    }
    return (
      this.#alt == other.#alt &&
      this.#shift == other.#shift &&
      this.#control == other.#control &&
      (AppConstants.platform == "macosx"
        ? (this.#meta || this.#accel) == (other.#meta || other.#accel) &&
          this.#control == other.#control
        : this.#meta == other.#meta &&
          (this.#control || this.#accel) == (other.#control || other.#accel))
    );
  }

  toString() {
    let str = "";
    if (this.#control) {
      str += "control,";
    }
    if (this.#accel) {
      str += "accel,";
    }
    if (this.#shift) {
      str += "shift,";
    }
    if (this.#alt) {
      str += "alt,";
    }
    if (this.#meta) {
      str += "meta,";
    }
    return str.slice(0, -1);
  }

  toJSONString() {
    return {
      control: this.#control,
      alt: this.#alt,
      shift: this.#shift,
      meta: this.#meta,
      accel: this.#accel,
    };
  }

  areAnyActive() {
    return (
      this.#control || this.#alt || this.#shift || this.#meta || this.#accel
    );
  }

  get control() {
    return this.#control;
  }
  get alt() {
    return this.#alt;
  }
  get shift() {
    return this.#shift;
  }
  get meta() {
    return this.#meta;
  }
  get accel() {
    return this.#accel;
  }
}

class KeyShortcut {
  #id = "";
  #key = "";
  #keycode = "";
  #group = FIREFOX_SHORTCUTS_GROUP;
  #modifiers = new nsKeyShortcutModifiers(false, false, false, false, false);
  #action = "";
  #l10nId = "";
  #disabled = false;
  #reserved = false;
  #internal = false;
  #zenGlobal = false;

  constructor(
    id,
    key,
    keycode,
    group,
    modifiers,
    action,
    l10nId,
    disabled = false,
    reserved = false,
    internal = false,
    zenGlobal = false
  ) {
    this.#id = id;
    this.#key = key?.toLowerCase();
    this.#keycode = keycode;

    if (!VALID_SHORTCUT_GROUPS.includes(group)) {
      throw new Error("Illegal group value: " + group);
    }

    this.#group = group;
    this.#modifiers = modifiers;
    this.#action = action;
    this.#l10nId = KeyShortcut.sanitizeL10nId(l10nId, action);
    this.#disabled = disabled;
    this.#reserved = reserved;
    this.#internal = internal;
    this.#zenGlobal = zenGlobal;
  }

  isEmpty() {
    return !this.#key && !this.getRealKeycode();
  }

  static parseFromSaved(json) {
    let rv = [];
    for (let key of json) {
      rv.push(this.#parseFromJSON(key));
    }
    return rv;
  }

  static getGroupFromL10nId(l10nId, id) {
    for (let group of Object.keys(defaultKeyboardGroups)) {
      for (let shortcut of defaultKeyboardGroups[group]) {
        if (shortcut == l10nId || shortcut == "id:" + id) {
          return group;
        }
      }
    }
    return "other";
  }

  static #parseFromJSON(json) {
    return new KeyShortcut(
      json.id,
      json.key,
      json.keycode,
      json.group,
      nsKeyShortcutModifiers.parseFromJSON(json.modifiers),
      json.action,
      json.l10nId,
      json.disabled,
      json.reserved,
      json.internal,
      json.zenGlobal
    );
  }

  static parseFromXHTML(key, { group = undefined } = {}) {
    return new KeyShortcut(
      key.getAttribute("id"),
      key.getAttribute("key"),
      key.getAttribute("keycode"),
      group ??
        KeyShortcut.getGroupFromL10nId(
          KeyShortcut.sanitizeL10nId(key.getAttribute("data-l10n-id")),
          key.getAttribute("id")
        ),
      nsKeyShortcutModifiers.parseFromXHTMLAttribute(
        key.getAttribute("modifiers")
      ),
      key.getAttribute("command"),
      key.getAttribute("data-l10n-id"),
      key.getAttribute("disabled") == "true",
      key.getAttribute("reserved") == "true",
      key.getAttribute("internal") == "true",
      key.getAttribute("zenGlobal") == "true"
    );
  }

  static sanitizeL10nId(id, action) {
    if (!id || id.startsWith("zen-")) {
      return id;
    }
    if (fixedL10nIds[action]) {
      return fixedL10nIds[action];
    }
    return `zen-${id}`;
  }

  set shouldBeEmpty(value) {
    if (value) {
      this.clearKeybind();
    }
  }

  toXHTMLElement(aWindow) {
    let key = aWindow.document.createXULElement("key");
    return this.replaceWithChild(key);
  }

  replaceWithChild(key) {
    key.id = this.#id;
    if (this.#keycode) {
      key.setAttribute("keycode", this.#keycode);
      key.removeAttribute("key");
    } else {
      // note to "mr. macos": Better use setAttribute, because without it, there's a
      //  risk of malforming the XUL element.
      key.setAttribute("key", this.#key);
      key.removeAttribute("keycode");
    }
    key.setAttribute("group", this.#group);

    if (this.#l10nId) {
      // key.setAttribute('data-l10n-id', this.#l10nId);
    }
    key.setAttribute("modifiers", this.#modifiers.toString());
    if (this.#action) {
      key.setAttribute("command", this.#action);
    }
    if (this.#disabled) {
      key.setAttribute("disabled", this.#disabled);
    }
    if (this.#reserved) {
      key.setAttribute("reserved", this.#reserved);
    }
    if (this.#internal) {
      key.setAttribute("internal", this.#internal);
    }
    if (this.#zenGlobal) {
      key.setAttribute("zenGlobal", this.#zenGlobal);
    }
    key.setAttribute("zen-keybind", "true");

    return key;
  }

  _modifyInternalAttribute(value) {
    this.#internal = value;
  }
  getRealKeycode() {
    return this.#keycode === "" ? null : this.#keycode;
  }
  getID() {
    return this.#id;
  }
  getAction() {
    return this.#action;
  }
  _setAction(action) {
    this.#action = action;
  }
  _setZenGlobal(value) {
    this.#zenGlobal = !!value;
  }
  getL10NID() {
    return this.#l10nId;
  }
  getGroup() {
    return this.#group;
  }
  getModifiers() {
    return this.#modifiers;
  }
  getKeyName() {
    return this.#key?.toLowerCase();
  }
  getKeyCode() {
    return this.getRealKeycode();
  }
  getKeyNameOrCode() {
    return this.#key ? this.getKeyName() : this.getKeyCode();
  }
  isDisabled() {
    return this.#disabled;
  }
  setDisabled(value) {
    this.#disabled = value;
  }
  isReserved() {
    return this.#reserved;
  }
  isInternal() {
    return this.#internal;
  }
  isZenGlobal() {
    return this.#zenGlobal;
  }
  isInvalid() {
    return this.#key == "" && this.#keycode == "" && this.#l10nId == null;
  }

  setModifiers(modifiers) {
    if ((!modifiers) instanceof nsKeyShortcutModifiers) {
      throw new Error("Only nsKeyShortcutModifiers allowed");
    }
    this.#modifiers = modifiers;
  }

  toJSONForm() {
    return {
      id: this.#id,
      key: this.#key,
      keycode: this.#keycode,
      group: this.#group,
      l10nId: this.#l10nId,
      modifiers: this.#modifiers.toJSONString(),
      action: this.#action,
      disabled: this.#disabled,
      reserved: this.#reserved,
      internal: this.#internal,
      zenGlobal: this.#zenGlobal,
    };
  }

  toDisplayString() {
    let str = this.#modifiers.toDisplayString();

    if (this.#key) {
      str += this.#key.toUpperCase();
    } else if (this.#keycode) {
      for (let [key, value] of Object.entries(KEYCODE_MAP)) {
        if (value == this.#keycode) {
          const normalizedKey = key.toLowerCase();
          switch (normalizedKey) {
            case "arrowleft":
              str += "←";
              break;
            case "arrowright":
              str += "→";
              break;
            case "arrowup":
              str += "↑";
              break;
            case "arrowdown":
              str += "↓";
              break;
            case "escape":
              str += AppConstants.platform == "macosx" ? "⎋" : "Esc";
              break;
            case "enter":
              str += AppConstants.platform == "macosx" ? "↩" : "Enter";
              break;
            case "space":
              str += AppConstants.platform == "macosx" ? "␣" : "Space";
              break;
            default:
              str += normalizedKey;
          }
          break;
        }
      }
    } else {
      return "";
    }
    return str;
  }

  isUserEditable() {
    if (
      !this.#id ||
      this.#internal ||
      (this.#group == FIREFOX_SHORTCUTS_GROUP && this.#disabled)
    ) {
      return false;
    }
    return true;
  }

  clearKeybind() {
    this.#key = "";
    this.#keycode = "";
    this.#modifiers = new nsKeyShortcutModifiers(false, false, false, false);
  }

  setNewBinding(shortcut) {
    for (let keycode of Object.keys(KEYCODE_MAP)) {
      if (keycode == shortcut.toUpperCase()) {
        this.#keycode = KEYCODE_MAP[keycode];
        this.#key = "";
        return;
      }
    }
    this.#keycode = "";
    this.#key = shortcut;
  }
}

class nsZenKeyboardShortcutsLoader {
  constructor() {}

  get shortcutsFile() {
    return PathUtils.join(PathUtils.profileDir, "zen-keyboard-shortcuts.json");
  }

  async save(data) {
    await IOUtils.writeJSON(this.shortcutsFile, data);
  }

  async loadObject() {
    try {
      return await IOUtils.readJSON(this.shortcutsFile);
    } catch (e) {
      Services.prefs.clearUserPref("zen.keyboard.shortcuts.version");
      console.warn("Error loading shortcuts file", e);
      return null;
    }
  }

  async load() {
    return (await this.loadObject())?.shortcuts;
  }

  async remove() {
    await IOUtils.remove(this.shortcutsFile);
  }

  static zenGetDefaultShortcuts(aWindow) {
    let keySet = aWindow.document.getElementById(ZEN_MAIN_KEYSET_ID);
    let newShortcutList = [];

    const correctDefaultShortcut = shortcut => {
      if (shortcut.getID() === "key_savePage") {
        shortcut.setModifiers(
          nsKeyShortcutModifiers.fromObject({
            accel: true,
            alt: true,
            shift: true,
          })
        );
      }
    };

    for (let i = keySet.children.length - 1; i >= 0; i--) {
      let key = keySet.children[i];
      let parsed = KeyShortcut.parseFromXHTML(key);
      correctDefaultShortcut(parsed);
      newShortcutList.push(parsed);
    }

    newShortcutList.push(
      new KeyShortcut(
        "zen-compact-mode-toggle",
        "S",
        "",
        ZEN_COMPACT_MODE_SHORTCUTS_GROUP,
        nsKeyShortcutModifiers.fromObject({ accel: true }),
        "cmd_toggleCompactModeIgnoreHover",
        "zen-compact-mode-shortcut-toggle"
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        "zen-compact-mode-show-sidebar",
        "S",
        "",
        ZEN_COMPACT_MODE_SHORTCUTS_GROUP,
        nsKeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        "cmd_zenCompactModeShowSidebar",
        "zen-compact-mode-shortcut-show-sidebar"
      )
    );

    for (let i = 10; i > 0; i--) {
      newShortcutList.push(
        new KeyShortcut(
          `zen-workspace-switch-${i}`,
          AppConstants.platform == "macosx" ? `${i === 10 ? 0 : i}` : "",
          "",
          ZEN_WORKSPACE_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject(
            AppConstants.platform == "macosx" ? { ctrl: true } : {}
          ),
          `cmd_zenWorkspaceSwitch${i}`,
          `zen-workspace-shortcut-switch-${i}`
        )
      );
    }
    newShortcutList.push(
      new KeyShortcut(
        "zen-workspace-forward",
        "",
        "VK_RIGHT",
        ZEN_WORKSPACE_SHORTCUTS_GROUP,
        nsKeyShortcutModifiers.fromObject({ alt: true, accel: true }),
        "cmd_zenWorkspaceForward",
        "zen-workspace-shortcut-forward"
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        "zen-workspace-backward",
        "",
        "VK_LEFT",
        ZEN_WORKSPACE_SHORTCUTS_GROUP,
        nsKeyShortcutModifiers.fromObject({ alt: true, accel: true }),
        "cmd_zenWorkspaceBackward",
        "zen-workspace-shortcut-backward"
      )
    );

    newShortcutList.push(
      new KeyShortcut(
        "zen-split-view-grid",
        "G",
        "",
        ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
        nsKeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        "cmd_zenSplitViewGrid",
        "zen-split-view-shortcut-grid"
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        "zen-split-view-vertical",
        "V",
        "",
        ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
        nsKeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        "cmd_zenSplitViewVertical",
        "zen-split-view-shortcut-vertical"
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        "zen-split-view-horizontal",
        "H",
        "",
        ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
        nsKeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        "cmd_zenSplitViewHorizontal",
        "zen-split-view-shortcut-horizontal"
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        "zen-split-view-unsplit",
        "U",
        "",
        ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
        nsKeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        "cmd_zenSplitViewUnsplit",
        "zen-split-view-shortcut-unsplit"
      )
    );

    return newShortcutList;
  }

  // Make sure to stay in sync with https://searchfox.org/mozilla-central/source/devtools/startup/DevToolsStartup.sys.mjs#879
  static IGNORED_DEVTOOLS_SHORTCUTS = [
    "key_toggleToolboxF12",
    "profilerStartStop",
    "profilerStartStopAlternate",
    "profilerCapture",
    "profilerCaptureAlternate",
    "javascriptTracingToggle",
  ];

  static zenGetDefaultDevToolsShortcuts(aWindow) {
    let keySet = aWindow.document.getElementById(ZEN_DEVTOOLS_KEYSET_ID);
    let newShortcutList = [];
    for (let i = keySet.children.length - 1; i >= 0; i--) {
      let key = keySet.children[i];
      if (this.IGNORED_DEVTOOLS_SHORTCUTS.includes(key.id)) {
        continue;
      }
      let parsed = KeyShortcut.parseFromXHTML(key, { group: "devTools" });
      if (
        parsed.getID() == "key_inspector" ||
        parsed.getID() == "key_inspectorMac"
      ) {
        parsed.setNewBinding("L");
      }
      newShortcutList.push(parsed);
    }
    return newShortcutList;
  }
}

class nsZenKeyboardShortcutsVersioner {
  static LATEST_KBS_VERSION = 19;

  constructor() {}

  get version() {
    return Services.prefs.getIntPref("zen.keyboard.shortcuts.version", 0);
  }

  set version(version) {
    Services.prefs.setIntPref("zen.keyboard.shortcuts.version", version);
  }

  getVersionedData(data) {
    return { shortcuts: data };
  }

  isVersionUpToDate() {
    return this.version == nsZenKeyboardShortcutsVersioner.LATEST_KBS_VERSION;
  }

  isVersionOutdated() {
    return this.version < nsZenKeyboardShortcutsVersioner.LATEST_KBS_VERSION;
  }

  migrateIfNeeded(data, aWindow, aManager) {
    if (!data) {
      this.version = 0;
    }

    if (this.isVersionUpToDate()) {
      return data;
    }

    if (this.isVersionOutdated()) {
      const version = this.version;
      console.warn(
        "Zen CKS: Migrating shortcuts from version",
        version,
        "to",
        nsZenKeyboardShortcutsVersioner.LATEST_KBS_VERSION
      );
      const newData = this.migrate(data, version, aWindow, aManager);
      this.version = nsZenKeyboardShortcutsVersioner.LATEST_KBS_VERSION;
      return newData;
    }

    console.error("Unknown keyboard shortcuts version");
    this.version = 0;
    return this.migrateIfNeeded(data, aWindow, aManager);
  }

  fillDefaultIfNotPresent(data, aWindow) {
    for (let shortcut of nsZenKeyboardShortcutsLoader.zenGetDefaultShortcuts(
      aWindow
    )) {
      if (shortcut.getID() && !data.find(s => s.getID() == shortcut.getID())) {
        data.push(shortcut);
      }
    }
    return data;
  }

  fixedKeyboardShortcuts(data, aWindow, aManager) {
    let out = this.fillDefaultIfNotPresent(
      this.migrateIfNeeded(data, aWindow, aManager),
      aWindow
    );
    return out;
  }

  // eslint-disable-next-line complexity
  migrate(data, version, aWindow, aManager) {
    if (version < 1) {
      data = nsZenKeyboardShortcutsLoader.zenGetDefaultShortcuts(aWindow);
    }
    if (version < 2) {
      for (let shortcut of data) {
        if (shortcut.getKeyCode() && shortcut.getKeyName()) {
          shortcut.setNewBinding(shortcut.getKeyName());
        }
      }
      data.push(
        new KeyShortcut(
          "zen-pinned-tab-reset-shortcut",
          "",
          "",
          ZEN_OTHER_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({}),
          "cmd_zenPinnedTabReset",
          "zen-pinned-tab-shortcut-reset"
        )
      );
    }
    if (version < 3) {
      const defaultShortcuts =
        nsZenKeyboardShortcutsLoader.zenGetDefaultShortcuts(aWindow);
      for (let shortcut of data) {
        for (let defaultShortcut of defaultShortcuts) {
          if (shortcut.getID() == defaultShortcut.getID()) {
            shortcut._modifyInternalAttribute(defaultShortcut.isInternal());
          }
        }
      }
    }
    if (version < 4) {
      data = data.filter(shortcut => shortcut.getID() != "zen-toggle-sidebar");
    }
    if (version < 5) {
      data.push(
        new KeyShortcut(
          "zen-toggle-sidebar",
          "",
          "",
          ZEN_OTHER_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({}),
          "cmd_zenToggleSidebar",
          "zen-sidebar-shortcut-toggle"
        )
      );
    }
    if (version < 6) {
      data.push(
        new KeyShortcut(
          "zen-copy-url",
          "C",
          "",
          ZEN_OTHER_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({ accel: true, shift: true }),
          "cmd_zenCopyCurrentURL",
          "zen-text-action-copy-url-shortcut"
        )
      );
    }
    if (version < 7) {
      const listener = () => {
        const devToolsShortcuts =
          nsZenKeyboardShortcutsLoader.zenGetDefaultDevToolsShortcuts(aWindow);
        aManager.updatedDefaultDevtoolsShortcuts(devToolsShortcuts);
        aWindow.removeEventListener("zen-devtools-keyset-added", listener);
      };
      aManager._hasToLoadDefaultDevtools = true;
      aWindow.addEventListener("zen-devtools-keyset-added", listener);
    }
    if (version < 8) {
      data.push(
        new KeyShortcut(
          "zen-copy-url-markdown",
          "C",
          "",
          ZEN_OTHER_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({
            accel: true,
            shift: true,
            alt: true,
          }),
          "cmd_zenCopyCurrentURLMarkdown",
          "zen-text-action-copy-url-markdown-shortcut"
        )
      );
    }
    if (version < 9) {
      data = data.filter(
        shortcut => shortcut.getID() != "zen-toggle-web-panel"
      );
      for (let shortcut of data) {
        if (shortcut.getAction()?.startsWith("code:")) {
          const id = shortcut.getID();
          const commandMap = {
            "zen-compact-mode-toggle": "cmd_zenCompactModeToggle",
            "zen-compact-mode-show-sidebar": "cmd_zenCompactModeShowSidebar",
            "zen-workspace-forward": "cmd_zenWorkspaceForward",
            "zen-workspace-backward": "cmd_zenWorkspaceBackward",
            "zen-split-view-grid": "cmd_zenSplitViewGrid",
            "zen-split-view-vertical": "cmd_zenSplitViewVertical",
            "zen-split-view-horizontal": "cmd_zenSplitViewHorizontal",
            "zen-split-view-unsplit": "cmd_zenSplitViewUnsplit",
            "zen-copy-url": "cmd_zenCopyCurrentURL",
            "zen-copy-url-markdown": "cmd_zenCopyCurrentURLMarkdown",
            "zen-pinned-tab-reset-shortcut": "cmd_zenPinnedTabReset",
            "zen-toggle-sidebar": "cmd_zenToggleSidebar",
          };
          if (id?.startsWith("zen-workspace-switch-")) {
            const num = id.replace("zen-workspace-switch-", "");
            commandMap[id] = `cmd_zenWorkspaceSwitch${num}`;
          }
          if (commandMap[id]) {
            shortcut._setAction(commandMap[id]);
          }
        }
      }
    }
    if (version < 10) {
      data.push(
        new KeyShortcut(
          "zen-toggle-pin-tab",
          "D",
          "",
          ZEN_OTHER_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({ accel: true, shift: true }),
          "cmd_zenTogglePinTab",
          "zen-toggle-pin-tab-shortcut"
        )
      );
      data.push(
        new KeyShortcut(
          "zen-glance-expand",
          "O",
          "",
          ZEN_OTHER_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({ accel: true }),
          "cmd_zenGlanceExpand",
          ""
        )
      );
    }
    if (version < 11) {
      data.push(
        new KeyShortcut(
          "zen-new-empty-split-view",
          "*",
          "",
          ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({ accel: true, shift: true }),
          "cmd_zenNewEmptySplit",
          "zen-new-empty-split-view-shortcut"
        )
      );
    }
    if (version < 12) {
      const shouldBeEmptyShortcuts = [
        "openFileKb",
        "bookmarkAllTabsKb",
        "key_stop",
      ];
      for (let shortcut of data) {
        if (shouldBeEmptyShortcuts.includes(shortcut.getID?.())) {
          shortcut.shouldBeEmpty = true;
        }
      }
      data = data.filter(
        shortcut => shortcut.getID() != "zen-compact-mode-show-toolbar"
      );
    }
    if (version < 13) {
      data.push(
        new KeyShortcut(
          "zen-close-all-unpinned-tabs",
          "K",
          "",
          ZEN_WORKSPACE_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({ accel: true, shift: true }),
          "cmd_zenCloseUnpinnedTabs",
          "zen-close-all-unpinned-tabs-shortcut"
        )
      );
    }
    if (version < 15) {
      data.push(
        new KeyShortcut(
          "zen-new-unsynced-window",
          "N",
          "",
          ZEN_OTHER_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({ accel: true, shift: true }),
          "cmd_zenNewNavigatorUnsynced",
          "zen-new-unsynced-window-shortcut"
        )
      );
      let emptySplitFound = false,
        undoCloseWindowFound = false;
      for (let shortcut of data) {
        if (
          shortcut.getID() == "zen-new-empty-split-view" &&
          AppConstants.platform == "macosx"
        ) {
          if (shortcut.getKeyName() == "+") {
            shortcut.setNewBinding("*");
          }
          emptySplitFound = true;
        } else if (shortcut.getID() == "key_undoCloseWindow") {
          shortcut.shouldBeEmpty = true;
          shortcut.setDisabled(true);
          undoCloseWindowFound = true;
        }
        if (emptySplitFound && undoCloseWindowFound) {
          break;
        }
      }
    }
    if (version < 16) {
      for (let shortcut of data) {
        if (shortcut.getID() == "zen-compact-mode-toggle") {
          shortcut._setAction("cmd_toggleCompactModeIgnoreHover");
          break;
        }
      }
    }
    if (version < 17) {
      data.push(
        new KeyShortcut(
          "zen-duplicate-tab",
          "",
          "",
          "windowAndTabManagement",
          nsKeyShortcutModifiers.fromObject({}),
          "cmd_zenDuplicateTab",
          "zen-duplicate-tab-shortcut"
        )
      );
    }
    if (version < 18) {
      data.push(
        new KeyShortcut(
          "zen-new-little-window",
          "N",
          "",
          ZEN_OTHER_SHORTCUTS_GROUP,
          nsKeyShortcutModifiers.fromObject({ accel: true, alt: true }),
          "cmd_zenNewLittleWindow",
          "zen-new-little-window-shortcut",
          /*disabled=*/ false,
          /*reserved=*/ true,
          /*internal=*/ false,
          /*zenGlobal=*/ true
        )
      );
    }
    if (version < 19) {
      for (let shortcut of data) {
        if (shortcut.getID() == "zen-new-little-window") {
          shortcut._setZenGlobal(true);
          break;
        }
      }
    }
    return data;
  }
}

const KbsManager = {
  loader: new nsZenKeyboardShortcutsLoader(),
  _hasToLoadDevtools: false,
  _inlineCommands: [],
  _initialized: false,
  _initializingPromise: null,
  _currentShortcutList: null,
  versioner: null,

  beforeInit(aWindow) {
    void this.getZenKeyset(aWindow);

    aWindow._zenKbsHasCleared = Services.prefs.getBoolPref(
      "zen.keyboard.shortcuts.disable-mainkeyset-clear",
      false
    );
    const onDevtoolsKeysetAdded = () => this._hasAddedDevtoolShortcuts();
    aWindow.addEventListener(
      "zen-devtools-keyset-added",
      onDevtoolsKeysetAdded
    );
    aWindow._zenKbsDevtoolsListener = onDevtoolsKeysetAdded;

    if (!this._initialized && !this._initializingPromise) {
      this._initializingPromise = this._init(aWindow).finally(() => {
        this._initializingPromise = null;
      });
      return;
    }
    if (this._initialized) {
      // Subsequent windows just need their keyset populated.
      this._applyShortcutsTo(aWindow);
      this._applyZenGlobalListenersFor(aWindow);
      aWindow.dispatchEvent(
        new aWindow.Event("ZenKeyboardShortcutsReady", { bubbles: true })
      );
    }
  },

  async _init(aWindow) {
    const loadedShortcuts = await this._loadSaved();
    this._currentShortcutList = this.versioner.fixedKeyboardShortcuts(
      loadedShortcuts,
      aWindow,
      this
    );
    this._initialized = true;
    this._applyShortcuts();
    await this._saveShortcuts();
    aWindow.dispatchEvent(
      new aWindow.Event("ZenKeyboardShortcutsReady", { bubbles: true })
    );
  },

  // Kept for back-compat with chrome callers; ZenStartup.mjs invokes it.
  init() {
    // Initialization is driven by `beforeInit(aWindow)` from
    // browser-window-before-show. Nothing to do here.
  },

  async _loadSaved() {
    var innerLoad = async () => {
      let data = await this.loader.load();
      if (!data || !data.length) {
        return null;
      }
      try {
        return KeyShortcut.parseFromSaved(data);
      } catch (e) {
        console.error(
          "Zen CKS: Error parsing saved shortcuts. Resetting to defaults...",
          e
        );
        return null;
      }
    };

    const loadedShortcuts = await innerLoad();
    this.versioner = new nsZenKeyboardShortcutsVersioner(loadedShortcuts);
    return loadedShortcuts;
  },

  getZenKeyset(browser) {
    if (!browser._zenKeyset) {
      const existingKeyset = browser.document.getElementById(ZEN_KEYSET_ID);
      if (existingKeyset) {
        browser._zenKeyset = existingKeyset;
        return browser._zenKeyset;
      }
      throw new Error("Zen keyset not found");
    }
    return browser._zenKeyset;
  },

  getZenDevtoolsKeyset(browser) {
    if (!browser._zenDevtoolsKeyset) {
      const id = `zen-${ZEN_DEVTOOLS_KEYSET_ID}`;
      const existingKeyset = browser.document.getElementById(id);
      if (existingKeyset) {
        browser._zenDevtoolsKeyset = existingKeyset;
        return existingKeyset;
      }
      browser._zenDevtoolsKeyset = browser.document.createXULElement("keyset");
      browser._zenDevtoolsKeyset.id = id;
      const mainKeyset = browser.document.getElementById(
        ZEN_DEVTOOLS_KEYSET_ID
      );
      mainKeyset.before(browser._zenDevtoolsKeyset);
    }
    return browser._zenDevtoolsKeyset;
  },

  clearMainKeyset(browser, element) {
    if (browser._zenKbsHasCleared) {
      return;
    }
    browser._zenKbsHasCleared = true;
    const children = element.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const key = children[i];
      if (key.getAttribute("internal") == "true") {
        continue;
      }
      key.remove();
    }

    // Restore the keyset, https://searchfox.org/mozilla-central/rev/a59018f9ff34170810b43e12bf6f09a1512de7ab/dom/events/GlobalKeyListener.cpp#478
    // eslint-disable-next-line no-shadow
    const parent = element.parentElement;
    element.remove();
    parent.prepend(element);
  },

  async updatedDefaultDevtoolsShortcuts(shortcuts) {
    this._hasToLoadDefaultDevtools = false;
    this._currentShortcutList = this._currentShortcutList.concat(shortcuts);
    await this._saveShortcuts();
    this._hasAddedDevtoolShortcuts();
  },

  _hasAddedDevtoolShortcuts() {
    if (this._hasToLoadDevtools || this._hasToLoadDefaultDevtools) {
      return;
    }
    this._hasToLoadDevtools = true;
    this.triggerShortcutRebuild();
  },

  _applyShortcuts() {
    for (const browser of browserWindows()) {
      this._applyShortcutsTo(browser);
    }
    this._applyZenGlobalShortcuts();
  },

  _applyShortcutsTo(browser) {
    let mainKeyset = browser.document.getElementById(ZEN_MAIN_KEYSET_ID);
    if (!mainKeyset) {
      throw new Error("Main keyset not found");
    }
    this.clearMainKeyset(browser, mainKeyset);

    const keyset = this.getZenKeyset(browser);
    keyset.innerHTML = "";

    for (let key of this._currentShortcutList) {
      if (key.isInternal()) {
        continue;
      }
      let child = key.toXHTMLElement(browser);
      keyset.appendChild(child);
    }

    this._applyDevtoolsShortcuts(browser);
    mainKeyset.after(keyset);
  },

  _zenGlobalKeyName(shortcut) {
    const name = shortcut.getKeyName();
    if (name && name.length === 1) {
      return name.toUpperCase();
    }
    const code = shortcut.getKeyCode();
    if (!code) {
      return null;
    }
    if (code === "VK_SPACE") {
      return "Space";
    }
    const fMatch = /^VK_F(\d{1,2})$/.exec(code);
    if (fMatch) {
      const n = Number(fMatch[1]);
      if (n >= 1 && n <= 12) {
        return `F${n}`;
      }
    }
    return null;
  },

  _zenGlobalModifierBits(modifiers) {
    const iface = Ci.nsIZenGlobalShortcuts;
    let bits = 0;
    if (modifiers.shift) {
      bits |= iface.MODIFIER_SHIFT;
    }
    if (modifiers.alt) {
      bits |= iface.MODIFIER_ALT;
    }
    if (modifiers.meta) {
      bits |= iface.MODIFIER_META;
    }
    if (modifiers.control) {
      bits |= iface.MODIFIER_CTRL;
    }
    if (modifiers.accel) {
      bits |=
        AppConstants.platform == "macosx"
          ? iface.MODIFIER_META
          : iface.MODIFIER_CTRL;
    }
    return bits;
  },

  _applyZenGlobalListenersFor(browser) {
    const map = browser._zenGlobalListenerMap;
    if (map) {
      for (const [name, listener] of map) {
        browser.removeEventListener(name, listener);
      }
      map.clear();
    } else {
      browser._zenGlobalListenerMap = new Map();
    }

    if (!lazy.GLOBAL_SHORTCUTS_ENABLED) {
      return;
    }

    for (const shortcut of this._currentShortcutList) {
      if (!shortcut.isZenGlobal() || shortcut.isDisabled()) {
        continue;
      }
      const id = shortcut.getID();
      const command = shortcut.getAction();
      const eventName = `zen-global-shortcut-${id}`;
      const listener = () => {
        if (!command) {
          return;
        }
        const cmdEl = browser.document.getElementById(command);
        if (cmdEl) {
          cmdEl.doCommand();
        } else {
          console.warn(
            `Zen CKS: no command element for "${command}" (shortcut "${id}")`
          );
        }
      };
      browser.addEventListener(eventName, listener);
      browser._zenGlobalListenerMap.set(eventName, listener);
    }
  },

  _applyZenGlobalShortcuts() {
    lazy.ZenGlobalShortcuts.unregisterAll();

    for (const browser of browserWindows()) {
      this._applyZenGlobalListenersFor(browser);
    }

    if (!lazy.GLOBAL_SHORTCUTS_ENABLED) {
      return;
    }

    for (const shortcut of this._currentShortcutList) {
      if (!shortcut.isZenGlobal() || shortcut.isDisabled()) {
        continue;
      }
      const key = this._zenGlobalKeyName(shortcut);
      if (!key) {
        continue;
      }
      const id = shortcut.getID();
      const mods = this._zenGlobalModifierBits(shortcut.getModifiers());
      try {
        lazy.ZenGlobalShortcuts.registerShortcut(id, key, mods);
      } catch (e) {
        console.warn(`Zen CKS: failed to register global shortcut "${id}"`, e);
      }
    }
  },

  _applyDevtoolsShortcuts(browser) {
    if (!browser._zenKbsHasToLoadDevtools && !this._hasToLoadDevtools) {
      return;
    }
    let devtoolsKeyset = this.getZenDevtoolsKeyset(browser);
    for (let key of this._currentShortcutList) {
      if (key.getGroup() != "devTools") {
        continue;
      }
      if (
        nsZenKeyboardShortcutsLoader.IGNORED_DEVTOOLS_SHORTCUTS.includes(
          key.getID()
        )
      ) {
        continue;
      }
      const originalKey = browser.document.getElementById(key.getID());
      if (!originalKey) {
        continue;
      }
      key.replaceWithChild(originalKey);
      if (originalKey.parentElement.id === ZEN_DEVTOOLS_KEYSET_ID) {
        devtoolsKeyset.prepend(originalKey);
      }
    }

    const originalDevKeyset = browser.document.getElementById(
      ZEN_DEVTOOLS_KEYSET_ID
    );
    originalDevKeyset.after(devtoolsKeyset);
  },

  async resetAllShortcuts() {
    await this.loader.remove();
    Services.prefs.clearUserPref("zen.keyboard.shortcuts.version");
  },

  async _saveShortcuts() {
    let json = [];
    for (const shortcut of this._currentShortcutList) {
      json.push(shortcut.toJSONForm());
    }
    await this.loader.save(this.versioner.getVersionedData(json));
  },

  triggerShortcutRebuild() {
    if (!this._initialized) {
      return;
    }
    this._applyShortcuts();
  },

  async setShortcut(action, shortcut, modifiers) {
    if (!action) {
      throw new Error("Action cannot be null");
    }
    for (let targetShortcut of this._currentShortcutList) {
      if (targetShortcut.getID() != action) {
        continue;
      }
      if (!shortcut && !modifiers) {
        targetShortcut.clearKeybind();
      } else {
        targetShortcut.setNewBinding(shortcut);
        targetShortcut.setModifiers(modifiers);
      }
    }
    await this._saveShortcuts();
    this.triggerShortcutRebuild();
  },

  async getModifiableShortcuts() {
    let rv = [];
    if (!this._currentShortcutList) {
      this._currentShortcutList = await this._loadSaved();
    }
    for (let shortcut of this._currentShortcutList) {
      if (shortcut.isUserEditable()) {
        rv.push(shortcut);
      }
    }
    return rv;
  },

  checkForConflicts(shortcut, modifiers, id) {
    const realShortcut = shortcut.toLowerCase();
    for (let targetShortcut of this._currentShortcutList) {
      if (targetShortcut.getID() == id) {
        continue;
      }
      if (
        targetShortcut.getModifiers().equals(modifiers) &&
        targetShortcut.getKeyNameOrCode()?.toLowerCase() == realShortcut
      ) {
        return { hasConflicts: true, conflictShortcut: targetShortcut };
      }
    }
    return { hasConflicts: false };
  },

  getShortcutFromCommand(command) {
    if (!this._currentShortcutList) {
      return null;
    }
    for (let targetShortcut of this._currentShortcutList) {
      if (targetShortcut.getAction() == command) {
        return targetShortcut;
      }
    }
    return null;
  },

  /**
   * @param {string} command
   * @returns {string|null}
   */
  getShortcutDisplayFromCommand(command) {
    if (!command) {
      return null;
    }
    const shortcut = this.getShortcutFromCommand(command);
    return shortcut ? shortcut.toDisplayString() : null;
  },
};

function* browserWindows() {
  const en = Services.wm.getEnumerator("navigator:browser");
  while (en.hasMoreElements()) {
    const win = en.getNext();
    if (win.closed) {
      continue;
    }
    yield win;
  }
}

function isBrowserWindow(aWindow) {
  return aWindow?.location?.href === "chrome://browser/content/browser.xhtml";
}

function exposeWindowGlobals(aWindow) {
  // Bridge for legacy chrome callers that referenced these as window globals.
  aWindow.gZenKeyboardShortcutsManager = KbsManager;
  aWindow.VALID_SHORTCUT_GROUPS = VALID_SHORTCUT_GROUPS;
  aWindow.ZEN_KEYSET_ID = ZEN_KEYSET_ID;
}

export const ZenKeyboardShortcuts = {
  manager: KbsManager,
  _initialized: false,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    Services.obs.addObserver(this, "browser-window-before-show");
    Services.obs.addObserver(this, "quit-application-granted");
  },

  uninit() {
    if (!this._initialized) {
      return;
    }
    this._initialized = false;
    try {
      Services.obs.removeObserver(this, "browser-window-before-show");
    } catch (e) {}
    try {
      Services.obs.removeObserver(this, "quit-application-granted");
    } catch (e) {}
    try {
      lazy.ZenGlobalShortcuts.unregisterAll();
    } catch (e) {}
  },

  observe(aSubject, aTopic) {
    switch (aTopic) {
      case "browser-window-before-show":
        if (!isBrowserWindow(aSubject)) {
          return;
        }
        exposeWindowGlobals(aSubject);
        KbsManager.beforeInit(aSubject);
        break;
      case "quit-application-granted":
        this.uninit();
        break;
    }
  },
};
