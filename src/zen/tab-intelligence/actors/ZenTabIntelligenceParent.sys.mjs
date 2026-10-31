// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenTabIntelligenceManager:
    "resource:///modules/zen/intelligence/ZenTabIntelligenceManager.sys.mjs",
});

export class ZenTabIntelligenceParent extends JSWindowActorParent {
  async receiveMessage(message) {
    if (message.name === "ZenTabIntelligence:StatusUpdate") {
      const browser = this.browsingContext?.top?.embedderElement;
      const win = this.browsingContext?.topChromeWindow;
      if (!browser || !win || !win.gBrowser) {
        return;
      }

      const tab = win.gBrowser.getTabForBrowser(browser);
      if (!tab) {
        return;
      }

      lazy.ZenTabIntelligenceManager.onTabStatusUpdate(tab, message.data, this);
    }
  }

  async requestDetails() {
    try {
      return await this.sendQuery("ZenTabIntelligence:RequestDetails");
    } catch (e) {
      console.warn("[ZenTabIntelligenceParent] requestDetails failed:", e);
      return { items: [] };
    }
  }
}
