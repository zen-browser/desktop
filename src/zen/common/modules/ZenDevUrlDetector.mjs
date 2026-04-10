// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * ZenDevUrlDetector
 *
 * Detects when the active tab is on a local/development URL (localhost,
 * 127.0.0.1, *.local, file://, etc.) and toggles the `zen-dev-url` attribute
 * on the document element so CSS can style the browser chrome accordingly.
 *
 * Controlled by the "zen.urlbar.show-dev-indicator" preference (default: true).
 *
 * Inspiration: Arc Browser's DEV URL mode.
 */

const ZenDevUrlDetector = {
  PREF: "zen.urlbar.show-dev-indicator",

  // Exact hostnames that are always considered dev
  _devHosts: new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]),

  // TLD suffixes that are always considered dev
  _devTLDs: [".local", ".localhost", ".internal", ".test"],

  get _enabled() {
    return Services.prefs.getBoolPref(this.PREF, true);
  },

  init() {
    // addTabsProgressListener fires for all tabs (active and background).
    // onLocationChange will only update the UI when the changed tab is
    // the currently selected one (isTopLevel + browser identity check).
    gBrowser.addTabsProgressListener(this._progressListener);

    // Detect switching between tabs — re-evaluate current URI
    window.addEventListener("TabSelect", this);

    // React to the pref being toggled at runtime
    Services.prefs.addObserver(this.PREF, this);

    // Run once on startup to set initial state
    this._update();
  },

  observe(_subject, topic) {
    if (topic === "nsPref:changed") {
      this._update();
    }
  },

  handleEvent(_event) {
    this._update();
  },

  _isDevUri(uri) {
    if (!uri) return false;
    try {
      const { scheme } = uri;

      // file:// URLs are always local
      if (scheme === "file") return true;

      // Only check http/https; ignore about:, chrome:, etc.
      if (scheme !== "http" && scheme !== "https") return false;

      const host = uri.host ?? "";

      if (this._devHosts.has(host)) return true;
      if (this._devTLDs.some(tld => host.endsWith(tld))) return true;

      return false;
    } catch {
      return false;
    }
  },

  _update() {
    const isDev = this._enabled && this._isDevUri(gBrowser.currentURI);
    document.documentElement.toggleAttribute("zen-dev-url", isDev);
  },

  _progressListener: {
    QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener"]),

    // addTabsProgressListener prepends the browser element as the first arg.
    onLocationChange(aBrowser, aWebProgress, _aRequest, aLocation) {
      // Only react when the top-level frame of the *active* tab navigates.
      if (aWebProgress.isTopLevel && aBrowser === gBrowser.selectedBrowser) {
        const isDev =
          ZenDevUrlDetector._enabled &&
          ZenDevUrlDetector._isDevUri(aLocation);
        document.documentElement.toggleAttribute("zen-dev-url", isDev);
      }
    },
  },
};

window.gZenDevUrlDetector = ZenDevUrlDetector;
