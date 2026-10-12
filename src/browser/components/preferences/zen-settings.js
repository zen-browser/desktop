/* eslint-disable no-undef */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const { nsKeyShortcutModifiers } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenKeyboardShortcuts.mjs",
  {
    global: "current",
  }
);

const kZenExtendedSidebar = "zen.view.sidebar-expanded";
const kZenSingleToolbar = "zen.view.use-single-toolbar";

var gZenLooksAndFeel = {
  init() {
    if (this.__hasInitialized) {
      return;
    }
    this.__hasInitialized = true;
    for (const pref of [kZenExtendedSidebar, kZenSingleToolbar]) {
      Services.prefs.addObserver(pref, this);
    }
    window.addEventListener("unload", () => {
      for (const pref of [kZenExtendedSidebar, kZenSingleToolbar]) {
        Services.prefs.removeObserver(pref, this);
      }
    });
    this.applySidebarLayout();
  },

  observe() {
    this.applySidebarLayout();
  },

  applySidebarLayout() {
    const isSingleToolbar = Services.prefs.getBoolPref(kZenSingleToolbar);
    const isExtendedSidebar = Services.prefs.getBoolPref(kZenExtendedSidebar);
    for (const layout of document.getElementById("zenLayoutList").children) {
      layout.classList.remove("selected");
      if (layout.getAttribute("layout") == "single" && isSingleToolbar) {
        layout.classList.add("selected");
      } else if (
        layout.getAttribute("layout") == "multiple" &&
        !isSingleToolbar &&
        isExtendedSidebar
      ) {
        layout.classList.add("selected");
      } else if (layout.getAttribute("layout") == "collapsed" && !isExtendedSidebar) {
        layout.classList.add("selected");
      }
    }
    if (this.__hasInitializedLayout) {
      return;
    }
    this.__hasInitializedLayout = true;
    for (const layout of document.getElementById("zenLayoutList").children) {
      layout.addEventListener("click", () => {
        if (layout.hasAttribute("disabled")) {
          return;
        }

        for (const el of document.getElementById("zenLayoutList").children) {
          el.classList.remove("selected");
        }

        layout.classList.add("selected");

        Services.prefs.setBoolPref(
          kZenExtendedSidebar,
          layout.getAttribute("layout") != "collapsed"
        );
        Services.prefs.setBoolPref(kZenSingleToolbar, layout.getAttribute("layout") == "single");
      });
    }
  },
};

var gZenToolbarUrlbarSettings = {
  init() {},
};

var gZenWorkspacesSettings = {
  init() {
    const syncLink = document.getElementById("zenSpacesOpenSyncSettings");
    if (syncLink) {
      const openSyncSettings = event => {
        event.preventDefault();
        for (const id of ["category-sync", "category-account"]) {
          const navButton = document.getElementById(id);
          if (navButton && !navButton.hidden) {
            navButton.click();
            return;
          }
        }
      };
      syncLink.addEventListener("click", openSyncSettings);
      window.addEventListener("unload", () => {
        syncLink.removeEventListener("click", openSyncSettings);
      });
    }

    var tabsUnloaderPrefListener = {
      async observe() {
        let buttonIndex = await confirmRestartPrompt(true, 1, true, true);
        if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
          Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
        }
      },
    };

    let toggleZenCycleByAttrWarning = {
      observe() {
        const warning = document.getElementById("zenTabsCycleByAttributeWarning");
        warning.hidden = !(
          Services.prefs.getBoolPref("zen.tabs.ctrl-tab.ignore-essential-tabs", false) &&
          Services.prefs.getBoolPref("browser.ctrlTab.sortByRecentlyUsed", false)
        );
      },
    };

    toggleZenCycleByAttrWarning.observe(); // call it once on initial load

    Services.prefs.addObserver("zen.glance.enabled", tabsUnloaderPrefListener); // We can use the same listener for both prefs
    Services.prefs.addObserver("zen.workspaces.separate-essentials", tabsUnloaderPrefListener);
    Services.prefs.addObserver("zen.window-sync.sync-only-pinned-tabs", tabsUnloaderPrefListener);
    Services.prefs.addObserver(
      "zen.tabs.ctrl-tab.ignore-essential-tabs",
      toggleZenCycleByAttrWarning
    );
    Services.prefs.addObserver("browser.ctrlTab.sortByRecentlyUsed", toggleZenCycleByAttrWarning);
    window.addEventListener("unload", () => {
      Services.prefs.removeObserver("zen.glance.enabled", tabsUnloaderPrefListener);
      Services.prefs.removeObserver("zen.workspaces.separate-essentials", tabsUnloaderPrefListener);
      Services.prefs.removeObserver(
        "zen.window-sync.sync-only-pinned-tabs",
        tabsUnloaderPrefListener
      );
      Services.prefs.removeObserver(
        "zen.tabs.ctrl-tab.ignore-essential-tabs",
        toggleZenCycleByAttrWarning
      );
      Services.prefs.removeObserver(
        "browser.ctrlTab.sortByRecentlyUsed",
        toggleZenCycleByAttrWarning
      );
    });
  },
};

