// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenBoostsManager: 'resource:///modules/ZenBoostsManager.sys.mjs',
});

export class ZenBoostsParent extends JSWindowActorParent {
  constructor() {
    super();

    this._observe = this.observe.bind(this);
    Services.obs.addObserver(this._observe, 'zen-boosts-update');
  }

  didDestroy() {
    Services.obs.removeObserver(this._observe, 'zen-boosts-update');
  }

  observe(subject, topic) {
    if (topic === 'zen-boosts-update') {
      this.sendQuery('ZenBoost:BoostDataUpdated');
    }
  }

  async receiveMessage(message) {
    switch (message.name) {
      case 'ZenBoost:GetBoostForDomain': {
        const domain = message.data;
        const embedder = this.browsingContext.top.embedderElement;
        if (!embedder || !domain) return null;
        if (!lazy.gZenBoostsManager.registeredBoostForDomain(domain)) return null;
        const topWindowIsDarkMode =
          embedder.ownerGlobal.getComputedStyle(embedder).colorScheme === 'dark';
        return { ...lazy.gZenBoostsManager.loadBoostFromStore(domain), topWindowIsDarkMode };
      }
      default:
        console.warn(`[ZenBoostsParent]: Unknown message: ${message.name}`);
    }
  }
}
