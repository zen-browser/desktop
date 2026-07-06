/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["CustomizationManager"];

const { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  Services: "resource://gre/modules/Services.sys.mjs",
  CustomizableUI: "resource:///modules/CustomizableUI.sys.mjs",
});

/**
 * CustomizationManager — Power user customization system
 *
 * Manages advanced customization features:
 *  - CSS Live Editing (in-browser)
 *  - Layout Presets
 *  - User Scripts
 *  - Keyboard Shortcut Mapper
 *  - Per-site Overrides
 */
var CustomizationManager = {
  _initialized: false,

  /** Nixo UI mode presets */
  LAYOUT_PRESETS: {
    classic: {
      sidebar: "expanded",
      toolbar: "single",
      tabs: "vertical",
      compact: false,
    },
    compact: {
      sidebar: "collapsed",
      toolbar: "single",
      tabs: "vertical",
      compact: true,
    },
    minimal: {
      sidebar: "hidden",
      toolbar: "floating",
      tabs: "vertical",
      compact: true,
    },
    traditional: {
      sidebar: "hidden",
      toolbar: "double",
      tabs: "horizontal",
      compact: false,
    },
  },

  /**
   * Initialize the customization manager.
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this._registerCommands();
    Cu.reportError("[Nixo] CustomizationManager initialized");
  },

  /**
   * Register keyboard shortcuts for customization features.
   */
  _registerCommands() {
    // Layout preset shortcuts
    const shortcuts = [
      { key: "nixo-cmd-toggle-sidebar", command: "cmd_toggleSidebar" },
      { key: "nixo-cmd-toggle-compact", command: "cmd_toggleCompactMode" },
      { key: "nixo-cmd-open-css-editor", command: "cmd_openCSSEditor" },
      { key: "nixo-cmd-toggle-mod-panel", command: "cmd_toggleModPanel" },
    ];

    for (const { key, command } of shortcuts) {
      Services.obs.addObserver(this, key);
    }
  },

  /**
   * Apply a layout preset.
   * @param {string} presetName - One of the LAYOUT_PRESETS keys
   */
  applyLayoutPreset(presetName) {
    const preset = this.LAYOUT_PRESETS[presetName];
    if (!preset) {
      Cu.reportError("[Nixo] Unknown layout preset: " + presetName);
      return;
    }

    Services.prefs.setBoolPref("zen.view.sidebar-expanded", preset.sidebar === "expanded");
    Services.prefs.setBoolPref("zen.view.use-single-toolbar", preset.toolbar === "single");
    Services.prefs.setBoolPref("zen.view.compact-mode", preset.compact);
    Services.prefs.setBoolPref("zen.tabs.vertical", preset.tabs === "vertical");

    Cu.reportError("[Nixo] Applied layout preset: " + presetName);
  },

  /**
   * Apply custom CSS to the browser chrome.
   * Stores CSS in a preference and applies it via a style element.
   * @param {string} css - CSS string to inject
   * @param {string} scope - "global" (full browser) or "tab" (per-page)
   */
  applyCustomCSS(css, scope = "global") {
    const prefKey = scope === "global"
      ? "nixo.customization.css.global"
      : "nixo.customization.css.tab";
    Services.prefs.setStringPref(prefKey, css);

    // Find or create the style element
    let styleEl = document?.getElementById("nixo-custom-css");
    if (!styleEl && typeof document !== "undefined") {
      styleEl = document.createElement("style");
      styleEl.id = "nixo-custom-css";
      document.documentElement.appendChild(styleEl);
    }
    if (styleEl) {
      styleEl.textContent = css;
    }
  },

  /**
   * Save and restore window layouts.
   * @param {string} name - Name of the layout to save
   */
  saveWindowLayout(name) {
    const layout = {
      sidebarWidth: Services.prefs.getIntPref("zen.view.sidebar-expanded.max-width"),
      sidebarExpanded: Services.prefs.getBoolPref("zen.view.sidebar-expanded"),
      singleToolbar: Services.prefs.getBoolPref("zen.view.use-single-toolbar"),
      compactMode: Services.prefs.getBoolPref("zen.view.compact-mode"),
      rightSide: Services.prefs.getBoolPref("zen.view.sidebar-right"),
    };

    const layouts = JSON.parse(
      Services.prefs.getStringPref("nixo.customization.layouts", "[]")
    );
    layouts.push({ name, layout, timestamp: Date.now() });
    Services.prefs.setStringPref(
      "nixo.customization.layouts",
      JSON.stringify(layouts)
    );

    Cu.reportError("[Nixo] Saved layout: " + name);
  },

  /**
   * Restore a saved window layout.
   */
  restoreWindowLayout(name) {
    const layouts = JSON.parse(
      Services.prefs.getStringPref("nixo.customization.layouts", "[]")
    );
    const entry = layouts.find((l) => l.name === name);
    if (!entry) return false;

    const { layout } = entry;
    Services.prefs.setIntPref("zen.view.sidebar-expanded.max-width", layout.sidebarWidth);
    Services.prefs.setBoolPref("zen.view.sidebar-expanded", layout.sidebarExpanded);
    Services.prefs.setBoolPref("zen.view.use-single-toolbar", layout.singleToolbar);
    Services.prefs.setBoolPref("zen.view.compact-mode", layout.compactMode);
    Services.prefs.setBoolPref("zen.view.sidebar-right", layout.rightSide);
    return true;
  },

  /**
   * Get the list of available mods from the mods manager.
   */
  async getAvailableMods() {
    try {
      const { ZenModsManager } = ChromeUtils.importESModule(
        "resource:///modules/ZenModsManager.sys.mjs"
      );
      return await ZenModsManager.getAvailableMods();
    } catch (e) {
      Cu.reportError("[Nixo] Failed to load mods: " + e);
      return [];
    }
  },

  observe(subject, topic, data) {
    switch (topic) {
      case "nixo-cmd-toggle-sidebar":
        Services.prefs.setBoolPref(
          "zen.view.sidebar-expanded",
          !Services.prefs.getBoolPref("zen.view.sidebar-expanded")
        );
        break;
      case "nixo-cmd-toggle-compact":
        Services.prefs.setBoolPref(
          "zen.view.compact-mode",
          !Services.prefs.getBoolPref("zen.view.compact-mode")
        );
        break;
      case "nixo-cmd-open-css-editor":
        // Open the CSS editor in a new tab
        const { gBrowser } = window;
        gBrowser?.selectedTab?.linkedBrowser?.sendMessageToActor(
          "Nixo:OpenCSSEditor",
          {},
          "NixoCSSEditor"
        );
        break;
    }
  },
};