const ZEN_CKS_CLASS_BASE = "zenCKSOption";
const ZEN_CKS_INPUT_FIELD_CLASS = `${ZEN_CKS_CLASS_BASE}-input`;
const ZEN_CKS_LABEL_CLASS = `${ZEN_CKS_CLASS_BASE}-label`;
const ZEN_CKS_WRAPPER_ID = `${ZEN_CKS_CLASS_BASE}-wrapper`;
const ZEN_CKS_GROUP_PREFIX = `${ZEN_CKS_CLASS_BASE}-group`;
const KEYBIND_ATTRIBUTE_KEY = "key";

const zenMissingKeyboardShortcutL10n = {
  key_quickRestart: "zen-key-quick-restart",
  key_delete: "zen-key-delete",
  goBackKb: "zen-key-go-back",
  goForwardKb: "zen-key-go-forward",
  key_enterFullScreen: "zen-key-enter-full-screen",
  key_exitFullScreen: "zen-key-exit-full-screen",
  key_aboutProcesses: "zen-key-about-processes",
  key_sanitize: "zen-key-sanitize",
  key_wrCaptureCmd: "zen-key-wr-capture-cmd",
  key_wrToggleCaptureSequenceCmd: "zen-key-wr-toggle-capture-sequence-cmd",
  key_undoCloseWindow: "zen-key-undo-close-window",

  "zen-glance-expand": "zen-glance-expand",

  key_selectTab1: "zen-key-select-tab-1",
  key_selectTab2: "zen-key-select-tab-2",
  key_selectTab3: "zen-key-select-tab-3",
  key_selectTab4: "zen-key-select-tab-4",
  key_selectTab5: "zen-key-select-tab-5",
  key_selectTab6: "zen-key-select-tab-6",
  key_selectTab7: "zen-key-select-tab-7",
  key_selectTab8: "zen-key-select-tab-8",
  key_selectLastTab: "zen-key-select-tab-last",
  key_duplicateTab: "customkeys-file-duplicate-tab",

  key_showAllTabs: "zen-key-show-all-tabs",
  key_gotoHistory: "zen-key-goto-history",

  goHome: "zen-key-go-home",
  key_redo: "zen-key-redo",

  key_inspectorMac: "zen-key-inspector-mac",
  key_findSelection: "zen-key-find-selection",
  key_findPrevious2: "zen-search-find-again-shortcut-prev-alt",

  // Devtools
  key_toggleToolbox: "zen-devtools-toggle-shortcut",
  key_browserToolbox: "zen-devtools-toggle-browser-toolbox-shortcut",
  key_browserConsole: "zen-devtools-toggle-browser-console-shortcut",
  key_responsiveDesignMode: "zen-devtools-toggle-responsive-design-mode-shortcut",
  key_inspector: "zen-devtools-toggle-inspector-shortcut",
  key_webconsole: "zen-devtools-toggle-web-console-shortcut",
  key_jsdebugger: "zen-devtools-toggle-js-debugger-shortcut",
  key_netmonitor: "zen-devtools-toggle-net-monitor-shortcut",
  key_styleeditor: "zen-devtools-toggle-style-editor-shortcut",
  key_performance: "zen-devtools-toggle-performance-shortcut",
  key_storage: "zen-devtools-toggle-storage-shortcut",
  key_dom: "zen-devtools-toggle-dom-shortcut",
  key_accessibility: "zen-devtools-toggle-accessibility-shortcut",
};

