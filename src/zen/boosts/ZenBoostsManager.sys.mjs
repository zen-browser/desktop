/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";
import { nsZenBoostStyles } from "resource:///modules/ZenBoostStyles.sys.mjs";

class nsZenBoostsManager {
  registeredBoosts = new Map();
  #stylesManager = new nsZenBoostStyles();

  #saveFilename = "zen-boosts.jsonlz4";

  #file = null;

  constructor() {
    this.#readBoostsFromStore(this.notify);
  }

  /**
   * Deletes a boost for the specified domain and persists the change to disk.
   * @param {string} domain - The domain for which to delete the boost.
   */
  deleteBoost(domain) {
    if (this.registeredBoosts.has(domain)) this.registeredBoosts.delete(domain);
    this.#writeToDisk(this.registeredBoosts);
    this.notify();
  }

  /**
   * Loads a boost configuration for the specified domain from storage.
   * If no boost exists for the domain, creates and returns a new default boost configuration.
   * @param {string} domain - The domain for which to load the boost.
   * @returns {Object} The boost data object containing all boost settings for the domain.
   */
  loadBoostFromStore(domain) {
    if (!domain) console.error("[ZenBoostsManager] Domain expected but got null.");

    let boostData = {
      domain,
      boostName: "My Boost",

      dotAngleDeg: 0,
      dotPos: { x: null, y: null },
      dotDistance: 0,

      brightness: 0.5,
      saturation: 0.5,
      contrast: 0.5,

      fontFamily: "",

      enableColorBoost: false,
      smartInvert: false,

      // Choses theme based on Zen's workspace theme
      autoTheme: false,

      // Default to 100% scale
      siteSizeOverride: 1,
      textCaseOverride: "none",

      zapSelectors: [],
      customCSS: "",

      changeWasMade: false,
    };

    if (this.registeredBoosts.has(domain)) {
      boostData = this.registeredBoosts.get(domain);
    } else {
      this.registeredBoosts.set(domain, boostData);
    }

    return boostData;
  }

  /**
   * Adds the zap selector to the selectors list and updates the website.
   * This method fails if the domain has no boost
   * @param {*} selector Selector which will hide the elements
   * @param {*} domain Domain of the targeted boost
   */
  addZapSelector(selector, domain) {
    const boostData = this.loadBoostFromStore(domain);

    if (!boostData.zapSelectors) boostData.zapSelectors = [];
    if (!boostData.zapSelectors.includes(selector)) boostData.zapSelectors.push(selector);

    this.updateBoost(boostData);
  }

  /**
   * Removes the zap selector to the selectors list and updates the website.
   * This method fails if the domain has no boost
   * @param {*} selector Selector which will no longer hide the elements
   * @param {*} domain Domain of the targeted boost
   */
  removeZapSelector(selector, domain) {
    if (this.registeredBoosts.has(domain)) {
      let boostData = this.registeredBoosts.get(domain);

      if (boostData.zapSelectors && boostData.zapSelectors.includes(selector)) {
        const i = boostData.zapSelectors.indexOf(selector);
        if (i !== -1) {
          boostData.zapSelectors.splice(i, 1);
        }
      }

      this.updateBoost(boostData);
    }
  }

  /**
   * Clears all zap selectors from a boost
   * @param {*} domain Domain of targeted boost
   */
  clearZapSelectors(domain) {
    if (this.registeredBoosts.has(domain)) {
      let boostData = this.registeredBoosts.get(domain);
      boostData.zapSelectors = [];
      this.updateBoost(boostData);
    }
  }

  /**
   * Updates the boost data for a domain in memory and notifies observers of the change.
   * @param {Object} boostData - The boost data object to update.
   */
  updateBoost(boostData) {
    this.registeredBoosts.set(boostData.domain, boostData);
    this.#stylesManager.invalidateStyleForDomain(boostData.domain);
    this.notify();
  }

  /**
   * Notifies all observers that boost data has been updated.
   * This triggers a 'zen-boosts-update' notification event.
   */
  notify(unloadStyles = false) {
    Services.obs.notifyObservers(null, "zen-boosts-update", { unloadStyles });
  }

  /**
   * Saves a boost configuration to persistent storage and notifies observers.
   * @param {Object|null} boostData - The boost data object to save. If null, only saves existing boosts.
   */
  saveBoostToStore(boostData) {
    if (boostData != null) this.registeredBoosts.set(boostData.domain, boostData);
    this.#writeToDisk(this.registeredBoosts);
    this.notify();
  }

