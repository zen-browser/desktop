// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class nsZenBoostsManager {
  initialized = false;
  registeredSheets = new Map();
  registeredBoosts = new Map();

  saveFilename = 'zen-boosts.json';

  constructor() {
    this.init();
  }

  init() {
    this.readBoostsFromStore(() => (this.initialized = true));
  }

  // Store Firefox Style Sheet Service and IO Service for later use
  sss = Components.classes['@mozilla.org/content/style-sheet-service;1'].getService(
    Components.interfaces.nsIStyleSheetService
  );
  ioService = Services.io;

  // TODO: Causes flickering when updating often
  registerCSSForDomain(cssString, domain, sheetType = this.sss.USER_SHEET) {
    // Make sure existing overrides get overwritten and not added on top
    if (this.registeredSheets.has(domain)) {
      this.unregisterSheet(this.registeredSheets.get(domain), sheetType);
    }

    // Add the @-moz-document wrapper and specific domain attribute
    const wrapped = `@-moz-document domain("${domain}") { ${cssString} }`;
    const uri = this.ioService.newURI('data:text/css;charset=utf-8,' + encodeURIComponent(wrapped));

    // Register and store in map
    this.sss.loadAndRegisterSheet(uri, sheetType);
    this.registeredSheets.set(domain, uri);

    return uri;
  }

  // Unregisters a sheet based on either domain or uri
  unregisterSheet(uriOrDomain, sheetType = this.sss.USER_SHEET) {
    let uri = uriOrDomain;

    // Check if a uri or domain
    if (typeof uriOrDomain === 'string' && this.registeredSheets.has(uriOrDomain)) {
      uri = this.registeredSheets.get(uriOrDomain);
      this.registeredSheets.delete(uriOrDomain);
    }

    if (this.sss.sheetRegistered(uri, sheetType)) {
      this.sss.unregisterSheet(uri, sheetType);
    }
  }

  deleteBoost(domain) {
    if (this.registeredSheets.has(domain)) this.unregisterSheet(domain);

    if (this.registeredBoosts.has(domain)) this.registeredBoosts.delete(domain);
  }

  // Load a boost from a domain
  loadBoostFromStore(domain) {
    if (domain == null) console.error('[ZenBoostsManager] Domain expected but got null.');
    const dom = domain ?? '';

    let boostData = {
      boostName: 'New Boost',
      domain: dom,
      dotAngleDeg: 0,
      dotPos: { x: null, y: null },
      dotDistance: 0,
      fontFamily: '',
      enableColorBoost: false,
      smartInvert: false,
    };

    if (this.registeredBoosts.has(dom)) {
      boostData = this.registeredBoosts.get(dom);
    }

    return boostData;
  }

  // Injects css based on boost data
  updateBoost(boost) {
    let fontFamily = '';
    if (boost.fontFamily != '') {
      fontFamily = `
          body, p, h1, h2, h3, h4, h5, a, span, textarea, input {
            font-family: ${boost.fontFamily} !important;
          }
        `;
    }

    Services.obs.notifyObservers(null, 'zen-boosts-update');
    this.registerCSSForDomain(fontFamily, boost.domain);
  }

  // Save all boosts to the profile folder
  saveBoostToStore(boostData) {
    if (boostData != null) this.registeredBoosts.set(boostData.domain, boostData);
    this.writeToDisk(this.registeredBoosts);
  }

  // Reads all boosts from the profile folder
  readBoostsFromStore(done) {
    this.readFromDisk().then((map) => {
      this.registeredBoosts = map;

      // Load in all boosts
      for (const [key, value] of this.registeredBoosts) {
        this.updateBoost(value);
      }

      done();
    });
  }

  // Helper method, disk => json => map
  async readFromDisk() {
    const profilePath = PathUtils.profileDir;
    const savePath = PathUtils.join(profilePath, this.saveFilename);

    if (!(await IOUtils.exists(savePath))) return new Map();

    const data = await IOUtils.read(savePath);
    const decoder = new TextDecoder();
    const json = decoder.decode(data);

    return new Map(JSON.parse(json));
  }

  // Helper method, map => json => disk
  writeToDisk(map) {
    const json = JSON.stringify([...map]);
    IOUtils.writeJSON(json, { compress: true });
  }

  // Checks if there is a boost registered for the currently open tab
  registeredBoostForDomain(domain) {
    return this.registeredBoosts.has(domain);
  }

  // Checks if a boost can be created
  canBoostSite(uri) {
    return uri.schemeIs('http') || uri.schemeIs('https');
  }
}

export const gZenBoostsManager = new nsZenBoostsManager();