var zenIgnoreKeyboardShortcutIDs = [
  "key_enterFullScreen_old",
  "key_enterFullScreen_compat",
  "key_exitFullScreen_old",
  "key_exitFullScreen_compat",
  "key_duplicateTab",
  "key_addTabSplitView",
  "key_separateTabSplitView",
  "viewOpenTabsSidebarKb",
];

var zenIgnoreKeyboardShortcutL10n = [
  "zen-full-zoom-reduce-shortcut-alt-b",
  "zen-full-zoom-reduce-shortcut-alt-a",
];

var gZenCKSSettings = {
  async init() {
    await this._initializeCKS();
    if (this.__hasInitialized) {
      return;
    }
    this.__hasInitialized = true;
    this._currentActionID = null;
    this._initializeEvents();
    this._initializeNotepadShortcut();
    window.addEventListener("unload", () => {
      this.__hasInitialized = false;
      document.getElementById(ZEN_CKS_WRAPPER_ID).innerHTML = "";
    });
  },

  _initializeNotepadShortcut() {
    const input = document.getElementById("zenNotepadShortcutInput");
    const reset = document.getElementById("zenNotepadShortcutReset");
    if (!input || !reset || input.dataset.bound) {
      return;
    }
    input.dataset.bound = "true";
    const pref = "zen.notepad.autocomplete-key";
    const { shortcutFromEvent } = ChromeUtils.importESModule(
      "resource:///modules/zen/notepad/ZenNotepadMarkdown.mjs"
    );
    const show = () => {
      input.value = Services.prefs.getStringPref(pref, "Tab");
    };
    show();
    input.addEventListener("keydown", event => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        input.blur();
        return;
      }
      const spec = shortcutFromEvent(event);
      if (!spec) {
        return;
      }
      Services.prefs.setStringPref(pref, spec);
      input.value = spec;
      input.blur();
    });
    reset.addEventListener("command", () => {
      Services.prefs.setStringPref(pref, "Tab");
      show();
    });
    reset.addEventListener("click", () => {
      Services.prefs.setStringPref(pref, "Tab");
      show();
    });
  },

  _initializeEvents() {
    const resetAllListener = this.resetAllShortcuts.bind(this);
    const handleKeyDown = this._handleKeyDown.bind(this);
    window.addEventListener("keydown", handleKeyDown);
    const button = document.getElementById("zenCKSResetButton");
    button.addEventListener("click", resetAllListener);
    window.addEventListener("unload", () => {
      window.removeEventListener("keydown", handleKeyDown);
      button.removeEventListener("click", resetAllListener);
    });
  },

  async resetAllShortcuts() {
    let buttonIndex = await confirmRestartPrompt(true, 1, true, false);
    if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
      await gZenKeyboardShortcutsManager.resetAllShortcuts();
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
    }
  },

  async _initializeCKS() {
    let wrapper = document.getElementById(ZEN_CKS_WRAPPER_ID);
    wrapper.innerHTML = "";

    let shortcuts = await gZenKeyboardShortcutsManager.getModifiableShortcuts();

    if (!shortcuts) {
      throw Error("No shortcuts defined!");
    }

    // Generate section per each group
    for (let group of VALID_SHORTCUT_GROUPS) {
      let groupClass = `${ZEN_CKS_GROUP_PREFIX}-${group}`;
      if (!wrapper.querySelector(`[data-group="${groupClass}"]`)) {
        let groupElem = document.createElement("h2");
        groupElem.setAttribute("data-group", groupClass);
        document.l10n.setAttributes(groupElem, groupClass);
        wrapper.appendChild(groupElem);
      }
    }

    for (let shortcut of shortcuts) {
      const keyID = shortcut.getID();
      const action = shortcut.getAction();
      const l10nID = shortcut.getL10NID();
      const group = shortcut.getGroup();
      const keyInString = shortcut.toDisplayString();

      const labelValue = zenMissingKeyboardShortcutL10n[keyID] ?? l10nID;

      if (
        zenIgnoreKeyboardShortcutIDs.includes(keyID) ||
        zenIgnoreKeyboardShortcutL10n.includes(labelValue) ||
        shortcut.shouldBeEmpty
      ) {
        continue;
      }

      let fragment = window.MozXULElement.parseXULToFragment(`
        <hbox class="${ZEN_CKS_CLASS_BASE}">
          <label class="${ZEN_CKS_LABEL_CLASS}" for="${ZEN_CKS_CLASS_BASE}-${keyID}"></label>
          <vbox flex="1">
            <html:input readonly="1" class="${ZEN_CKS_INPUT_FIELD_CLASS}" id="${ZEN_CKS_INPUT_FIELD_CLASS}-${keyID}" />
          </vbox>
        </hbox>
      `);

      const label = fragment.querySelector(`.${ZEN_CKS_LABEL_CLASS}`);
      if (!labelValue) {
        label.textContent = action; // Just in case
      } else {
        document.l10n.setAttributes(label, labelValue);
      }

      let input = fragment.querySelector(`.${ZEN_CKS_INPUT_FIELD_CLASS}`);
      if (keyInString && !shortcut.isEmpty()) {
        input.value = keyInString;
      } else {
        this._resetShortcut(input);
      }

      input.setAttribute(KEYBIND_ATTRIBUTE_KEY, keyID);
      input.setAttribute("data-group", group);
      input.setAttribute("data-id", keyID);

      input.addEventListener("focus", (event) => {
        this._currentActionID = event.target.getAttribute("data-id");
        event.target.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
        this._hasSafed = true;
      });

      input.addEventListener("editDone", (event) => {
        const target = event.target;
        target.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
      });

      input.addEventListener("blur", (event) => {
        this._currentActionID = null;
        const target = event.target;
        target.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
        if (!this._hasSafed) {
          target.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-unsafed`);
          if (!target.nextElementSibling) {
            target.after(
              window.MozXULElement.parseXULToFragment(`
              <label class="${ZEN_CKS_CLASS_BASE}-unsafed" data-l10n-id="zen-key-unsaved"></label>
            `)
            );
            target.value = "Not set";
          }
        } else {
          target.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-unsafed`);
          const sibling = target.nextElementSibling;
          if (sibling && sibling.classList.contains(`${ZEN_CKS_CLASS_BASE}-unsafed`)) {
            sibling.remove();
          }
        }
        if (target.classList.contains(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`)) {
          target.label = "Not set";
        }
      });

      const groupElem = wrapper.querySelector(`[data-group="${ZEN_CKS_GROUP_PREFIX}-${group}"]`);
      groupElem.after(fragment);
    }
  },

  async _resetShortcut(input) {
    input.value = "Not set";
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
    input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);

    if (this._currentActionID) {
      this._editDone();
      await gZenKeyboardShortcutsManager.setShortcut(this._currentActionID, null, null);
    }
  },

  _editDone(shortcut, modifiers) {
    // Check if we have a valid key
    if (!shortcut || !modifiers) {
      return;
    }
    gZenKeyboardShortcutsManager.setShortcut(this._currentActionID, shortcut, modifiers);
    this._currentActionID = null;
  },

  //TODO Check for duplicates
  async _handleKeyDown(event) {
    if (!this._currentActionID || document.hidden) {
      return;
    }

    event.preventDefault();

    let input = document.querySelector(
      `.${ZEN_CKS_INPUT_FIELD_CLASS}[${KEYBIND_ATTRIBUTE_KEY}="${this._currentActionID}"]`
    );
    const modifiers = new nsKeyShortcutModifiers(
      event.ctrlKey,
      event.altKey,
      event.shiftKey,
      event.metaKey,
      false
    );
    const modifiersActive = modifiers.areAnyActive();

    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);

    // First, try to read the *physical* key via event.code.
    // If event.code is like "KeyS", "KeyA", ..., strip off "Key" → "S".
    // Otherwise, fall back to event.key (e.g. "F5", "Enter", etc.).
    let shortcut;
    if (event.code && event.code.startsWith("Key")) {
      shortcut = event.code.slice(3);
    } else if (event.code && event.code.startsWith("Digit")) {
      shortcut = event.code.slice(5);
    } else {
      // Use physical key mapping for common symbols
      const CODE_TO_KEY_MAP = {
        Comma: ",",
        Period: ".",
        Slash: "/",
        Semicolon: ";",
        Quote: "'",
        BracketLeft: "[",
        BracketRight: "]",
        Backslash: "\\",
        Backquote: "`",
        Minus: "-",
        Equal: "=",
      };
      shortcut = CODE_TO_KEY_MAP[event.code] || event.key;
    }

    shortcut = shortcut.replace(/Ctrl|Control|Shift|Alt|Option|Cmd|Meta/, ""); // Remove all modifiers

    if (shortcut == "Tab" && !modifiersActive) {
      input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);
      input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
      this._latestValidKey = null;
      this._currentActionID = null;
      return;
    } else if (shortcut == "Escape" && !modifiersActive) {
      const { hasConflicts, conflictShortcut } = gZenKeyboardShortcutsManager.checkForConflicts(
        this._latestValidKey ? this._latestValidKey : shortcut,
        this._latestModifier ? this._latestModifier : modifiers,
        this._currentActionID
      );

      if (!this._latestValidKey && !this._latestModifier) {
        // todo(lint): This is a bit weird, we need to remove this empty block
      } else if (!this._latestValidKey || hasConflicts) {
        if (!input.classList.contains(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`)) {
          input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
        }
        input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-unsafed`);

        if (hasConflicts) {
          const shortcutL10nKey =
            zenMissingKeyboardShortcutL10n[conflictShortcut.getID()] ??
            conflictShortcut.getL10NID();

          const [group, conflictName] = await document.l10n.formatValues([
            { id: `${ZEN_CKS_GROUP_PREFIX}-${conflictShortcut.getGroup()}` },
            { id: shortcutL10nKey },
          ]);

          if (!input.nextElementSibling) {
            input.after(
              window.MozXULElement.parseXULToFragment(`
                <label class="${ZEN_CKS_CLASS_BASE}-conflict" data-l10n-id="zen-key-conflict"></label>
              `)
            );
          }

          document.l10n.setAttributes(input.nextElementSibling, "zen-key-conflict", {
            group: group ?? "",
            shortcut: conflictName ?? shortcut ?? "",
          });
        }
      } else {
        input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);

        this._editDone(this._latestValidKey, this._latestModifier);
        if (this.name == "Not set") {
          input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);
        }
        this._latestValidKey = null;
        this._latestModifier = null;
        input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
        input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-valid`);
        setTimeout(() => {
          input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-valid`);
        }, 1000);
        const sibling = input.nextElementSibling;
        if (sibling && sibling.classList.contains(`${ZEN_CKS_CLASS_BASE}-conflict`)) {
          sibling.remove();
        }
      }
      this._hasSafed = true;
      input.blur();
      this._currentActionID = null;
      return;
    } else if (shortcut == "Backspace" && !modifiersActive) {
      this._resetShortcut(input);
      this._latestValidKey = null;
      this._latestModifier = null;
      this._hasSafed = true;
      const sibling = input.nextElementSibling;
      if (sibling && sibling.classList.contains(`${ZEN_CKS_CLASS_BASE}-conflict`)) {
        sibling.remove();
      }
      return;
    }

    this._latestModifier = modifiers;
    this._hasSafed = false;
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);
    input.value = modifiers.toDisplayString() + gZenKeyboardShortcutsManager.getKeyDisplay(shortcut);
    this._latestValidKey = shortcut;
  },
};

