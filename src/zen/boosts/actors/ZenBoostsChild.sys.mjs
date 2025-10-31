// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenBoostsChild extends JSWindowActorChild {
  constructor() {
    super();

    Services.obs.addObserver(this, 'zen-boosts-update');
  }

  observe(subject, topic) {
    if (topic === 'zen-boosts-update') {
      this.#applyBoostForPageIfAvailable();
    }
  }

  async handleEvent(event) {
    switch (event.type) {
      case 'load':
        await this.#onLoad(event);
        break;
      default:
    }
  }

  /**
   * Inverse of https://searchfox.org/firefox-main/rev/0b21972a78f8915f73ce5579eeee2aa8c9c7d67e/gfx/src/nsColor.h#18-21
   * Converts [r, g, b] array to NSColor integer
   */
  #rgbToNSColor([r, g, b]) {
    return (b << 16) | (g << 8) | r;
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
  #hslToRgb(h, s, l) {
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

  async #applyBoostForPageIfAvailable() {
    const browsingContext = this.browsingContext;
    if (!browsingContext) {
      return null;
    }

    const url = new URL(browsingContext.currentWindowGlobal.documentURI.spec);
    const domain = url.hostname;

    const { gZenBoostsManager } = ChromeUtils.importESModule(
      'resource:///modules/ZenBoostsManager.sys.mjs'
    );

    if(gZenBoostsManager.registeredBoostForDomain(domain)){
      const boostData = gZenBoostsManager.loadBoostFromStore(domain);
      
      window.gBrowser.selectedBrowser.browsingContext.prefersColorSchemeOverride = boostData.smartInvert ? "light" : "none";
      if(boostData.enableColorBoost){
        const hslColor = this.#hslToRgb(boostData.dotAngleDeg, boostData.dotDistance, 60);
        const nsColor = this.#rgbToNSColor(hslColor[0], hslColor[1], hslColor[2]); 
        window.gBrowser.selectedBrowser.browsingContext.zenBoostsData = nsColor;
      }
      else
        window.gBrowser.selectedBrowser.browsingContext.zenBoostsData = null;
    }
  }

  async #onLoad(event) {
    this.#applyBoostForPageIfAvailable();
  }
}
