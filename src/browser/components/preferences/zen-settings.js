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
    manageButton.hidden = !Services.prefs.getBoolPref(
      "zen.library.enabled",
      true
    );
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
    const areModsDisabled = Services.prefs.getBoolPref(
      "zen.themes.disable-all",
      false
    );
    const mozToggle = document.createElement("moz-toggle");

    mozToggle.className = "zenThemeMarketplaceDisableAllToggle";
    mozToggle.pressed = !areModsDisabled;

    document.l10n.setAttributes(
      mozToggle,
      `zen-theme-disable-all-${!areModsDisabled ? "enabled" : "disabled"}`
    );

    mozToggle.addEventListener("toggle", event => {
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
    const library =
      window.browsingContext.topChromeWindow.document.querySelector(
        "zen-library"
      );
    const Library = library?.constructor;

    // Toggling the tab that is already open would close the library.
    if (Library && !(Library.isLibraryOpen && library.activeTab === "mods")) {
      Library.toggle("mods");
    }
  },
};

Preferences.addAll([
  {
    id: "zen.mods.auto-update",
    type: "bool",
    default: true,
  },
]);
