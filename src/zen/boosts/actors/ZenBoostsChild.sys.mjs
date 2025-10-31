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

  /**
   * Inverse of https://searchfox.org/firefox-main/rev/0b21972a78f8915f73ce5579eeee2aa8c9c7d67e/gfx/src/nsColor.h#18-21
   * Converts [r, g, b] array to NSColor integer
   */
  #rgbToNSColor([r, g, b]) {
    return (b << 16) | (g << 8) | r;
  }

  async #getBoostForPage() {
    const browsingContext = this.browsingContext;
    if (!browsingContext) {
      return null;
    }
    const url = browsingContext.currentWindowGlobal.documentURI.spec;
  }

  async #onLoad(event) {
    this.applyBoostIfAvailable();
  }
}
