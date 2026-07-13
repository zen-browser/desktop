// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const PREF_ENABLED = "astra.theme.transparent.enabled";
const ATTR_MODE = "astra-transparent-mode";
const LEGACY_CLASS = "astra-transparent-enabled";

/** Session-scoped: at most one OS-transparency guidance prompt. */
let gOsTransparencyPromptedThisSession = false;

/**
 * Per-window manager for Astra built-in Transparent Mode.
 *
 * Source of truth: astra.theme.transparent.enabled
 * Visible state: documentElement[astra-transparent-mode="true"]
 *
 * Lifecycle (exactly once per browser window):
 * 1. Construct — apply attribute immediately (prefs are already available).
 * 2. MozBeforeInitialXULLayout — init(): register one pref observer + unload.
 * 3. Optional reapply() — attribute only; never registers another observer.
 * 4. unload — remove observer.
 */
class AstraTransparencyManager {
  #prefObserver = null;
  #initialized = false;

  constructor() {
    // Apply before first paint whenever possible to avoid opaque→glass flicker.
    this.#applyFromPref();

    document.addEventListener(
      "MozBeforeInitialXULLayout",
      () => this.init(),
      { once: true }
    );
  }

  /**
   * Register observers once. Safe to call again — subsequent calls only reapply.
   */
  init() {
    if (this.#initialized) {
      this.#applyFromPref();
      return;
    }
    this.#initialized = true;

    this.#applyFromPref();
    this.#prefObserver = this.#onPrefChanged.bind(this);
    Services.prefs.addObserver(PREF_ENABLED, this.#prefObserver);
    window.addEventListener("unload", () => this.uninit(), { once: true });
  }

  /** Attribute-only refresh. Does not touch observers. */
  reapply() {
    this.#applyFromPref();
  }

  uninit() {
    if (this.#prefObserver) {
      try {
        Services.prefs.removeObserver(PREF_ENABLED, this.#prefObserver);
      } catch (e) {
        // Observer may already be gone during tear-down.
      }
      this.#prefObserver = null;
    }
    this.#initialized = false;
  }

  get enabled() {
    return Services.prefs.getBoolPref(PREF_ENABLED, false);
  }

  /**
   * @param {boolean} value
   * @param {{ promptOs?: boolean }} [options]
   */
  setEnabled(value, { promptOs = false } = {}) {
    const next = !!value;
    if (this.enabled === next) {
      this.#applyFromPref();
      if (next && promptOs) {
        this.#maybePromptWindowsTransparency();
      }
      return;
    }
    Services.prefs.setBoolPref(PREF_ENABLED, next);
    // Prefer observers in every window for attribute sync; apply locally too
    // so this window updates even if the observer is not yet registered.
    this.#applyFromPref();
    this.syncThemePickerButton();
    if (next && promptOs) {
      this.#maybePromptWindowsTransparency();
    }
  }

  toggleFromUI() {
    this.setEnabled(!this.enabled, { promptOs: true });
    this.syncThemePickerButton();
  }

  /** Public entry for Settings after enabling via preference= binding. */
  promptOsTransparencyIfNeeded() {
    if (this.enabled) {
      this.#maybePromptWindowsTransparency();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  #onPrefChanged() {
    this.#applyFromPref();
    this.syncThemePickerButton();
  }

  #applyFromPref() {
    const root = document.documentElement;
    if (!root) {
      return;
    }
    root.classList.remove(LEGACY_CLASS);

    if (this.enabled) {
      root.setAttribute(ATTR_MODE, "true");
    } else {
      root.removeAttribute(ATTR_MODE);
    }
  }

  syncThemePickerButton() {
    const btn = document.getElementById("zen-theme-picker-transparent-btn");
    if (!btn) {
      return;
    }
    const on = this.enabled;
    const l10nId = on
      ? "astra-theme-transparent-on"
      : "astra-theme-transparent-off";
    if (document.l10n) {
      document.l10n.setAttributes(btn, l10nId);
    } else {
      btn.setAttribute("label", on ? "ON" : "OFF");
    }
    btn.setAttribute("astra-transparent-active", on ? "true" : "false");
  }

  #isWindowsTransparencyEnabled() {
    if (AppConstants.platform !== "win") {
      return true;
    }
    try {
      const regKey = Cc["@mozilla.org/windows-registry-key;1"].createInstance(
        Ci.nsIWindowsRegKey
      );
      regKey.open(
        Ci.nsIWindowsRegKey.ROOT_KEY_CURRENT_USER,
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
        Ci.nsIWindowsRegKey.ACCESS_READ
      );
      const enabled =
        !regKey.hasValue("EnableTransparency") ||
        regKey.readIntValue("EnableTransparency") !== 0;
      regKey.close();
      return enabled;
    } catch (e) {
      console.warn(
        "[AstraTransparency]: Could not read Windows transparency setting",
        e
      );
      // Prefer not prompting when the API is unavailable/denied.
      return true;
    }
  }

  #maybePromptWindowsTransparency() {
    if (AppConstants.platform !== "win") {
      return;
    }
    if (gOsTransparencyPromptedThisSession) {
      return;
    }
    if (this.#isWindowsTransparencyEnabled()) {
      return;
    }
    gOsTransparencyPromptedThisSession = true;

    try {
      const { default: createSidebarNotification } = ChromeUtils.importESModule(
        "chrome://browser/content/zen-components/ZenSidebarNotification.mjs"
      );
      createSidebarNotification({
        headingL10nId: "zen-transparency-os-disabled-heading",
        links: [
          {
            action: () => {
              try {
                const writeKey = Cc[
                  "@mozilla.org/windows-registry-key;1"
                ].createInstance(Ci.nsIWindowsRegKey);
                writeKey.open(
                  Ci.nsIWindowsRegKey.ROOT_KEY_CURRENT_USER,
                  "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
                  Ci.nsIWindowsRegKey.ACCESS_WRITE
                );
                writeKey.writeIntValue("EnableTransparency", 1);
                writeKey.close();
                createSidebarNotification({
                  headingL10nId: "zen-transparency-enabled-heading",
                  links: [
                    {
                      action: () => {
                        Services.startup.quit(
                          Services.startup.eAttemptQuit |
                            Services.startup.eRestart
                        );
                      },
                      l10nId: "zen-transparency-restart-action",
                      special: true,
                    },
                  ],
                });
              } catch (e) {
                console.error(
                  "[AstraTransparency]: Failed to enable Windows transparency",
                  e
                );
              }
            },
            l10nId: "zen-transparency-os-disabled-action",
            special: true,
          },
        ],
      });
    } catch (e) {
      console.warn(
        "[AstraTransparency]: Could not show Windows transparency guidance",
        e
      );
    }
  }
}

window.gAstraTransparency = new AstraTransparencyManager();
