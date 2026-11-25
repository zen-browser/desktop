/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  ZenKeyboardShortcuts:
    "resource:///modules/zen/kbs/ZenKeyboardShortcuts.sys.mjs",
  gZenSpaceRoutingManager:
    "resource:///modules/zen/spacerouting/ZenSpaceRoutingManager.sys.mjs",
});

const kLittleWindowCommand = "cmd_zenNewLittleWindow";
const kLittleWindowRoute = "little-window";
const kMostRecentSpaceRoute = "most-recent-space";
const kTriggerOff = "none";
const kTriggers = [
  {
    id: "zen-settings-glance-trigger",
    l10nId: "zen-settings-window-glance-trigger",
    pref: "zen.glance.activation-method",
    fallback: "shift",
  },
  {
    id: "zen-settings-little-trigger",
    l10nId: "zen-settings-window-little-trigger",
    pref: "zen.little-window.link-activation-method",
    fallback: "accel+alt",
  },
];
const kIsMac = Services.appinfo.OS == "Darwin";
const kAccel = kIsMac ? "meta" : "ctrl";
const kModifierNames = kIsMac
  ? { ctrl: "⌃", alt: "⌥", shift: "⇧", meta: "⌘" }
  : { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "Meta" };

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
    for (const trigger of kTriggers) {
      this.#initTrigger(trigger);
    }
  }

  static triggerDisplay(value) {
    const keys = value
      .split("+")
      .map(key => key.trim().toLowerCase())
      .map(key => (key == "accel" ? kAccel : key));
    if (keys.some(key => !(key in kModifierNames))) {
      return null;
    }
    if (keys.length == 1 && keys[0] == "shift") {
      return "Shift";
    }
    return Object.keys(kModifierNames)
      .filter(key => keys.includes(key))
      .map(key => kModifierNames[key])
      .join(kIsMac ? "" : "+");
  }

  #initTrigger({ id, l10nId, pref, fallback }) {
    const toggle = document.getElementById(id);
    const label = document.getElementById(`${id}-label`);
    this.settings.watchPrefs([pref], () => {
      const shortcut = ZenSettingsLinks.triggerDisplay(
        Services.prefs.getStringPref(pref, kTriggerOff)
      );
      toggle.pressed = !!shortcut;
      toggle.disabled = Services.prefs.prefIsLocked(pref);
      document.l10n.setAttributes(label, l10nId, {
        shortcut: shortcut ?? ZenSettingsLinks.triggerDisplay(fallback),
      });
    });
    toggle.addEventListener("toggle", () => {
      Services.prefs.setStringPref(
        pref,
        toggle.pressed ? fallback : kTriggerOff
      );
    });
  }

  #updateLinks() {
    document.getElementById("zen-settings-little-external-links").pressed =
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
