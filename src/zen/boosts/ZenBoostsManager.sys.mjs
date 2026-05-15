/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";
import { nsZenBoostStyles } from "resource:///modules/zen/boosts/ZenBoostStyles.sys.mjs";

class nsZenBoostsManager {
  registeredDomains = new Map(); // <domain, { boosts: <id, boostEntry>, activeBoostID: null }>
  #stylesManager = new nsZenBoostStyles();

  #saveFilename = "zen-boosts.jsonlz4";

  #file = null;

  constructor() {
    this.#readBoostsFromStore(this.notify);
  }

  /**
   * @returns {object} New domain entry with empty boost map and active boost id
   */
  #createDomainEntry() {
    return {
      boostEntries: new Map(), // <id, boostEntry>
      activeBoostId: null,
    };
  }

  /**
   * Will get or create a domain entry for the given domain
   *
   * @param {string} domain - The domain of which the data will be fetched
   * @returns {object} The domain entry
   */
  #getOrCreateDomainEntry(domain) {
    if (!this.registeredDomains.has(domain)) {
      this.registeredDomains.set(domain, this.#createDomainEntry());
    }
    return this.registeredDomains.get(domain);
  }

  /**
   * Will get a domain entry for the given domain
   *
   * @param {string} domain - The domain of which the data will be fetched
   * @returns {object|null} The domain entry
   */
  #getDomainEntry(domain) {
    if (!this.registeredDomains.has(domain)) {
      return null;
    }
    return this.registeredDomains.get(domain);
  }

  /**
   * Will delete the domain entry for a domain
   *
   * @param {string} domain - The given domain
   */
  #deleteDomainEntry(domain) {
    if (this.registeredDomains.has(domain)) {
      this.registeredDomains.delete(domain);
    }
  }

  /**
   * Gets the active boost id for a given domain
   *
   * @param {string} domain - The target domain
   * @returns {string | null} Will return the active boost id or null
   */
  getActiveBoostId(domain) {
    const domainEntry = this.#getDomainEntry(domain);
    if (domainEntry) {
      return domainEntry.activeBoostId;
    }
    return null;
  }

  /**
   * Deletes a boost for the specified domain and persists the change to disk.
   *
   * @param {object} boost - The targeted boost.
   */
  deleteBoost(boost) {
    const { domain, id } = boost;

    if (this.registeredDomains.has(domain)) {
      let domainEntry = this.#getOrCreateDomainEntry(domain);
      if (domainEntry.boostEntries.has(id)) {
        domainEntry.boostEntries.delete(id);
      }
      if (domainEntry.activeBoostId == id) {
        domainEntry.activeBoostId = null;
      }

      if (domainEntry.boostEntries.size === 0) {
        this.#deleteDomainEntry(domain);
      }
    }

    this.#stylesManager.invalidateStyleForDomain(domain);
    this.notify(true);

    this.#writeToDisk(this.registeredDomains);
  }

  /**
   * @returns {object} Returns a new empty boost entry
   */
  getEmptyBoostEntry() {
    return {
      boostData: {
        boostName: "My Boost",

        dotAngleDeg: 0,
        dotPos: { x: null, y: null },
        dotDistance: 0,

        secondaryDotAngleDegDelta: 32,
        secondaryDotPos: { x: null, y: null },

        brightness: 0.5,
        saturation: 0.5,
        contrast: 0.75,

        fontFamily: "",

        enableColorBoost: false,
        smartInvert: false,

        // Choses theme based on Zen's workspace theme
        autoTheme: false,

        textCaseOverride: "none",
        sizeOverride: 1,

        zapSelectors: [],
        customCSS: "",

        changeWasMade: false,
      },
    };
  }

  /**
   * Will create a new boost
   *
   * @param {string} domain - The domain which will be affected by the boost
   * @returns {object|null} The created boost with { id, domain, boostEntry: { boostData } } or null
   */
  createNewBoost(domain) {
    if (!domain) {
      console.error("[ZenBoostsManager] Domain expected but got null.");
      return null;
    }

    const id = crypto.randomUUID();
    const boostEntry = this.getEmptyBoostEntry(domain);

    const domainEntry = this.#getOrCreateDomainEntry(domain);
    domainEntry.boostEntries.set(id, boostEntry);

    const boost = { id, domain, boostEntry };
    return boost;
  }

  /**
   * Loads the boost configuration for the specified domain from storage.
   *
   * @param {string} domain - The domain for which to load the boost
   * @returns {object[] | null} All boosts for the domain or null
   */
  loadBoostsFromStore(domain) {
    if (!domain) {
      console.error("[ZenBoostsManager] Domain expected but got null.");
    }

    const boosts = [];
    const domainEntry = this.#getDomainEntry(domain);

    if (domainEntry) {
      domainEntry.boostEntries.forEach((value, key) => {
        const boost = { id: key, domain, boostEntry: value };
        boosts.push(boost);
      });
      return boosts;
    }
    return null;
  }

  /**
   * Loads the boost for the specified domain and id from storage.
   * If no boost is present, a new one will be created.
   *
   * @param {string} domain - The domain of the boost
   * @param {string} id - The id of the boost
   * @returns {object} Returns the boost with { id, domain, boostEntry: { boostData } }
   */
  loadBoostFromStore(domain, id) {
    if (!domain) {
      console.error("[ZenBoostsManager] Domain expected but got null.");
    }
    if (!id) {
      console.error("[ZenBoostsManager] ID expected but got null.");
    }

    const domainEntry = this.#getOrCreateDomainEntry(domain);

    if (domainEntry.boostEntries.has(id)) {
      const boostEntry = domainEntry.boostEntries.get(id);
      return { id, domain, boostEntry };
    }
    const boost = this.createNewBoost(domain);
    return boost;
  }

  /**
   * Loads the active boost for the specified domain from storage.
   *
   * @param {string} domain - The domain of the boost
   * @returns {object | null} Returns the boost with { id, domain, boostEntry: { boostData } } or null
   */
  loadActiveBoostFromStore(domain) {
    if (!domain) {
      console.error("[ZenBoostsManager] Domain expected but got null.");
    }

    const domainEntry = this.#getDomainEntry(domain);

    if (domainEntry) {
      if (domainEntry.boostEntries.size === 0) {
        return this.createNewBoost(domain);
      }

      if (domainEntry.boostEntries.has(domainEntry.activeBoostId)) {
        const boostEntry = domainEntry.boostEntries.get(
          domainEntry.activeBoostId
        );
        return { id: domainEntry.activeBoostId, domain, boostEntry };
      }
    }

    return null;
  }

  /**
   * Adds the zap selector to the selectors list and updates the website.
   *
   * @param {string} selector - Selector which will hide the elements
   * @param {string} domain - Domain of the target boost
   */
  addZapSelectorToActive(selector, domain) {
    const boost = this.loadActiveBoostFromStore(domain);
    if (!boost) {
      console.error("[ZenBoostsManager] Active boost is null");
      return;
    }

    const { boostData } = boost.boostEntry;

    if (!boostData.zapSelectors) {
      boostData.zapSelectors = [];
    }
    if (!boostData.zapSelectors.includes(selector)) {
      boostData.zapSelectors.push(selector);
    }

    this.updateBoost(boost);
  }

  /**
   * Removes the zap selector to the selectors list and updates the website.
   *
   * @param {string} selector - Selector which will no longer hide the elements
   * @param {string} domain - Domain of the target boost
   */
  removeZapSelectorToActive(selector, domain) {
    const boost = this.loadActiveBoostFromStore(domain);
    if (!boost) {
      console.error("[ZenBoostsManager] Active boost is null");
      return;
    }

    const { boostData } = boost.boostEntry;

    if (boostData.zapSelectors && boostData.zapSelectors.includes(selector)) {
      const i = boostData.zapSelectors.indexOf(selector);
      if (i !== -1) {
        boostData.zapSelectors.splice(i, 1);
      }
    }

    this.updateBoost(boost);
  }

  /**
   * Makes the boost at the domain with the id active
   *
   * @param {string} domain The target domain
   * @param {string} id The target boost id
   */
  makeBoostActiveForDomain(domain, id) {
    const domainEntry = this.#getDomainEntry(domain);

    if (domainEntry) {
      if (domainEntry.boostEntries.has(id)) {
        domainEntry.activeBoostId = id;
      }
    }

    Services.obs.notifyObservers(null, "zen-boosts-active-change", { id });

    this.#stylesManager.invalidateStyleForDomain(domain);
    this.notify();
  }

  /**
   * Toggles the boost activeness at the domain with the id active
   *
   * @param {string} domain The target domain
   * @param {string} id The target boost id
   */
  toggleBoostActiveForDomain(domain, id) {
    const domainEntry = this.#getDomainEntry(domain);

    if (domainEntry) {
      if (domainEntry.boostEntries.has(id)) {
        if (domainEntry.activeBoostId === id) {
          domainEntry.activeBoostId = null;
          Services.obs.notifyObservers(null, "zen-boosts-active-change", {
            id: null,
          });

          this.#stylesManager.invalidateStyleForDomain(domain);
          this.notify(true);
        } else {
          domainEntry.activeBoostId = id;
          Services.obs.notifyObservers(null, "zen-boosts-active-change", {
            id,
          });

          this.#stylesManager.invalidateStyleForDomain(domain);
          this.notify();
        }
      }
    }
  }

  /**
   * Clears all zap selectors from a boost
   *
   * @param {string} domain - Target boost domain
   */
  clearZapSelectorsForActive(domain) {
    const boost = this.loadActiveBoostFromStore(domain);
    if (!boost) {
      console.error("[ZenBoostsManager] Active boost is null");
      return;
    }

    const { boostData } = boost.boostEntry;
    boostData.zapSelectors = [];

    this.updateBoost(boost);
  }

  /**
   * Updates the boost for a domain in memory and notifies observers of the change.
   *
   * @param {object} boost - The target boost
   */
  updateBoost(boost) {
    const { domain, id, boostEntry } = boost;

    const domainEntry = this.#getOrCreateDomainEntry(domain);
    domainEntry.boostEntries.set(id, boostEntry);

    this.#stylesManager.invalidateStyleForDomain(domain);
    this.notify();
  }

  /**
   * Notifies all observers that boost data has been updated.
   * This triggers a 'zen-boosts-update' notification event.
   *
   * @param {boolean} unloadStyles - Whether to unload styles during the update.
   */
  notify(unloadStyles = false) {
    Services.obs.notifyObservers(null, "zen-boosts-update", { unloadStyles });
  }

  /**
   * Saves a boost configuration to persistent storage and notifies observers.
   *
   * @param {object | null} boost - The boost data object to save. If null, only saves existing boosts.
   */
  saveBoostToStore(boost) {
    if (boost) {
      this.updateBoost(boost);
    }

    this.#writeToDisk(this.registeredDomains);
    this.notify();
  }

  /**
   * Reads all boosts from persistent storage and updates the registered boosts map.
   *
   * @param {Function} done - Callback function to execute after reading is complete.
   * @private
   */
  #readBoostsFromStore(done) {
    this.#readFromDisk().then(data => {
      this.registeredDomains = data;
      done();
    });
  }

  /**
   * Gets the file path where boost data is stored in the user's profile directory.
   *
   * @returns {string} The full path to the boost storage file.
   * @private
   */
  get #storePath() {
    const profilePath = PathUtils.profileDir;
    return PathUtils.join(profilePath, this.#saveFilename);
  }

  /**
   * Gets the directory path where user css is stored in the user's profile directory.
   *
   * @returns {string} The full path to the boost userCSS directory.
   * @private
   */
  get #cssPath() {
    const profilePath = PathUtils.profileDir;
    return PathUtils.join(profilePath, "zen-boosts");
  }

  /**
   * Reads boost data from disk, decompresses it, and converts it to a Map.
   *
   * @returns {Promise<Map>} A promise that resolves to a Map of domain to boost data.
   * @private
   */
  async #readFromDisk() {
    this.#file = new JSONFile({
      path: this.#storePath,
      compression: "lz4",
    });

    await this.#file.load();

    const raw = this.#file.data ?? {};
    const map = new Map();

    for (const [domain, entry] of Object.entries(raw)) {
      const boostsMap = new Map();
      for (const [id, boostEntry] of Object.entries(entry.boostEntries ?? {})) {
        // Reuinite the user css with the boost data if any exists
        const userCSS = await this.#readBoostCSS(id);
        if (userCSS) {
          boostEntry.boostData.customCSS = userCSS;
        }

        boostsMap.set(id, boostEntry);
      }

      map.set(domain, {
        activeBoostId: entry.activeBoostId ?? null,
        boostEntries: boostsMap,
      });
    }

    return map;
  }

  /**
   * Reads the user CSS of a boost with the given id from the dedicated folder.
   * Returns null if the file doesn't exist.
   *
   * @param {string} id - The id of the boost
   * @returns {string|null} Returns the user CSS or null
   */
  async #readBoostCSS(id) {
    const fileName = `${id}.css`;
    const directoryPath = this.#cssPath;
    const savePath = PathUtils.join(directoryPath, fileName);

    await IOUtils.makeDirectory(directoryPath, { createAncestors: true });

    if (await IOUtils.exists(savePath)) {
      const css = await IOUtils.readUTF8(savePath);
      return css;
    }

    return null;
  }

  /**
   * Writes boost data to disk by converting the Map to JSON and compressing it.
   *
   * @param {Map} map - The Map of domain to boost data to write to disk.
   * @private
   */
  #writeToDisk(map) {
    const obj = {};

    for (const [domain, entry] of map) {
      const boostsObj = {};
      for (const [id, boostEntry] of entry.boostEntries) {
        // Split the user css from the boost data
        boostsObj[id] = structuredClone(boostEntry);
        delete boostsObj[id].boostData.customCSS;

        this.#writeBoostCSS(id, boostEntry.boostData.customCSS);
      }
      obj[domain] = {
        activeBoostId: entry.activeBoostId ?? null,
        boostEntries: boostsObj,
      };
    }

    this.#file.data = obj;
    this.#file.saveSoon();
  }

  /**
   * Writes the user CSS of a boost with the given id to a dedicated folder.
   *
   * @param {string} id - The id of the boost
   * @param {string} css - The user CSS
   */
  async #writeBoostCSS(id, css) {
    const fileName = `${id}.css`;
    const directoryPath = this.#cssPath;
    const savePath = PathUtils.join(directoryPath, fileName);

    await IOUtils.makeDirectory(directoryPath, { createAncestors: true });
    await IOUtils.writeUTF8(savePath, css);
  }

  /**
   * Checks if any boost is registered and active for the specified domain.
   *
   * @param {string} domain - The domain to check for any registered and active boost.
   * @returns {boolean} True if a boost exists for the domain and is active, false otherwise.
   */
  registeredBoostForDomain(domain) {
    const domainEntry = this.#getDomainEntry(domain);

    if (domainEntry) {
      return domainEntry.boostEntries.has(domainEntry.activeBoostId);
    }

    return false;
  }

  /**
   * Determines if a boost can be created for the given URI.
   * Only HTTP and HTTPS schemes are supported for boosting.
   *
   * @param {nsIURI} uri - The URI to check for boost eligibility.
   * @returns {boolean} True if the URI scheme is http or https, false otherwise.
   */
  canBoostSite(uri) {
    if (!uri || !uri.schemeIs) {
      return false;
    }
    return uri.schemeIs("http") || uri.schemeIs("https");
  }

  /**
   * Gets from cache or creates and caches a new style sheet for the given boost data.
   *
   * @param {string} domain - The domain of the boosts.
   * @returns {nsIStyleSheet} The style sheet corresponding to the boost data.
   */
  getStyleSheetForBoost(domain) {
    const boost = this.loadActiveBoostFromStore(domain);
    if (!boost) {
      return null;
    }

    const { boostData } = boost.boostEntry;
    return this.#stylesManager.getStyleForBoost(boostData, domain);
  }

  /**
   * Opens the boost editor in a new popup window.
   *
   * @param {Window} parentWindow - The parent browser window
   * @param {Boost} boost - The boost which will be edited
   * @param {nsIURI} domainUri - The boost which will be edited
   * @returns {Window|null} The instanced editor window
   */
  openBoostWindow(parentWindow, boost, domainUri) {
    if (!this.canBoostSite(domainUri)) {
      console.error(
        "[ZenBoostsManager] Cannot open editor for boost with invalid domain."
      );
      return null;
    }

    const domain = boost.domain;
    const { availLeft, availWidth } = parentWindow.screen;
    const screenX = parentWindow.screenX;
    const screenY = parentWindow.screenY;
    const width = parentWindow.outerWidth;
    const height = parentWindow.outerHeight;
    const editorWidth = 185;
    const editorHeight = 565;
    const pad = 20;

    let left = screenX + width + pad;
    if (this.#areTabsOnRightSide()) {
      left = screenX - (editorWidth + pad);
    }

    let top = screenY + height / 2 - editorHeight / 2;

    if (left + editorWidth > availLeft + availWidth || left < availLeft) {
      left = screenX + width - (editorWidth + pad);
      if (this.#areTabsOnRightSide()) {
        left = screenX + pad;
      }
    }

    const editor = Services.ww.openWindow(
      parentWindow,
      "chrome://browser/content/zen-components/windows/zen-boost-editor.xhtml",
      null,
      `left=${left},top=${top},chrome,alwaysontop,resizable=no,minimizable=no,dependent,dialog=yes`,
      null
    );

    // Close the editor if the tab is switched
    parentWindow.gBrowser.tabContainer.addEventListener(
      "TabSelect",
      editor.close.bind(editor),
      {
        once: true,
      }
    );

    const progressListener = {
      onLocationChange: webProgress => {
        if (webProgress.isTopLevel) {
          editor.close();
          parentWindow.gBrowser.removeTabsProgressListener(progressListener);
        }
      },
    };

    parentWindow.gBrowser.addProgressListener(progressListener);

    // Give the domain
    editor.domain = domain;
    editor.openerWindow = parentWindow;
    editor.focus();

    // Make boost active
    this.makeBoostActiveForDomain(domain, boost.id);

    return editor;
  }

  /**
   * Will spawn a file save dialog and export the selected boost
   *
   * @param {Window} parentWindow The window that will instance the file picker
   * @param {object} boostData The data of the boost to be exported
   * @returns {Promise<void>} Returns a promise which will be resolved after the export action is complete
   */
  exportBoost(parentWindow, boostData) {
    // From: firefox-main/browser/base/content/browser-commands.js:354
    // https://searchfox.org/firefox-main/source/browser/base/content/browser-commands.js#355:~:text=try%20%7B-,const,fp%2Eopen%28fpCallback%29%3B

    const nsIFilePicker = Ci.nsIFilePicker;
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

    fp.init(
      parentWindow.browsingContext,
      `Exporting Boost ${boostData.boostName}...`,
      nsIFilePicker.modeSave
    );

    // Sanitizing filename
    // From: https://gist.github.com/barbietunnie/7bc6d48a424446c44ff4#:~:text=bytes%22%29%3B-,var,%7D
    const illegalRe = /[\/\?<>\\:\*\|":]/g;

    // eslint-disable-next-line no-control-regex
    const controlRe = /[\x00-\x1f\x80-\x9f]/g;
    const reservedRe = /^\.+$/;
    const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

    let sanitized = boostData.boostName
      .replace(illegalRe, "")
      .replace(controlRe, "")
      .replace(reservedRe, "")
      .replace(windowsReservedRe, "");

    // Replace if resulting filename is empty
    if (!sanitized) {
      sanitized = "New Boost";
    }

    fp.defaultString = sanitized;
    fp.defaultExtension = "json";
    fp.appendFilters(nsIFilePicker.filterAll);

    return new Promise(resolve => {
      fp.open(async result => {
        if (result === nsIFilePicker.returnOK && fp.file) {
          try {
            const boostJSON = JSON.stringify(boostData);
            await IOUtils.writeUTF8(fp.file.path, boostJSON);
            resolve(true);
          } catch (ex) {
            console.error("Export failed:", ex);
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });
  }

  /**
   * Will spawn a file open dialog and import the selected boost
   *
   * @param {Window} parentWindow The window that will instance the file picker
   * @returns {Promise<object | null>} Returns a promise with the boost data or null
   */
  importBoost(parentWindow) {
    const nsIFilePicker = Ci.nsIFilePicker;
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

    fp.init(
      parentWindow.browsingContext,
      "Importing Boost from JSON",
      nsIFilePicker.modeOpen
    );

    fp.appendFilters(nsIFilePicker.filterAll);

    return new Promise(resolve => {
      fp.open(async result => {
        if (result === nsIFilePicker.returnOK && fp.file) {
          try {
            const fileContent = await IOUtils.readUTF8(fp.file.path);
            resolve(JSON.parse(fileContent));
          } catch (e) {
            console.error("Import failed:", e);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
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
