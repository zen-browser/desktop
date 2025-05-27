// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  class ZenSessionStore extends ZenPreloadedFeature {
    init() {
      this.#waitAndCleanup();
    }

    #glanceTabs = {};
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
      if (tabData.zenIsEmpty) {
        tab.setAttribute('zen-empty-tab', 'true');
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
      if (tabData.zenGlanceId) {
        // We just found the background used for glance. Find
        // the current
        if (tabData.zenIsGlance) {
          if (this.#glanceTabs[tabData.zenGlanceId]) {
            this.#glanceTabs[tabData.zenGlanceId].tab = tab;
          } else {
            this.#glanceTabs[tabData.zenGlanceId] = {
              tab: tab,
              background: null,
            };
          }
        } else {
          if (this.#glanceTabs[tabData.zenGlanceId]) {
            this.#glanceTabs[tabData.zenGlanceId].background = tab;
          } else {
            this.#glanceTabs[tabData.zenGlanceId] = {
              tab: null,
              background: tab,
            };
          }
        }
      }
    }

    async #resolveGlanceTabs() {
      for (const [id, data] of Object.entries(this.#glanceTabs)) {
        const { tab, background } = data;
        // TODO(Restore glance tab): Finish this implementation
        continue;

        if (!tab || !background) {
          tab?.removeAttribute('glance-id');
          background?.removeAttribute('glance-id');
          continue;
        }
        console.log(tab, background);
        const browserRect = gBrowser.tabbox.getBoundingClientRect();
        await gZenGlanceManager.openGlance(
          {
            url: undefined,
            clientX: browserRect.width / 2,
            clientY: browserRect.height / 2,
            width: 0,
            height: 0,
          },
          tab,
          background
        );
      }
    }

    async #waitAndCleanup() {
      await SessionStore.promiseInitialized;
      await this.#resolveGlanceTabs();
      this.#cleanup();
    }

    #cleanup() {
      this._resolveInitialized();
      delete window.gZenSessionStore;
    }
  }

  window.gZenSessionStore = new ZenSessionStore();
}