  /**
   * Reads all boosts from persistent storage and updates the registered boosts map.
   * @param {Function} done - Callback function to execute after reading is complete.
   * @private
   */
  #readBoostsFromStore(done) {
    this.#readFromDisk().then((data) => {
      this.registeredBoosts = data;
      done();
    });
  }

  /**
   * Gets the file path where boost data is stored in the user's profile directory.
   * @returns {string} The full path to the boost storage file.
   * @private
   */
  get #storePath() {
    const profilePath = PathUtils.profileDir;
    return PathUtils.join(profilePath, this.#saveFilename);
  }

  /**
   * Reads boost data from disk, decompresses it, and converts it to a Map.
   * @returns {Promise<Map>} A promise that resolves to a Map of domain to boost data.
   * @private
   */
  async #readFromDisk() {
    this.#file = new JSONFile({
      path: this.#storePath,
      compression: "lz4",
    });

    await this.#file.load();

    let array = Array.isArray(this.#file.data) ? this.#file.data : [];
    let data = new Map(array);
    return data;
  }

  /**
   * Writes boost data to disk by converting the Map to JSON and compressing it.
   * @param {Map} map - The Map of domain to boost data to write to disk.
   * @private
   */
  #writeToDisk(map) {
    const data = Array.from(map.entries());

    this.#file.data = data;
    this.#file.saveSoon();
  }

  /**
   * Checks if a boost is registered for the specified domain.
   * @param {string} domain - The domain to check for a registered boost.
   * @returns {boolean} True if a boost exists for the domain, false otherwise.
   */
  registeredBoostForDomain(domain) {
    return this.registeredBoosts.has(domain);
  }

  /**
   * Determines if a boost can be created for the given URI.
   * Only HTTP and HTTPS schemes are supported for boosting.
   * @param {nsIURI} uri - The URI to check for boost eligibility.
   * @returns {boolean} True if the URI scheme is http or https, false otherwise.
   */
  canBoostSite(uri) {
    return uri.schemeIs("http") || uri.schemeIs("https");
  }

  /**
   * @brief Gets from cache or creates and caches a new style sheet for the given boost data.
   * @param {Object} boostData - The boost data object containing all boost settings for the domain.
   * @returns {nsIStyleSheet} The style sheet corresponding to the boost data.
   */
  getStyleSheetForBoost(boostData) {
    return this.#stylesManager.getStyleForBoost(boostData);
  }

  /**
   * @brief Opens the boost editor in a new popup window.
   * @param {Window} parentWindow - The parent browser window
   * @returns {Object} The instanced editor window
   */
  openBoostWindow(parentWindow) {
    const { availLeft, availWidth } = parentWindow.screen;
    const screenX = parentWindow.screenX;
    const screenY = parentWindow.screenY;
    const width = parentWindow.outerWidth;
    const height = parentWindow.outerHeight;
    const editorWidth = 185;
    const editorHeight = 565;
    const pad = 20;

    let left = screenX + width + pad;
    if (this.#areTabsOnRightSide()) left = screenX - (editorWidth + pad);

    let top = screenY + height / 2 - editorHeight / 2;

    if (left + editorWidth > (availLeft + availWidth) || left < availLeft) {
      left = screenX + width - (editorWidth + pad);
      if (this.#areTabsOnRightSide()) left = screenX + pad;
    }

    const editor = Services.ww.openWindow(
      parentWindow,
      "chrome://browser/content/zen-components/windows/zen-boost-editor.xhtml",
      null,
      `left=${left},top=${top},chrome,alwaysontop,resizable=no,minimizable=no,dependent,dialog=no`,
      null
    );

    // Close the editor if the tab is switched
    parentWindow.gBrowser.tabContainer.addEventListener(
      "TabSelect",
      (event) => {
        // This seems to be a safer way than doing currentURI.host
        const url = new URL(event.target.linkedBrowser.currentURI.spec);
        const domain = url.hostname;

        // Close if domain doesn't match
        if (domain != editor.domain) {
          editor.close();
        }
      },
      // Remove the event listener after the window closes
      { once: true }
    );

    // Give the domain
    const domain = parentWindow.gBrowser.selectedTab.linkedBrowser.currentURI.host;
    editor.domain = domain;
    editor.openerWindow = parentWindow;

    return editor;
  }

  /**
   * Helper function to determine if tabs are on the right side.
   * From: ZenDownloadAnimation.mjs
   */
  #areTabsOnRightSide() {
    return Services.prefs.getBoolPref("zen.tabs.vertical.right-side");
  }
}

export const gZenBoostsManager = new nsZenBoostsManager();
