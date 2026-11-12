// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenPreloadedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const { gZenModsManager, ZEN_MODS_UPDATE_TOPIC } = ChromeUtils.importESModule(
  "resource:///modules/zen/mods/ZenModsManager.sys.mjs"
);

const DOT_RE = /\./g;

const APPLIED_TYPES = new Set(["string", "color", "number", "dropdown"]);

/**
 * Applies the enabled mods to this window. `ZenModsManager` builds the
 * stylesheet for every window; what's left here needs this document:
 * `string`, `color` and `number` preferences become custom properties on the
 * root, `dropdown` preferences become attributes of a hidden element that
 * older mods select with `:has()`, and mod scripts start and stop for this
 * window.
 *
 * @augments nsZenPreloadedFeature
 */
class nsZenMods extends nsZenPreloadedFeature {
  /** @type {Map<string, {type: string, sanitizedName: string}>} */
  #watchedPrefs = new Map();

  /** @type {Set<string>} Custom properties this window set */
  #customProperties = new Set();

  /** @type {Set<string>} Ids of the hidden elements this window added */
  #dropdownElements = new Set();

  async init() {
    Services.obs.addObserver(this, ZEN_MODS_UPDATE_TOPIC);
    window.addEventListener(
      "unload",
      () => {
        Services.obs.removeObserver(this, ZEN_MODS_UPDATE_TOPIC);
        this.#unwatchPrefs();
        gZenModsManager.forgetWindow(window);
      },
      { once: true }
    );

    try {
      await SessionStore.promiseInitialized;
      await gZenModsManager.init();

      this.#apply();

      gZenModsManager.scheduleAutoUpdate();
    } catch (error) {
      console.error("[ZenMods]: Error loading Zen Mods:", error);
    }
  }

  observe(subject, topic, data) {
    switch (topic) {
      case ZEN_MODS_UPDATE_TOPIC: {
        this.#apply();
        break;
      }

      case "nsPref:changed": {
        const watched = this.#watchedPrefs.get(data);

        if (watched) {
          this.#applyPreference(data, watched);
        }
        break;
      }
    }
  }

  #apply() {
    const root = document.documentElement;
    const previousProperties = this.#customProperties;
    const previousElements = this.#dropdownElements;

    this.#unwatchPrefs();
    this.#customProperties = new Set();
    this.#dropdownElements = new Set();

    for (const { sanitizedName, preferences } of gZenModsManager.appliedMods) {
      for (const { property, type } of preferences) {
        if (!APPLIED_TYPES.has(type)) {
          continue;
        }

        const watched = { type, sanitizedName };

        this.#watchedPrefs.set(property, watched);
        Services.prefs.addObserver(property, this);
        this.#applyPreference(property, watched);
      }
    }

    for (const customProperty of previousProperties) {
      if (!this.#customProperties.has(customProperty)) {
        root.style.removeProperty(customProperty);
      }
    }

    for (const id of previousElements) {
      if (!this.#dropdownElements.has(id)) {
        document.getElementById(id)?.remove();
      }
    }

    gZenModsManager.syncScripts(window);
  }

  #applyPreference(property, { type, sanitizedName }) {
    const sanitizedProperty = property.replaceAll(DOT_RE, "-");
    const value = Services.prefs.getStringPref(property, "");

    switch (type) {
      case "string":
      case "color":
      case "number": {
        const customProperty = `--${sanitizedProperty}`;

        this.#customProperties.add(customProperty);

        if (value === "") {
          document.documentElement.style.removeProperty(customProperty);
        } else {
          document.documentElement.style.setProperty(customProperty, value);
        }
        break;
      }

      case "dropdown": {
        let element = document.getElementById(sanitizedName);

        if (!element) {
          element = document.createElement("div");
          element.style.display = "none";
          element.id = sanitizedName;

          document.body.appendChild(element);
        }

        this.#dropdownElements.add(sanitizedName);

        if (value === "") {
          element.removeAttribute(sanitizedProperty);
        } else {
          element.setAttribute(sanitizedProperty, value);
        }
        break;
      }
    }
  }

  #unwatchPrefs() {
    for (const property of this.#watchedPrefs.keys()) {
      Services.prefs.removeObserver(property, this);
    }

    this.#watchedPrefs.clear();
  }
}

window.gZenMods = new nsZenMods();
