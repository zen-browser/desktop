/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenBoostStyles } from 'resource:///modules/ZenBoostStyles.sys.mjs';

class nsZenBoostsManager {
  registeredBoosts = new Map();

  #stylesManager = new nsZenBoostStyles();
  #saveFilename = 'zen-boosts.jsonlz4';

  constructor() {
    this.#init();
  }

  /**
   * Initializes the boosts manager by reading boosts from persistent storage.
   * @private
   */
  #init() {
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
    if (!domain) console.error('[ZenBoostsManager] Domain expected but got null.');

    let boostData = {
      domain,
      boostName: 'My Boost',

      dotAngleDeg: 0,
      dotPos: { x: null, y: null },
      dotDistance: 0,

      brightness: 128,
      contrast: 128,
      saturation: 128,

      fontFamily: '',

      enableColorBoost: false,
      smartInvert: false,

      // Choses theme based on Zen's workspace theme
      autoTheme: false,

      // Default to 100% scale
      siteSizeOverride: 1,
      textCaseOverride: 'none',

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
   * Updates the boost data for a domain in memory and notifies observers of the change.
   * @param {Object} boostData - The boost data object to update.
   */
  updateBoost(boostData) {
    this.registeredBoosts.set(boostData.domain, boostData);
    this.notify();
  }

  /**
   * Notifies all observers that boost data has been updated.
   * This triggers a 'zen-boosts-update' notification event.
   */
  notify() {
    Services.obs.notifyObservers(null, 'zen-boosts-update');
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
    this.#readFromDisk().then((map) => {
      this.registeredBoosts = map;
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
    const savePath = this.#storePath;

    if (!(await IOUtils.exists(savePath))) return new Map();

    const array = await IOUtils.readJSON(savePath, { decompress: true });
    return new Map(array);
  }

  /**
   * Writes boost data to disk by converting the Map to JSON and compressing it.
   * @param {Map} map - The Map of domain to boost data to write to disk.
   * @private
   */
  #writeToDisk(map) {
    const array = Array.from(map.entries());
    IOUtils.writeJSON(this.#storePath, array, { compress: true });
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
    return uri.schemeIs('http') || uri.schemeIs('https');
  }

  /**
   * @brief Gets from cache or creates and caches a new style sheet for the given boost data.
   * @param {Object} boostData - The boost data object containing all boost settings for the domain.
   * @returns {nsIStyleSheet} The style sheet corresponding to the boost data.
   */
  getStyleSheetForBoost(boostData) {
    //return
  }
}

export const gZenBoostsManager = new nsZenBoostsManager();
