/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF = "zen.tab-unloader.timeout-minutes";
const CHECK_INTERVAL_MS = 3 * 60 * 1000;

/**
 * Unloads background tabs that have been idle longer than
 * zen.tab-unloader.timeout-minutes. One scheduler for the whole process.
 * Pinned tabs, essentials, the selected tab, its split-view partners,
 * Glance overlays, and tabs playing sound stay loaded. 0 disables it.
 */
class ZenTabUnloaderImpl {
  #started = false;
  #timer = null;

  start() {
    if (this.#started) {
      return;
    }
    this.#started = true;
    Services.prefs.addObserver(PREF, this);
    this.#arm();
  }

  observe() {
    this.#arm();
  }

  #arm() {
    if (this.#timer) {
      this.#timer.cancel();
      this.#timer = null;
    }
    if (Services.prefs.getIntPref(PREF, 10) <= 0) {
      return;
    }
    this.#timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.#timer.initWithCallback(
      () => {
        ChromeUtils.idleDispatch(() => {
          try {
            this.#unloadIdleTabs();
          } catch (error) {
            console.error("ZenTabUnloader failed", error);
          }
          this.#arm();
        });
      },
      CHECK_INTERVAL_MS,
      Ci.nsITimer.TYPE_ONE_SHOT
    );
  }

  #shouldKeep(tab, selected) {
    if (!tab || tab.closing || tab === selected) {
      return true;
    }
    if (tab.pinned || tab.hasAttribute("zen-essential")) {
      return true;
    }
    if (tab.hasAttribute("zen-glance-tab") || tab.hasAttribute("glance-id")) {
      return true;
    }
    if (tab.hasAttribute("pending")) {
      return true;
    }
    if (tab.soundPlaying || tab.hasAttribute("soundplaying")) {
      return true;
    }
    const group = tab.group;
    if (group?.hasAttribute("split-view-group") && selected?.group === group) {
      return true;
    }
    return false;
  }

  #unloadIdleTabs() {
    const minutes = Services.prefs.getIntPref(PREF, 10);
    if (minutes <= 0) {
      return;
    }
    const cutoff = Date.now() - minutes * 60 * 1000;
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win.closed || !win.gBrowser) {
        continue;
      }
      const selected = win.gBrowser.selectedTab;
      const stale = [];
      for (const tab of win.gBrowser.tabs) {
        if (this.#shouldKeep(tab, selected)) {
          continue;
        }
        const last = tab.lastAccessed || 0;
        if (!last || last > cutoff) {
          continue;
        }
        stale.push(tab);
      }
      if (stale.length) {
        win.gBrowser.explicitUnloadTabs(stale).catch(error => {
          console.error("ZenTabUnloader could not unload tabs", error);
        });
      }
    }
  }
}

export const ZenTabUnloader = new ZenTabUnloaderImpl();
