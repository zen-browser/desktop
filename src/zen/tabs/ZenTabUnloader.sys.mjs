/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  TabUnloader: "moz-src:///browser/components/tabbrowser/TabUnloader.sys.mjs",
});

const TIMEOUT_PREF = "zen.tabs.unload-inactive-after-minutes";

// How often to look for inactive tabs once the first timeout has passed. A tab
// is unloaded at most this late after reaching the timeout.
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Unloads tabs that have not been used for a while, if the user opts in.
 *
 * Firefox's TabUnloader only discards tabs when the OS reports low memory, so
 * otherwise a tab stays loaded until the browser quits. This reuses its rules
 * (selected, playing media, WebRTC, Picture-in-Picture, private, undiscardable
 * tabs are kept) and adds the timeout plus a few Zen-specific exclusions.
 *
 * A single timer serves every window, and nothing runs while the pref is 0.
 */
class nsZenTabUnloader {
  #initialized = false;
  #timer = null;
  #isUnloading = false;

  /**
   * Tabs that refused to be discarded (e.g. a beforeunload handler or an open
   * dialog), mapped to their lastAccessed at that time. They are skipped until
   * they are used again, instead of being flushed and asked every minute.
   *
   * @type {WeakMap<MozTabbrowserTab, number>}
   */
  #refusedTabs = new WeakMap();

  init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
    Services.prefs.addObserver(TIMEOUT_PREF, this);
    Services.obs.addObserver(this, "wake_notification");
    this.#restart();
  }

  uninit() {
    if (!this.#initialized) {
      return;
    }
    this.#initialized = false;
    Services.prefs.removeObserver(TIMEOUT_PREF, this);
    Services.obs.removeObserver(this, "wake_notification");
    this.#cancel();
  }

  /**
   * @returns {number} The inactivity timeout in milliseconds, 0 if disabled.
   */
  get #timeoutMs() {
    return Math.max(Services.prefs.getIntPref(TIMEOUT_PREF, 0), 0) * 60 * 1000;
  }

  observe() {
    // Both a pref change and waking up from sleep restart the countdown.
    // lastAccessed is wall-clock time, so after a long sleep every tab looks
    // inactive: wait a full timeout so the user can get back to their tabs.
    this.#restart();
  }

  #restart() {
    this.#cancel();
    this.#schedule(this.#timeoutMs);
  }

  #cancel() {
    if (this.#timer) {
      lazy.clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  #schedule(aDelay) {
    if (!this.#initialized || !this.#timeoutMs) {
      return;
    }
    this.#timer = lazy.setTimeout(() => this.#onTimer(), aDelay);
  }

  async #onTimer() {
    this.#timer = null;
    try {
      await this.unloadInactiveTabs();
    } catch (e) {
      console.error("Failed to unload inactive tabs:", e);
    }
    // A pref change may have scheduled the next run in the meantime.
    if (!this.#timer) {
      this.#schedule(CHECK_INTERVAL_MS);
    }
  }

  /**
   * Discards every tab that has not been used within the timeout and that
   * TabUnloader considers discardable. Also called directly by tests.
   */
  async unloadInactiveTabs() {
    if (this.#isUnloading || !this.#hasCandidates()) {
      return;
    }
    this.#isUnloading = true;
    try {
      // Tabs used within the timeout are left out of the list.
      const sortedTabs = await lazy.TabUnloader.getSortedTabs(this.#timeoutMs);
      for (const tabInfo of sortedTabs) {
        // The list is sorted by weight, so no later tab is discardable either.
        if (!lazy.TabUnloader.isDiscardable(tabInfo)) {
          break;
        }
        const { tab, gBrowser } = tabInfo;
        if (!this.#mayUnload(tab, gBrowser)) {
          continue;
        }
        await gBrowser.prepareDiscardBrowser(tab);
        // The tab may have been used while its state was being flushed.
        if (!this.#mayUnload(tab, gBrowser)) {
          continue;
        }
        // Not forced, like TabUnloader: tabs whose page asks to confirm
        // leaving (e.g. unsaved form input) or that show a dialog stay loaded.
        if (!gBrowser.discardBrowser(tab)) {
          this.#refusedTabs.set(tab, tab.lastAccessed);
        }
      }
    } finally {
      this.#isUnloading = false;
    }
  }

  /**
   * A cheap pass so that the usual case, nothing new to unload, skips
   * TabUnloader's ranking, which can query the memory of every process.
   *
   * @returns {boolean} Whether any loaded tab may need to be unloaded.
   */
  #hasCandidates() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      for (const tab of win.gZenWorkspaces.allStoredTabs) {
        if (tab.linkedPanel && this.#mayUnload(tab, win.gBrowser)) {
          return true;
        }
      }
    }
    return false;
  }

  #mayUnload(aTab, aGBrowser) {
    const timeoutMs = this.#timeoutMs;
    return (
      // Also stops a run that is still going when the app quits.
      this.#initialized &&
      !!timeoutMs &&
      Date.now() - aTab.lastAccessed >= timeoutMs &&
      this.#refusedTabs.get(aTab) !== aTab.lastAccessed &&
      !this.#shouldKeepLoaded(aTab, aGBrowser)
    );
  }

  /**
   * Zen states that TabUnloader does not know about.
   *
   * @param {MozTabbrowserTab} aTab - The tab to check.
   * @param {object} aGBrowser - The tabbrowser of the tab's window.
   * @returns {boolean} Whether the tab must stay loaded.
   */
  #shouldKeepLoaded(aTab, aGBrowser) {
    return (
      // The placeholder shown in empty spaces. Zen's own unload actions leave
      // it alone too.
      aTab.hasAttribute("zen-empty-tab") ||
      // Glance shows a tab over its parent and expects both to be loaded.
      aTab.hasAttribute("glance-id") ||
      // Discarding one split view tab makes ZenViewSplitter unload the whole
      // group through explicitUnloadTabs, which can prompt the user.
      !!aTab.group?.hasAttribute("split-view-group") ||
      this.#hasSyncedCopyInOtherWindow(aTab, aGBrowser)
    );
  }

  /**
   * Window sync mirrors a tab into every synced window under the same id.
   * Only one copy holds the page, and the others swap it in when they show the
   * tab; that swap does not expect a discarded copy, so synced tabs stay
   * loaded while another window has a copy of them.
   *
   * @param {MozTabbrowserTab} aTab - The tab to check.
   * @param {object} aGBrowser - The tabbrowser of the tab's window.
   * @returns {boolean} Whether another window has a copy of the tab.
   */
  #hasSyncedCopyInOtherWindow(aTab, aGBrowser) {
    if (!aTab.id) {
      return false;
    }
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (
        win.gBrowser !== aGBrowser &&
        win.gBrowser?.isTab(win.document.getElementById(aTab.id))
      ) {
        return true;
      }
    }
    return false;
  }
}

export const ZenTabUnloader = new nsZenTabUnloader();