var gZenHomepageSettings = {
  init() {
    if (this.__hasInitialized) {
      return;
    }
    this.__hasInitialized = true;
    const { isValidHttpURL } = ChromeUtils.importESModule(
      "resource:///modules/zen/homepage/ZenHomepage.sys.mjs"
    );
    const row = document.getElementById("zenHomepageURLRow");
    const input = document.getElementById("zenHomepageURL");
    const warning = document.getElementById("zenHomepageURLInvalid");
    const mode = document.getElementById("zenHomepageMode");
    input.value = Services.prefs.getStringPref("zen.homepage.url", "");

    const syncRow = () => {
      row.hidden =
        Services.prefs.getStringPref("zen.homepage.mode", "builtin") !==
        "custom";
    };
    const observer = {
      observe() {
        syncRow();
      },
    };
    Services.prefs.addObserver("zen.homepage.mode", observer);
    mode.addEventListener("command", syncRow);
    mode.addEventListener("select", syncRow);
    window.addEventListener("unload", () => {
      Services.prefs.removeObserver("zen.homepage.mode", observer);
    });
    syncRow();

    const commitURL = () => {
      const value = input.value.trim();
      if (value && !isValidHttpURL(value)) {
        warning.hidden = false;
        return;
      }
      warning.hidden = true;
      input.value = value;
      Services.prefs.setStringPref("zen.homepage.url", value);
    };
    input.addEventListener("change", commitURL);
  },
};

