// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const ACTIVATION_METHODS = ["ctrl", "alt", "shift", "meta"];

export class ZenSplitViewParent extends JSWindowActorParent {
  /**
   * Re-check the preferences the child used to decide, so a split can never
   * outlive the feature being turned off or rebound to Glance's modifier.
   *
   * @returns {boolean} True if splitting on click is currently available.
   */
  #canSplitOnClick() {
    const method = Services.prefs.getStringPref(
      "zen.splitView.link-activation-method",
      "shift"
    );
    if (!ACTIVATION_METHODS.includes(method)) {
      return false;
    }
    return !(
      Services.prefs.getBoolPref("zen.glance.enabled", true) &&
      Services.prefs.getStringPref("zen.glance.activation-method", "ctrl") ===
        method
    );
  }

  /**
   * The tab the click happened in, which is not always the selected tab: in an
   * existing split, links can be clicked in whichever pane is not focused.
   *
   * @param {ChromeWindow} window - The chrome window hosting the tab.
   * @returns {Tab|null} The tab, or null if it could not be resolved.
   */
  #getSourceTab(window) {
    const browser = this.browsingContext.top.embedderElement;
    if (!browser) {
      return null;
    }
    return window?.gBrowser?.getTabForBrowser(browser) ?? null;
  }

  receiveMessage(message) {
    switch (message.name) {
      case "ZenSplitView:OpenInSplit": {
        if (!this.#canSplitOnClick()) {
          return;
        }
        const window = this.browsingContext.topChromeWindow;
        window?.gZenViewSplitter?.splitLinkFromURL(message.data.url, {
          triggeringPrincipal: message.data.triggeringPrincipal,
          sourceTab: this.#getSourceTab(window),
        });
        break;
      }
      default:
        console.warn(`[split-view]: Unknown message: ${message.name}`);
    }
  }
}
