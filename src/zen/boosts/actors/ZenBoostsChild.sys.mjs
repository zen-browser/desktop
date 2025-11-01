// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenBoostsChild extends JSWindowActorChild {
  constructor() {
    super();
  }

  async handleEvent(event) {
    switch (event.type) {
      case 'load':
        await this.#onLoad(event);
        break;
      default:
    }
  }

  async receiveMessage(message) {
    switch (message.name) {
      case 'ZenBoost:BoostDataUpdated':
        this.#applyBoostForPageIfAvailable();
        return Promise.resolve(null);
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
      r = this.#hueToRgb(p, q, h + 1 / 3);
      g = this.#hueToRgb(p, q, h);
      b = this.#hueToRgb(p, q, h - 1 / 3);
    }

    return [round(r * 255), round(g * 255), round(b * 255)];
  }

  #hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  async #applyBoostForPageIfAvailable() {
    const browsingContext = this.browsingContext;
    if (!browsingContext) {
      return null;
    }

    const domain = browsingContext.topWindow.location.host;

    this.sendQuery('ZenBoost:GetBoostForDomain', domain).then((boost) => {
      if (boost != null) {
        browsingContext.prefersColorSchemeOverride = boost.smartInvert ? 'light' : 'none';
        if (boost.enableColorBoost) {
          const rgbColor = this.#hslToRgb(
            boost.dotAngleDeg / 360,
            boost.dotDistance /* already is [0, 1] */,
            0.2 + boost.dotDistance * 0.6 /* lightness range from [0.2, 0.8] */
          );
          const nsColor = this.#rgbToNSColor(rgbColor);
          browsingContext.zenBoostsData = nsColor;
        } else browsingContext.zenBoostsData = 0;
      } else {
        browsingContext.prefersColorSchemeOverride = 'none';
        browsingContext.zenBoostsData = 0;
      }
    });
  }

  async #onLoad(event) {
    this.#applyBoostForPageIfAvailable();
  }
}
