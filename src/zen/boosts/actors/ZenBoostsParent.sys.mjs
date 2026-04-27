// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenBoostsManager: "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs",
});

export class ZenBoostsParent extends JSWindowActorParent {
  static OBSERVERS = [
    "zen-boosts-update",
    "zen-space-gradient-update",
    "zen-boosts-disable-zap",
    "zen-boosts-disable-picker",
  ];

  // Topics the content child is allowed to forward to the observer service.
  // Anything outside this set is rejected to prevent content-triggered
  // notifications on unrelated chrome observers.
  static ALLOWED_NOTIFY_TOPICS = new Set([
    "zap-state-update",
    "zap-list-update",
    "selector-picker-state-update",
    "selector-picker-picked",
  ]);

  /**
   * Creates a new ZenBoostsParent actor instance and sets up an observer
   * for boost update notifications.
   */
  constructor() {
    super();

    this._observe = this.observe.bind(this);
    ZenBoostsParent.OBSERVERS.forEach(observe => {
      Services.obs.addObserver(this._observe, observe);
    });
  }

  /**
   * Called when the actor is destroyed. Cleans up the observer.
   */
  didDestroy() {
    ZenBoostsParent.OBSERVERS.forEach(observe => {
      Services.obs.removeObserver(this._observe, observe);
    });
  }

  /**
   * Observer callback that handles boost update notifications.
   * Sends a message to child actors when boosts are updated.
   *
   * @param {object} subject - The subject of the notification.
   * @param {string} topic - The topic of the notification.
   */
  observe(subject, topic) {
    switch (topic) {
      case "zen-boosts-update":
      case "zen-space-gradient-update":
        this.sendAsyncMessage("ZenBoost:BoostDataUpdated", {
          unloadStyles: true,
        });
        break;
      case "zen-boosts-disable-zap":
        this.sendAsyncMessage("ZenBoost:DisableZapMode");
        break;
      case "zen-boosts-disable-picker":
        this.sendAsyncMessage("ZenBoost:DisablePickerMode");
        break;
    }
  }

  /**
   * Handles messages received from child actors.
   * Retrieves boost data for a domain when requested.
   *
   * @param {object} message - The message object containing name and data.
   * @returns {Promise<object | null>} A promise that resolves to the boost data or null.
   */
  async receiveMessage(message) {
    switch (message.name) {
      case "ZenBoost:OpenInspector": {
        const { require } = ChromeUtils.importESModule(
          "resource://devtools/shared/loader/Loader.sys.mjs"
        );

        const { gDevTools } = require("devtools/client/framework/devtools");

        let win = Services.wm.getMostRecentWindow("navigator:browser");
        let tab = win.gBrowser.selectedTab;

        let toolbox = gDevTools.getToolboxForTab(tab);

        if (toolbox) {
          await gDevTools.closeToolboxForTab(tab);
        } else {
          await gDevTools.showToolboxForTab(tab, "inspector");
        }
        break;
      }
      case "ZenBoost:Notify": {
        const { topic, msg } = message.data ?? {};
        if (!ZenBoostsParent.ALLOWED_NOTIFY_TOPICS.has(topic)) {
          console.warn(
            `[ZenBoostsParent]: Rejected notify for disallowed topic: ${topic}`
          );
          break;
        }
        Services.obs.notifyObservers(null, topic, msg);
        break;
      }
      case "ZenBoost:ZapSelector": {
        const data = message.data;

        if (!data.action) {
          break;
        }
        if (!data.selector) {
          break;
        }
        if (!data.domain) {
          break;
        }

        if (data.action == "add") {
          lazy.gZenBoostsManager.addZapSelectorToActive(
            data.selector,
            data.domain
          );
        } else if (data.action == "remove") {
          lazy.gZenBoostsManager.removeZapSelectorToActive(
            data.selector,
            data.domain
          );
        } else if (data.action == "clear") {
          lazy.gZenBoostsManager.clearZapSelectorsForActive(data.domain);
        }
        break;
      }
      case "ZenBoost:GetBoostForDomain": {
        const domain = message.data;
        const embedder = this.browsingContext.top.embedderElement;

        if (!embedder || !domain) {
          break;
        }

        const exists = lazy.gZenBoostsManager.registeredBoostForDomain(domain);
        if (!exists) {
          break;
        }

        const boost = lazy.gZenBoostsManager.loadActiveBoostFromStore(domain);
        let workspaceGradient = [];
        if (boost.boostEntry.boostData.autoTheme) {
          const currentWorkspace =
            await this.browsingContext.topChromeWindow.gZenWorkspaces.getActiveWorkspace();
          workspaceGradient = currentWorkspace.theme.gradientColors;
        }

        const styleData =
          await lazy.gZenBoostsManager.getStyleSheetForBoost(domain);

        return {
          ...boost,
          workspaceGradient,
          styleSheet: styleData
            ? {
                uuid: styleData.uuid,
                uri: styleData.uri.spec,
              }
            : null,
        };
      }
      default: {
        console.warn(`[ZenBoostsParent]: Unknown message: ${message.name}`);
        break;
      }
    }

    return null;
  }
}
