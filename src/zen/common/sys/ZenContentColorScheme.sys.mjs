// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Mirrors Astra's window scheme (zen.view.window.scheme: 0 dark, 1 light,
// 2 auto) into Gecko's content override
// (layout.css.prefers-color-scheme.content-override: 0 dark, 1 light,
// 2 auto) so websites' prefers-color-scheme media query follows the in-app
// Light/Dark toggle instead of only the OS theme. Both prefs share the same
// value mapping (see StaticPrefList.yaml), so the value is copied verbatim.

const kWindowSchemePref = "zen.view.window.scheme";
const kContentOverridePref = "layout.css.prefers-color-scheme.content-override";

export const gZenContentColorScheme = {
  _initialized: false,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    Services.prefs.addObserver(kWindowSchemePref, this);
    this._sync();
  },

  observe(_subject, topic, data) {
    if (topic === "nsPref:changed" && data === kWindowSchemePref) {
      this._sync();
    }
  },

  _sync() {
    const scheme = Services.prefs.getIntPref(kWindowSchemePref, 2);
    // Anything unexpected falls back to 2 (auto), the Gecko default.
    const value = scheme === 0 || scheme === 1 ? scheme : 2;
    if (Services.prefs.getIntPref(kContentOverridePref, 2) !== value) {
      Services.prefs.setIntPref(kContentOverridePref, value);
    }
  },
};
