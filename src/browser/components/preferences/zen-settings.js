// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const kZenColors = [
  "#aac7ff",
  "#74d7cb",
  "#a0d490",
  "#dec663",
  "#ffb787",
  "#dec1b1",
  "#ffb1c0",
  "#ddbfc3",
  "#f6b0ea",
  "#d4bbff",
];

var gZenLooksAndFeel = {
  init() {
    this._initializeColorPicker(this._getInitialAccentColor());
    window.zenPageAccentColorChanged = this._handleAccentColorChange.bind(this);
    gZenThemeBuilder.init();
  },

  _initializeColorPicker(accentColor) {
    let elem = document.getElementById("zenLooksAndFeelColorOptions");
    elem.innerHTML = "";
    for (let color of kZenColors) {
      let colorElemParen = document.createElement("div");
      let colorElem = document.createElement("div");
      colorElemParen.classList.add("zenLooksAndFeelColorOptionParen");
      colorElem.classList.add("zenLooksAndFeelColorOption");
      colorElem.style.setProperty("--zen-primary-color", color, "important");
      if (accentColor === color) {
        colorElemParen.setAttribute("selected", "true");
      }
      colorElemParen.addEventListener("click", () => {
        Services.prefs.setStringPref("zen.theme.accent-color", color);
      });
      colorElemParen.appendChild(colorElem);
      elem.appendChild(colorElemParen);
    }
    // TODO: add custom color selection!
  },

  _handleAccentColorChange(accentColor) {
    this._initializeColorPicker(accentColor);
  },

  _getInitialAccentColor() {
    return Services.prefs.getStringPref("zen.theme.accent-color", kZenColors[0]);
  },
};

var gZenWorkspacesSettings = {
  init() {
  },
};

var gZenCKSSettings = {
  init() {
    this._currentAction = null;
    this._initializeEvents();
    this._initializeCKS();
    this._addPrefObservers();
  },

  _addPrefObservers() {
    Services.prefs.addObserver("zen.keyboard.shortcuts.disable-firefox", this.onDisableFirefoxShortcutsChange.bind(this));
  },

  async onDisableFirefoxShortcutsChange(event) {
    let checked = Services.prefs.getBoolPref("zen.keyboard.shortcuts.disable-firefox");
    if (checked) return;
    let buttonIndex = await confirmRestartPrompt(
      true,
      1,
      true,
      false
    );
    if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
      Services.startup.quit(
        Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
      );
      return;
    }
  },

  _initializeCKS() {
    let wrapepr = document.getElementById("zenCKSOptions-wrapper");

    // Create the groups first.
    for (let key in kZKSActions) {
      const data = kZKSActions[key];
      const group = data[2];
      if (!wrapepr.querySelector(`[data-group="${group}"]`)) {
        let groupElem = document.createElement("h2");
        groupElem.setAttribute("data-group", group);
        document.l10n.setAttributes(groupElem, `zen-cks-group-${group}`);
        wrapepr.appendChild(groupElem);
      }
    }

    const keys = Object.keys(kZKSActions);
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];
      const data = kZKSActions[key];
      const l10nId = data[1];
      const group = data[2];
      let fragment = window.MozXULElement.parseXULToFragment(`
        <hbox class="zenCKSOption">
          <label class="zenCKSOption-label" for="zenCKSOption-${key}"></label>
          <html:input readonly="1" class="zenCKSOption-input" id="zenCKSOption-${key}" />
        </hbox>
      `);
      document.l10n.setAttributes(fragment.querySelector(".zenCKSOption-label"), l10nId);

      let input = fragment.querySelector(".zenCKSOption-input");
      let shortcut = gZenKeyboardShortcuts.getShortcut(key);
      if (shortcut) {
        input.value = gZenKeyboardShortcuts.shortCutToString(shortcut);
      } else {
        this._resetCKS(input, key);
      }

      input.setAttribute("data-key", key);
      input.addEventListener("focus", (event) => {
        const key = event.target.getAttribute("data-key");
        this._currentAction = key;
        event.target.classList.add("zenCKSOption-input-editing");
      });

      input.addEventListener("blur", (event) => {
        this._currentAction = null;
        event.target.classList.remove("zenCKSOption-input-editing");
      });

      const groupElem = wrapepr.querySelector(`[data-group="${group}"]`);
      groupElem.after(fragment);
    }
  },

  _resetCKS(input, key) {
    input.value = "Not set";
    input.classList.add("zenCKSOption-input-not-set");
    input.classList.remove("zenCKSOption-input-invalid");
    gZenKeyboardShortcuts.setShortcut(key, null);
  },

  _initializeEvents() {
    window.addEventListener("keydown", this._handleKeyDown.bind(this));
  },

  _handleKeyDown(event) {
    if (!this._currentAction) {
      return;
    }

    let input = document.querySelector(`.zenCKSOption-input[data-key="${this._currentAction}"]`);
    let shortcut = {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey
    };

    const shortcutWithoutModifiers = !shortcut.ctrl && !shortcut.alt && !shortcut.shift && !shortcut.meta;

    if (event.key === "Tab" && shortcutWithoutModifiers) {
      return;
    } else if (event.key === "Escape" && shortcutWithoutModifiers) {
      this._currentAction = null;
      input.blur();
      return;
    } else if (event.key === "Backspace" && shortcutWithoutModifiers) {
      this._resetCKS(input, this._currentAction);
      return;
    }

    if (!shortcut.ctrl && !shortcut.alt && !shortcut.shift && !shortcut.meta) {
      this._resetCKS(input, this._currentAction);
      return; // No modifiers, ignore.
    }

    if (!(["Control", "Alt", "Meta", "Shift"].includes(event.key))) {
      if (event.keycode) {
        shortcut.keycode = event.keycode;
      } else {
        shortcut.key = event.key;
      }
    }

    event.preventDefault();
    gZenKeyboardShortcuts.setShortcut(this._currentAction, shortcut);

    input.value = gZenKeyboardShortcuts.shortCutToString(shortcut);
    input.classList.remove("zenCKSOption-input-not-set");

    if (gZenKeyboardShortcuts.isValidShortcut(shortcut)) {
      input.classList.remove("zenCKSOption-input-invalid");
    } else {
      input.classList.add("zenCKSOption-input-invalid");
    }
  },
};

Preferences.addAll([
  {
    id: "zen.theme.toolbar-themed",
    type: "bool",
    default: true,
  },
  {
    id: "zen.sidebar.enabled",
    type: "bool",
    default: true,
  },
  {
    id: "zen.sidebar.close-on-blur",
    type: "bool",
    default: true,
  },
  {
    id: "zen.view.compact",
    type: "bool",
    default: false,
  },
  {
    id: "zen.view.compact.hide-toolbar",
    type: "bool",
    default: false,
  },
  {
    id: "zen.workspaces.enabled",
    type: "bool",
    default: true,
  },
  {
    id: "zen.view.sidebar-expanded.show-button",
    type: "bool",
    default: true,
  },
  {
    id: "zen.view.sidebar-expanded",
    type: "bool",
    default: true,
  },
  {
    id: "zen.theme.pill-button",
    type: "bool",
    default: true,
  },
  {
    id: "zen.theme.floating-urlbar",
    type: "bool",
    default: false,
  },
  {
    id: "zen.keyboard.shortcuts.disable-firefox",
    type: "bool",
    default: false,
  }
]);
