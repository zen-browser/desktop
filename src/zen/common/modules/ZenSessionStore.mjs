// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenPreloadedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

class ZenSessionStore extends nsZenPreloadedFeature {
  #initialized = Promise.withResolvers();

  init() {
    SessionStore.promiseInitialized.then(() => this.#initialized.resolve());
  }

  /**
   * Resolves once Firefox's SessionStore has finished initializing.
   */
  get promiseInitialized() {
    return this.#initialized.promise;
  }

  restoreInitialTabData(tab, tabData) {
    if (tabData.zenWorkspace) {
      tab.setAttribute("zen-workspace-id", tabData.zenWorkspace);
    }
    if (tabData.zenLiveFolderItemId) {
      tab.setAttribute("zen-live-folder-item-id", tabData.zenLiveFolderItemId);
    }
    // Keep for now, for backward compatibility for window sync to work.
    if (tabData.zenSyncId || tabData.zenPinnedId) {
      tab.setAttribute("id", tabData.zenSyncId || tabData.zenPinnedId);
    }
    if (typeof tabData.zenStaticLabel === "string") {
      tab.zenStaticLabel = tabData.zenStaticLabel;
    }
    if (tabData.zenHasStaticIcon && tabData.image) {
      tab.zenStaticIcon = tabData.image;
    }
    if (tabData.zenEssential) {
      tab.setAttribute("zen-essential", "true");
    }
    if (tabData.zenDefaultUserContextId) {
      tab.setAttribute("zenDefaultUserContextId", "true");
    }
    if (tabData._zenPinnedInitialState) {
      tab._zenPinnedInitialState = tabData._zenPinnedInitialState;
    }
  }
}

window.gZenSessionStore = new ZenSessionStore();
