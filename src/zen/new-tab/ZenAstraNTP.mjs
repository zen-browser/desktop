/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Selectable New Tab layout controller.
 *
 * Default ("minimal") leaves Zen's URL-bar new-tab and Firefox about:newtab
 * untouched. "search-hub" points AboutNewTab.newTabURL at a packaged chrome
 * page — not an Activity Stream section toggle (Discovery Stream / tippytop
 * stay disabled).
 */

export const LAYOUT_PREF = "astra.newtab.layout";
export const LAYOUT_MINIMAL = "minimal";
export const LAYOUT_SEARCH_HUB = "search-hub";

export const SEARCH_HUB_URL =
  "chrome://browser/content/zen-newtab/astra-search-hub.html";

const ABOUT_NEWTAB = "about:newtab";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  AboutNewTab: "resource:///modules/AboutNewTab.sys.mjs",
});

function normalizeLayout(value) {
  return value === LAYOUT_SEARCH_HUB ? LAYOUT_SEARCH_HUB : LAYOUT_MINIMAL;
}

export const ZenAstraNTP = {
  _observing: false,

  get SEARCH_HUB_URL() {
    return SEARCH_HUB_URL;
  },

  getLayout() {
    try {
      return normalizeLayout(
        Services.prefs.getStringPref(LAYOUT_PREF, LAYOUT_MINIMAL)
      );
    } catch {
      return LAYOUT_MINIMAL;
    }
  },

  isSearchHub() {
    return this.getLayout() === LAYOUT_SEARCH_HUB;
  },

  init() {
    this.apply();
    if (!this._observing) {
      Services.prefs.addObserver(LAYOUT_PREF, this);
      this._observing = true;
    }
  },

  observe(_subject, topic, data) {
    if (topic === "nsPref:changed" && data === LAYOUT_PREF) {
      this.apply();
    }
  },

  apply() {
    try {
      if (this.isSearchHub()) {
        if (lazy.AboutNewTab.newTabURL !== SEARCH_HUB_URL) {
          lazy.AboutNewTab.newTabURL = SEARCH_HUB_URL;
        }
        return;
      }
      this.#restoreDefaultNewTab();
    } catch (e) {
      console.error("[Astra] NTP layout apply failed:", e);
    }
  },

  #restoreDefaultNewTab() {
    try {
      if (typeof lazy.AboutNewTab.resetNewTabURL === "function") {
        if (lazy.AboutNewTab.overridden) {
          lazy.AboutNewTab.resetNewTabURL();
        }
        return;
      }
    } catch (e) {
      console.warn("[Astra] resetNewTabURL failed:", e);
    }
    try {
      if (lazy.AboutNewTab.newTabURL !== ABOUT_NEWTAB) {
        lazy.AboutNewTab.newTabURL = ABOUT_NEWTAB;
      }
    } catch (e) {
      console.error("[Astra] NTP restore failed:", e);
    }
  },
};

ZenAstraNTP.init();
