// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class nsZenBoostsManager {
  registeredBoosts = new Map();

  #saveFilename = 'zen-boosts.jsonlz4';

  constructor() {
    this.#init();
  }

  #init() {
    this.#readBoostsFromStore(this.notify);
  }

  deleteBoost(domain) {
    if (this.registeredBoosts.has(domain)) this.registeredBoosts.delete(domain);
    this.#writeToDisk(this.registeredBoosts);
    this.notify();
  }

  // Load a boost from a domain
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
      siteSizeOverride: 100,
      textCaseOverride: 'none',

      changeWasMade: false
    };

    if (this.registeredBoosts.has(domain)) {
      boostData = this.registeredBoosts.get(domain);
    } else {
      this.registeredBoosts.set(domain, boostData);
    }

    return boostData;
  }

  updateBoost(boostData) {
    this.registeredBoosts.set(boostData.domain, boostData);
    this.notify();
  }

  notify() {
    Services.obs.notifyObservers(null, 'zen-boosts-update');
  }

  // Save all boosts to the profile folder
  saveBoostToStore(boostData) {    
    if (boostData != null)
       this.registeredBoosts.set(boostData.domain, boostData);
    this.#writeToDisk(this.registeredBoosts);
    this.notify();
  }

  // Reads all boosts from the profile folder
  #readBoostsFromStore(done) {
    this.#readFromDisk().then((map) => {
      this.registeredBoosts = map;
      done();
    });
  }

  get #storePath() {
    const profilePath = PathUtils.profileDir;
    return PathUtils.join(profilePath, this.#saveFilename);
  }

  // Helper method, disk => json => map
  async #readFromDisk() {
    const savePath = this.#storePath;

    if (!(await IOUtils.exists(savePath))) return new Map();

    const array = await IOUtils.readJSON(savePath, { decompress: true });
    return new Map(array);
  }

  // Helper method, map => json => disk
  #writeToDisk(map) {
    const array = Array.from(map.entries());
    IOUtils.writeJSON(this.#storePath, array, { compress: true });
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
