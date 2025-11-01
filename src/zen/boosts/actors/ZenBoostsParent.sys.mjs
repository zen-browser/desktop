// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenBoostsParent extends JSWindowActorParent {
  canSendUpdate = true;

  constructor() {
    super();

    this._observe = this.observe.bind(this);
    Services.obs.addObserver(this._observe, 'zen-boosts-update');
  }

  didDestroy() {
    Services.obs.removeObserver(this._observe, 'zen-boosts-update');
  }

  observe(subject, topic, data) {
    if (topic === 'zen-boosts-update') {
      this.canSendUpdate = false;

      this.sendQuery('ZenBoost:BoostDataUpdated').then((x) => (this.canSendUpdate = true));
    }
  }

  async receiveMessage(message) {
    switch (message.name) {
      case 'ZenBoost:GetBoostForDomain': {
        const domain = message.data;
        const { gZenBoostsManager } = ChromeUtils.importESModule(
          'resource:///modules/ZenBoostsManager.sys.mjs'
        );

        if (!gZenBoostsManager.registeredBoostForDomain(domain)) return Promise.resolve(null);

        return Promise.resolve(gZenBoostsManager.loadBoostFromStore(domain));
      }
      default:
        console.warn(`[ZenBoostsParent]: Unknown message: ${message.name}`);
    }
  }
}
