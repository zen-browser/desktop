// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenBoostsManager: 'resource:///modules/ZenBoostsManager.sys.mjs',
});

export class ZenBoostsParent extends JSWindowActorParent {
  /**
   * Creates a new ZenBoostsParent actor instance and sets up an observer
   * for boost update notifications.
   */
  constructor() {
    super();

    this._observe = this.observe.bind(this);
    Services.obs.addObserver(this._observe, 'zen-boosts-update');
  }

  /**
   * Called when the actor is destroyed. Cleans up the observer.
   */
  didDestroy() {
    Services.obs.removeObserver(this._observe, 'zen-boosts-update');
  }

  /**
   * Observer callback that handles boost update notifications.
   * Sends a message to child actors when boosts are updated.
   * @param {Object} subject - The subject of the notification.
   * @param {string} topic - The topic of the notification.
   */
  observe(subject, topic) {
    if (topic === 'zen-boosts-update') {
      this.sendQuery('ZenBoost:BoostDataUpdated', { unloadStyles: true });
    }
  }

  /**
   * Handles messages received from child actors.
   * Retrieves boost data for a domain when requested.
   * @param {Object} message - The message object containing name and data.
   * @returns {Promise<Object|null>} A promise that resolves to the boost data or null.
   */
  async receiveMessage(message) {
    switch (message.name) {
      case 'ZenBoost:GetBoostForDomain': {
        const domain = message.data;
        const embedder = this.browsingContext.top.embedderElement;
        if (!embedder || !domain) return null;
        const exists = lazy.gZenBoostsManager.registeredBoostForDomain(domain);
        if (!exists) return null;
        const topWindowIsDarkMode =
          embedder.ownerGlobal.getComputedStyle(embedder).colorScheme === 'dark';
        return {
          ...lazy.gZenBoostsManager.loadBoostFromStore(domain),
          topWindowIsDarkMode,
          styleSheet: await lazy.gZenBoostsManager.getStyleSheetForBoost(domain),
        };
      }
      default:
        console.warn(`[ZenBoostsParent]: Unknown message: ${message.name}`);
    }
  }
}