var gZenUrlSnippetsSettings = {
  _manager: null,
  _queue: Promise.resolve(),

  init() {
    if (this.__hasInitialized) {
      return;
    }
    this.__hasInitialized = true;
    const { gZenUrlSnippets, normalizeSnippetShortcut, normalizeSnippetURL } =
      ChromeUtils.importESModule(
        "resource:///modules/zen/urlsnippets/ZenUrlSnippetsManager.sys.mjs"
      );
    this._manager = gZenUrlSnippets;
    this._normalizeShortcut = normalizeSnippetShortcut;
    this._normalizeURL = normalizeSnippetURL;
    document
      .getElementById("zenUrlSnippetsAdd")
      .addEventListener("command", () => this._addRow());
    this._manager.ready().then(() => this._render());
  },

  _enqueue(task) {
    this._queue = this._queue.then(task, task);
    return this._queue;
  },

  _render() {
    const list = document.getElementById("zenUrlSnippetsList");
    list.replaceChildren();
    for (const snippet of this._manager.getAll()) {
      list.appendChild(this._createRow(snippet));
    }
  },

  _addRow() {
    const list = document.getElementById("zenUrlSnippetsList");
    const row = this._createRow({ id: "", shortcut: "", url: "" });
    list.appendChild(row);
    row.querySelector(".zenUrlSnippetShortcut").focus();
  },

  _createRow(snippet) {
    const fragment = window.MozXULElement.parseXULToFragment(`
      <hbox class="zenUrlSnippetRow">
        <html:input class="zenUrlSnippetShortcut" type="text"/>
        <html:input class="zenUrlSnippetUrl" type="text"/>
        <button class="zenUrlSnippetRemove"/>
      </hbox>
    `);
    const row = fragment.querySelector(".zenUrlSnippetRow");
    const shortcutInput = row.querySelector(".zenUrlSnippetShortcut");
    const urlInput = row.querySelector(".zenUrlSnippetUrl");
    const removeButton = row.querySelector(".zenUrlSnippetRemove");
    row.dataset.id = snippet.id || "";
    shortcutInput.value = snippet.shortcut || "";
    urlInput.value = snippet.url || "";
    document.l10n.setAttributes(
      shortcutInput,
      "zen-url-snippets-shortcut-input"
    );
    document.l10n.setAttributes(urlInput, "zen-url-snippets-url-input");
    document.l10n.setAttributes(removeButton, "zen-url-snippets-remove");
    shortcutInput.addEventListener("change", () => this._commitRow(row));
    urlInput.addEventListener("change", () => this._commitRow(row));
    removeButton.addEventListener("command", () => this._removeRow(row));
    return row;
  },

  _commitRow(row) {
    return this._enqueue(() => this._commitRowNow(row));
  },

  async _commitRowNow(row) {
    if (!row.isConnected) {
      return;
    }
    const shortcutInput = row.querySelector(".zenUrlSnippetShortcut");
    const urlInput = row.querySelector(".zenUrlSnippetUrl");
    const shortcut = this._normalizeShortcut(shortcutInput.value);
    const url = this._normalizeURL(urlInput.value);
    const duplicate =
      shortcut && this._manager.isShortcutTaken(shortcut, row.dataset.id || "");
    shortcutInput.classList.toggle(
      "zenUrlSnippetInvalid",
      !shortcut || duplicate
    );
    urlInput.classList.toggle("zenUrlSnippetInvalid", !url);
    if (!shortcut || !url || duplicate) {
      return;
    }
    shortcutInput.value = shortcut;
    urlInput.value = url;
    if (!row.dataset.id) {
      const created = await this._manager.create(shortcut, url);
      if (row.isConnected) {
        row.dataset.id = created.id;
      } else {
        await this._manager.remove(created.id);
      }
      return;
    }
    await this._manager.update({
      id: row.dataset.id,
      shortcut,
      url,
    });
  },

  _removeRow(row) {
    return this._enqueue(async () => {
      if (row.dataset.id) {
        await this._manager.remove(row.dataset.id);
      }
      row.remove();
    });
  },
};

