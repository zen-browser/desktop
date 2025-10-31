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
    if (this.registeredSheets.has(domain))
      this.unregisterSheet(domain);

    if(this.registeredBoosts.has(domain))
      this.registeredBoosts.delete(domain);
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
      // console.log('Boost found for domain ', dom, boostData);
    }
    // else
    //   console.log('Boost not found');

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

    // TODO: Send colors to boosts backend

    this.registerCSSForDomain(fontFamily, boost.domain);
  }

  // Save all boosts to the profile folder
  saveBoostToStore(boostData) {
    if (boostData != null) this.registeredBoosts.set(boostData.domain, boostData);

    (async () => this.writeToDisk(this.registeredBoosts))();
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
  async writeToDisk(map) {
    const encoder = new TextEncoder();
    const json = JSON.stringify([...map]);
    const data = encoder.encode(json);

    const profilePath = PathUtils.profileDir;
    const savePath = PathUtils.join(profilePath, this.saveFilename);

    await IOUtils.write(savePath, new Uint8Array(data));
  }

  // Checks if there is a boost registered for the currently open tab
  registeredBoostForDomain(domain) {
    return this.registeredBoosts.has(domain);
  }

  // Checks if a boost can be created
  canBoostSite(uri) {
    return uri.schemeIs('http') || uri.schemeIs('https');
  }

  /**
   * From ZenGradientGenerator.mjs
   * Converts an HSL color value to RGB. Conversion formula
   * adapted from https://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes h, s, and l are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   *
   * @param   {number}  h       The hue
   * @param   {number}  s       The saturation
   * @param   {number}  l       The lightness
   * @return  {Array}           The RGB representation
   */
  hslToRgb(h, s, l) {
    const { round } = Math;
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = this.hueToRgb(p, q, h + 1 / 3);
      g = this.hueToRgb(p, q, h);
      b = this.hueToRgb(p, q, h - 1 / 3);
    }

    return [round(r * 255), round(g * 255), round(b * 255)];
  }
}

export const gZenBoostsManager = new nsZenBoostsManager();
