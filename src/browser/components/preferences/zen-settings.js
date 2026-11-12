/* eslint-disable no-undef */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var gZenMarketplaceManager = {
  init() {
    const header = document.getElementById("zenMarketplaceHeader");
    const manageButton = document.getElementById("zenModsManageInLibrary");

    if (!header || !manageButton) {
      return; // We haven't entered the settings page yet.
    }

    if (this.__hasInitializedEvents) {
      return;
    }

    this.__hasInitializedEvents = true;

    header.appendChild(this._initDisableAll());

    // Installed mods are managed in the Library; without it there is no
    // place to send the user to.
    manageButton.hidden = !Services.prefs.getBoolPref("zen.library.enabled", true);
    manageButton.addEventListener("command", () => this._openModsInLibrary());

    window.addEventListener(
      "unload",
      () => {
        this.__hasInitializedEvents = false;
      },
      { once: true }
    );
  },

  _initDisableAll() {
    const areModsDisabled = Services.prefs.getBoolPref("zen.themes.disable-all", false);
    const mozToggle = document.createElement("moz-toggle");

    mozToggle.className = "zenThemeMarketplaceDisableAllToggle";
    mozToggle.pressed = !areModsDisabled;

    document.l10n.setAttributes(
      mozToggle,
      `zen-theme-disable-all-${!areModsDisabled ? "enabled" : "disabled"}`
    );

    mozToggle.addEventListener("toggle", (event) => {
      const { pressed = false } = event.target || {};

      Services.prefs.setBoolPref("zen.themes.disable-all", !pressed);
      document.l10n.setAttributes(
        mozToggle,
        `zen-theme-disable-all-${pressed ? "enabled" : "disabled"}`
      );
    });

    return mozToggle;
  },

  _openModsInLibrary() {
    const library = window.browsingContext.topChromeWindow.document.querySelector("zen-library");
    const Library = library?.constructor;

    // Toggling the tab that is already open would close the library.
    if (Library && !(Library.isLibraryOpen && library.activeTab === "mods")) {
      Library.toggle("mods");
    }
  },
};

const kZenExtendedSidebar = "zen.view.sidebar-expanded";
const kZenSingleToolbar = "zen.view.use-single-toolbar";

var gZenLooksAndFeel = {
  init() {
    if (this.__hasInitialized) {
      return;
    }
    this.__hasInitialized = true;
    gZenMarketplaceManager.init();
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

var gZenWorkspacesSettings = {
  init() {
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
    default: false,
  },
  {
    id: "zen.mods.auto-update",
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
]);

Preferences.addSetting({
  id: "zenWorkspaceContinueWhereLeftOff",
  pref: "zen.workspaces.continue-where-left-off",
});