var gZenAdblockSettings = {
  init() {
    const { gZenAdblock } = ChromeUtils.importESModule(
      "resource:///modules/zen/adblock/ZenAdblockManager.sys.mjs"
    );
    const note = document.getElementById("zenAdblockUboNote");
    if (note) {
      note.hidden = !gZenAdblock.isUblockActive();
    }
    const custom = document.getElementById("zenAdblockCustomRules");
    if (custom) {
      custom.value = gZenAdblock.getCustomRules();
    }
    document.getElementById("zenAdblockSaveCustom")?.addEventListener("command", () => {
      gZenAdblock.setCustomRules(custom.value);
    });
    document.getElementById("zenAdblockUpdateLists")?.addEventListener("command", () => {
      gZenAdblock.updateListsNow();
    });
  },
};

Preferences.addAll([
  {
    id: "zen.view.compact.toolbar-flash-popup",
    type: "bool",
    default: true,
  },
  {
    id: "zen.workspaces.hide-default-container-indicator",
    type: "bool",
    default: true,
  },
  {
    id: "zen.tab-unloader.timeout-minutes",
    type: "int",
    default: 10,
  },
  {
    id: "zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url",
    type: "bool",
    default: true,
  },
  {
    id: "zen.pinned-tab-manager.close-shortcut-behavior",
    type: "string",
    default: "switch",
  },
  {
    id: "zen.workspaces.force-container-workspace",
    type: "bool",
    default: true,
  },
  {
    id: "zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed",
    type: "bool",
    default: true,
  },
  {
    id: "zen.glance.activation-method",
    type: "string",
    default: "ctrl",
  },
  {
    id: "zen.glance.enabled",
    type: "bool",
    default: true,
  },
  {
    id: "zen.view.drag-window-from-content",
    type: "bool",
    default: true,
  },
  {
    id: "zen.urlbar.behavior",
    type: "string",
    default: "float",
  },
  {
    id: "zen.library.default-section",
    type: "string",
    default: "downloads",
  },
  {
    id: "zen.workspaces.separate-essentials",
    type: "bool",
    default: false,
  },
  {
    id: "zen.tabs.show-newtab-vertical",
    type: "bool",
    default: true,
  },
  {
    id: "zen.view.show-newtab-button-top",
    type: "bool",
    default: true,
  },
  {
    id: "media.videocontrols.picture-in-picture.enabled",
    type: "bool",
    default: true,
  },
  {
    id: "zen.workspaces.continue-where-left-off",
    type: "bool",
    default: true,
  },
  {
    id: "zen.tabs.ctrl-tab.ignore-essential-tabs",
    type: "bool",
    default: false,
  },
  {
    id: "zen.tabs.ctrl-tab.ignore-pending-tabs",
    type: "bool",
    default: false,
  },
  {
    id: "zen.tabs.close-on-back-with-no-history",
    type: "bool",
    default: false,
  },
  {
    id: "zen.tabs.select-recently-used-on-close",
    type: "bool",
    default: true,
  },
  {
    id: "zen.window-sync.sync-only-pinned-tabs",
    type: "bool",
    default: false,
  },
  {
    id: "zen.adblock.enabled",
    type: "bool",
    default: true,
  },
  {
    id: "zen.adblock.level",
    type: "string",
    default: "medium",
  },
  {
    id: "zen.cookie-consent.enabled",
    type: "bool",
    default: true,
  },
  {
    id: "zen.homepage.mode",
    type: "string",
    default: "builtin",
  },
  {
    id: "zen.homepage.url",
    type: "string",
    default: "",
  },
  {
    id: "zen.homepage.cards.time-spent",
    type: "bool",
    default: true,
  },
  {
    id: "zen.homepage.cards.top-site",
    type: "bool",
    default: true,
  },
  {
    id: "zen.homepage.cards.network-speed",
    type: "bool",
    default: true,
  },
  {
    id: "zen.homepage.cards.downloads",
    type: "bool",
    default: true,
  },
  {
    id: "zen.homepage.cards.visited-sites",
    type: "bool",
    default: true,
  },
  {
    id: "zen.homepage.cards.version",
    type: "bool",
    default: true,
  },
  {
    id: "zen.homepage.cards.clock",
    type: "bool",
    default: true,
  },
  {
    id: "zen.notepad.autocomplete-key",
    type: "string",
    default: "Tab",
  },
]);

Preferences.addSetting({
  id: "zenWorkspaceContinueWhereLeftOff",
  pref: "zen.workspaces.continue-where-left-off",
});
