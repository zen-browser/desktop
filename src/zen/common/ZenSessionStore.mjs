// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  class ZenSessionStore extends nsZenPreloadedFeature {
    init() {
      this.#waitAndCleanup();
    }

    promiseInitialized = new Promise((resolve) => {
      this._resolveInitialized = resolve;
    });

    restoreInitialTabData(tab, tabData) {
      if (tabData.zenWorkspace) {
        tab.setAttribute('zen-workspace-id', tabData.zenWorkspace);
      }
      if (tabData.zenPinnedId) {
        tab.setAttribute('zen-pin-id', tabData.zenPinnedId);
      }
      if (tabData.zenHasStaticLabel) {
        tab.setAttribute('zen-has-static-label', 'true');
      }
      if (tabData.zenEssential) {
        tab.setAttribute('zen-essential', 'true');
      }
      if (tabData.zenDefaultUserContextId) {
        tab.setAttribute('zenDefaultUserContextId', 'true');
      }
      if (tabData.zenPinnedEntry) {
        tab.setAttribute('zen-pinned-entry', tabData.zenPinnedEntry);
      }
    }

    async #waitAndCleanup() {
      await SessionStore.promiseInitialized;
      this.#cleanup();
    }

    #cleanup() {
      this._resolveInitialized();
    }
  }

  window.gZenSessionStore = new ZenSessionStore();
}
