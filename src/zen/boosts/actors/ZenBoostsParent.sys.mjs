// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenBoostsManager: "resource:///modules/ZenBoostsManager.sys.mjs",
});

export class ZenBoostsParent extends JSWindowActorParent {
  /**
   * Creates a new ZenBoostsParent actor instance and sets up an observer
   * for boost update notifications.
   */
  constructor() {
    super();

    Services.obs.addObserver(this, "zen-boosts-update");
    Services.obs.addObserver(this, "zen-boosts-disable-zap");
  }

  /**
   * Called when the actor is destroyed. Cleans up the observer.
   */
  didDestroy() {
    Services.obs.removeObserver(this, "zen-boosts-update");
    Services.obs.removeObserver(this, "zen-boosts-disable-zap");
  }

  /**
   * Observer callback that handles boost update notifications.
   * Sends a message to child actors when boosts are updated.
   * @param {Object} subject - The subject of the notification.
   * @param {string} topic - The topic of the notification.
   */
  observe(subject, topic) {
    switch (topic) {
      case "zen-boosts-update":
        this.sendQuery("ZenBoost:BoostDataUpdated", { unloadStyles: true });
        break;
      case "zen-boosts-disable-zap":
        this.sendQuery("ZenBoost:DisableZapMode");
        break;
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
      case "ZenBoost:Notify": {
        Services.obs.notifyObservers(null, message.data.topic, null);
        break;
      }
      case "ZenBoost:ZapSelector": {
        const data = message.data;

        if (!data.action) return;
        if (!data.selector) return;
        if (!data.domain) return;

        if (data.action == "add") {
          lazy.gZenBoostsManager.addZapSelector(data.selector, data.domain);
        } else if (data.action == "remove") {
          lazy.gZenBoostsManager.removeZapSelector(data.selector, data.domain);
        } else if (data.action == "clear") {
          lazy.gZenBoostsManager.clearZapSelectors(data.domain);
        }
        break;
      }
      case "ZenBoost:GetBoostForDomain": {
        const domain = message.data;
        const embedder = this.browsingContext.top.embedderElement;

        if (!embedder || !domain) return null;

        const exists = lazy.gZenBoostsManager.registeredBoostForDomain(domain);
        if (!exists) return null;

        const topWindowIsDarkMode =
          embedder.ownerGlobal.getComputedStyle(embedder).colorScheme === "dark";

        const boostData = lazy.gZenBoostsManager.loadBoostFromStore(domain);
        const currentWorkspace =
          await this.browsingContext.topChromeWindow.gZenWorkspaces.getActiveWorkspace();

        const styleData = await lazy.gZenBoostsManager.getStyleSheetForBoost(boostData);

        return {
          ...boostData,
          topWindowIsDarkMode,
          workspaceGradient: currentWorkspace.theme.gradientColors,
          styleSheet: styleData
            ? {
                uuid: styleData.uuid,
                uri: styleData.uri.spec,
              }
            : null,
        };
      }
      default:
        console.warn(`[ZenBoostsParent]: Unknown message: ${message.name}`);
    }
  }
}
