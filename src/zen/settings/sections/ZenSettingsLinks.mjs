/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  ZenKeyboardShortcuts:
    "resource:///modules/zen/kbs/ZenKeyboardShortcuts.sys.mjs",
  ZenLittleWindow:
    "resource:///modules/zen/littlewindow/ZenLittleWindow.sys.mjs",
  gZenSpaceRoutingManager:
    "resource:///modules/zen/spacerouting/ZenSpaceRoutingManager.sys.mjs",
});

const kLittleWindowPref = "zen.little-window.enabled";
const kLittleWindowCommand = "cmd_zenNewLittleWindow";
const kLittleWindowRoute = "little-window";
const kMostRecentSpaceRoute = "most-recent-space";

export class ZenSettingsLinks {
  constructor(settings) {
    this.settings = settings;
    this.#initLinks();
  }

  get actions() {
    return {
      "open-space-routing": () => this.#openSpaceRouting(),
    };
  }

  onPaneShown(pane) {
    if (pane == "links") {
      this.#updateLinks();
    }
  }

  #initLinks() {
    const externalLinks = document.getElementById(
      "zen-settings-little-external-links"
    );
    externalLinks.addEventListener("toggle", () => {
      const manager = lazy.gZenSpaceRoutingManager;
      manager.setDefaultExternalRoute(
        externalLinks.pressed ? kLittleWindowRoute : kMostRecentSpaceRoute
      );
      manager.saveRoutes();
    });
    this.settings.watchPrefs([kLittleWindowPref], () => this.#updateLinks());
  }

  #updateLinks() {
    document.getElementById("zen-settings-little-external-links").pressed =
      lazy.ZenLittleWindow.enabled &&
      lazy.gZenSpaceRoutingManager.getDefaultExternalRoute() ==
        kLittleWindowRoute;

    const label = document.getElementById("zen-settings-little-shortcut-label");
    if (!label) {
      return;
    }
    const win = lazy.BrowserWindowTracker.getTopWindow();
    const shortcut = win
      ? lazy.ZenKeyboardShortcuts.getShortcutDisplayFromCommand(
          win,
          kLittleWindowCommand
        )
      : null;
    if (shortcut) {
      document.l10n.setAttributes(
        label,
        "zen-settings-window-little-global-shortcut-key",
        { shortcut }
      );
    } else {
      document.l10n.setAttributes(
        label,
        "zen-settings-window-little-global-shortcut"
      );
    }
  }

  #openSpaceRouting() {
    const win = lazy.BrowserWindowTracker.getTopWindow();
    if (!win) {
      return;
    }
    win.focus();
    lazy.gZenSpaceRoutingManager.openSpaceRoutingSettings(win);
  }
}
