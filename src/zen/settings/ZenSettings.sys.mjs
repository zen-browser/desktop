// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
});

const SETTINGS_WINDOW_URL =
  "chrome://browser/content/zen-components/windows/zen-settings-window.xhtml";
const SETTINGS_WINDOW_TYPE = "Zen:Settings";

class nsZenSettings {
  get windowURL() {
    return SETTINGS_WINDOW_URL;
  }

  get windowType() {
    return SETTINGS_WINDOW_TYPE;
  }

  /** @returns {Window|null} The settings window, if one is open. */
  get window() {
    for (const win of Services.wm.getEnumerator(SETTINGS_WINDOW_TYPE)) {
      if (!win.closed) {
        return win;
      }
    }
    return null;
  }

  /**
   * Decides who answers a request to open the settings.
   *
   * @param {string} [paneID] The pane openPreferences() was asked for.
   * @param {object} [extraArgs] The extra arguments of openPreferences().
   * @returns {boolean} Whether the request was handled here.
   */
  handleOpenPreferences(paneID, extraArgs) {
    if (paneID || extraArgs?.urlParams) {
      return false;
    }
    this.open();
    return true;
  }

  /**
   * Opens the settings window, or focuses the one that is already open.
   *
   * @param {string} [pane] The pane to show, e.g. "links".
   * @returns {Window} The settings window.
   */
  open(pane) {
    const existing = this.window;
    if (existing) {
      if (pane) {
        existing.gZenSettingsWindow?.showPane(pane);
      }
      existing.focus();
      return existing;
    }

    const features = "chrome,centerscreen,dialog,resizable=no";
    const args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    if (pane) {
      const paneArg = Cc["@mozilla.org/supports-string;1"].createInstance(
        Ci.nsISupportsString
      );
      paneArg.data = pane;
      args.appendElement(paneArg);
    }
    return Services.ww.openWindow(
      lazy.BrowserWindowTracker.getTopWindow(),
      SETTINGS_WINDOW_URL,
      "_blank",
      features,
      args
    );
  }

  /**
   * Opens the Firefox settings page with a search already running in it.
   *
   * @param {string} query What to search for.
   */
  async searchFirefoxSettings(query) {
    const win = lazy.BrowserWindowTracker.getTopWindow();
    if (!win) {
      return;
    }
    await win.openPreferences("paneGeneral");
    win.focus();
    const browser = win.gBrowser.selectedBrowser;
    if (
      browser.contentDocument?.readyState != "complete" ||
      !browser.contentWindow.gSearchResultsPane?.inited
    ) {
      await new Promise(resolve => {
        browser.addEventListener("Initialized", resolve, {
          capture: true,
          once: true,
        });
      });
    }
    const { gSearchResultsPane } = browser.contentWindow;
    gSearchResultsPane.searchInput.value = query;
    await gSearchResultsPane.searchFunction({
      target: gSearchResultsPane.searchInput,
    });
  }
}

export const ZenSettings = new nsZenSettings();
