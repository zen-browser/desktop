// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  cancelIdleCallback,
  clearTimeout,
  requestIdleCallback,
  setTimeout,
} from 'resource://gre/modules/Timer.sys.mjs';

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenSessionFile: 'resource://gre/modules/ZenSessionFile.sys.mjs',
  PrivateBrowsingUtils: 'resource://gre/modules/PrivateBrowsingUtils.sys.mjs',
  RunState: 'resource:///modules/sessionstore/RunState.sys.mjs',
});

class nsZenSessionManager {
  #file;

  constructor() {
    this.#file = null;
  }

  get file() {
    if (!this.#file) {
      this.#file = lazy.ZenSessionFile;
    }
    return this.#file;
  }

  /**
   * Saves the current session state. Collects data and writes to disk.
   *
   * @param forceUpdateAllWindows (optional)
   *        Forces us to recollect data for all windows and will bypass and
   *        update the corresponding caches.
   */
  saveState(forceUpdateAllWindows = false) {
    if (lazy.PrivateBrowsingUtils.permanentPrivateBrowsing) {
      // Don't save (or even collect) anything in permanent private
      // browsing mode
      return Promise.resolve();
    }
  }
}

export const ZenSessionStore = new nsZenSessionManager();
