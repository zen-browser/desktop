/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { isUnloadSafe } from "moz-src:///peppermint/common/PeppermintTabs.sys.mjs";

const PREF_ENABLED = "zen.underpowered.enabled";
const PREF_SAVED = "zen.underpowered.saved-prefs";
const PREF_AUTO = "zen.underpowered.auto-on-battery";
const PREF_THRESHOLD = "zen.underpowered.battery-threshold";
const PREF_AUTO_ENABLED = "zen.underpowered.auto-enabled";
const ROOT_ATTRIBUTE = "zen-underpowered";
const BUTTON_ID = "zen-underpowered-button";
const TOAST_ID = "zen-underpowered-enabled-toast";
const TOAST_TIMEOUT_MS = 1800;
// Lets tab switches and Glance settle before the tab left behind is frozen.
const FREEZE_DELAY_MS = 250;

// Every one of these is read live, so none of them waits for a restart.
const LIMITS = {
  "dom.ipc.processCount": 1,
  "dom.ipc.processCount.webIsolated": 1,
  "dom.ipc.processPrelaunch.enabled": false,
  "dom.ipc.keepProcessesAlive.web": 0,
  "dom.min_background_timeout_value": 10000,
  "image.animation_mode": "none",
  "network.prefetch-next": false,
  "network.dns.disablePrefetch": true,
  "network.http.max-connections": 128,
  "browser.cache.memory.capacity": 16384,
  "layout.throttled_frame_rate": 1,
  "ui.prefersReducedMotion": 1,
  "browser.sessionstore.interval": 120000,
};

/**
 * @param {string} name
 * @returns {boolean|number|string|null} The pref's user value, or null when
 *   it is on its default.
 */
function readUserValue(name) {
  if (!Services.prefs.prefHasUserValue(name)) {
    return null;
  }
  switch (Services.prefs.getPrefType(name)) {
    case Ci.nsIPrefBranch.PREF_BOOL:
      return Services.prefs.getBoolPref(name);
    case Ci.nsIPrefBranch.PREF_INT:
      return Services.prefs.getIntPref(name);
    case Ci.nsIPrefBranch.PREF_STRING:
      return Services.prefs.getStringPref(name);
  }
  return null;
}

function writeValue(name, value) {
  switch (typeof value) {
    case "boolean":
      Services.prefs.setBoolPref(name, value);
      break;
    case "number":
      Services.prefs.setIntPref(name, value);
      break;
    default:
      Services.prefs.setStringPref(name, value);
  }
}

/**
 * App-wide Underpowered mode. While it is on, every window keeps only what is
 * on screen loaded, and a set of resource prefs is tightened; turning it off
 * puts both back.
 */
class ZenUnderpoweredImpl {
  #initialized = false;
  #enabled = false;
  /** @type {Map<Window, object>} */
  #windows = new Map();
  /** Tabs this mode unloaded, the only ones it loads again. */
  #frozen = new WeakSet();
  #freezing = new WeakSet();
  #battery = null;
  #batteryHost = null;
  #onLevel = null;
  #onCharging = null;
  #batteryToken = 0;
  #writingAuto = false;
  #dismissed = false;
  /**
   * Tests replace this with a function that returns a battery manager.
   *
   * @type {(() => object|Promise<object>)|null}
   */
  _batterySource = null;

  init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
    Services.prefs.addObserver(PREF_ENABLED, this);
    Services.prefs.addObserver(PREF_AUTO, this);
    Services.obs.addObserver(this, "browser-delayed-startup-finished");
    this.#update(true);
    this.#syncBattery();
  }

  observe(subject, topic, data) {
    if (topic === "browser-delayed-startup-finished") {
      if (this.#enabled) {
        this.#attach(subject);
      } else {
        this.#syncChrome(subject);
      }
      return;
    }
    if (data === PREF_AUTO) {
      this.#syncBattery();
      return;
    }
    if (data === PREF_ENABLED && !this.#writingAuto) {
      this.#noteManualToggle();
    }
    this.#update();
  }

  /**
   * Re-read the battery. Tests await this after installing `_batterySource`.
   *
   * @returns {Promise<void>}
   */
  syncBatteryForTests() {
    return this.#syncBattery();
  }

  /**
   * @param {Element} button - The Underpowered toolbar button
   */
  syncButton(button) {
    const enabled = Services.prefs.getBoolPref(PREF_ENABLED, false);
    if (enabled) {
      button.setAttribute("checked", "true");
    } else {
      button.removeAttribute("checked");
    }
    button.setAttribute("aria-pressed", String(enabled));
  }

  #update(startup = false) {
    const enabled = Services.prefs.getBoolPref(PREF_ENABLED, false);
    if (!startup && enabled === this.#enabled) {
      return;
    }
    this.#enabled = enabled;
    if (enabled) {
      this.#applyLimits();
      if (!startup) {
        Services.obs.notifyObservers(null, "memory-pressure", "heap-minimize");
      }
    } else {
      // Also covers a snapshot left over from a session that ended mid-mode.
      this.#restoreLimits();
    }
    for (const win of this.#browserWindows()) {
      if (enabled) {
        this.#attach(win);
      } else {
        this.#detach(win);
      }
    }
    if (!enabled) {
      this.#frozen = new WeakSet();
    } else if (!startup) {
      this.#announce();
    }
  }

  #announce() {
    const win = Services.wm.getMostRecentBrowserWindow();
    win?.gZenUIManager?.showToast(TOAST_ID, {
      descriptionId: "zen-underpowered-enabled-toast-description",
      timeout: TOAST_TIMEOUT_MS,
      frosted: true,
    });
  }

  *#browserWindows() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (!win.closed && win.gBrowserInit?.delayedStartupFinished) {
        yield win;
      }
    }
  }

  // Battery

  #noteManualToggle() {
    const enabled = Services.prefs.getBoolPref(PREF_ENABLED, false);
    if (enabled || !Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false)) {
      return;
    }
    // The user turned off a session we started. Stay off until they plug in.
    this.#dismissed = true;
    this.#writeOwned(false);
  }

  #writeOwned(owned) {
    this.#writingAuto = true;
    try {
      Services.prefs.setBoolPref(PREF_AUTO_ENABLED, owned);
    } finally {
      this.#writingAuto = false;
    }
  }

  #setFromBattery(enabled) {
    this.#writingAuto = true;
    try {
      Services.prefs.setBoolPref(PREF_AUTO_ENABLED, enabled);
      Services.prefs.setBoolPref(PREF_ENABLED, enabled);
    } finally {
      this.#writingAuto = false;
    }
  }

  #batteryWindow() {
    if (this._batterySource) {
      return null;
    }
    try {
      const hidden = Services.appShell.hiddenDOMWindow;
      if (hidden && typeof hidden.navigator?.getBattery === "function") {
        this.#batteryHost = hidden;
        return hidden;
      }
    } catch {
      // The hidden window is not available yet.
    }
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win.closed || typeof win.navigator?.getBattery !== "function") {
        continue;
      }
      if (!win.__zenUnderpoweredBatteryUnload) {
        win.__zenUnderpoweredBatteryUnload = true;
        win.addEventListener(
          "unload",
          () => {
            if (this.#batteryHost === win) {
              this.#batteryHost = null;
              this.#syncBattery();
            }
          },
          { once: true }
        );
      }
      this.#batteryHost = win;
      return win;
    }
    this.#batteryHost = null;
    return null;
  }

  #dropBattery() {
    if (this.#battery) {
      this.#battery.removeEventListener("levelchange", this.#onLevel);
      this.#battery.removeEventListener("chargingchange", this.#onCharging);
    }
    this.#battery = null;
    this.#onLevel = null;
    this.#onCharging = null;
  }

  async #syncBattery() {
    const token = ++this.#batteryToken;
    this.#dropBattery();
    if (!Services.prefs.getBoolPref(PREF_AUTO, false)) {
      this.#dismissed = false;
      if (Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false)) {
        this.#writeOwned(false);
      }
      return;
    }
    let battery = null;
    try {
      if (this._batterySource) {
        battery = await this._batterySource();
      } else {
        const win = this.#batteryWindow();
        if (win) {
          battery = await win.navigator.getBattery();
        }
      }
    } catch (error) {
      console.error("ZenUnderpowered could not read the battery", error);
      return;
    }
    if (token !== this.#batteryToken || !battery) {
      return;
    }
    this.#onLevel = () => this.#onBatteryEvent("levelchange");
    this.#onCharging = () => this.#onBatteryEvent("chargingchange");
    battery.addEventListener("levelchange", this.#onLevel);
    battery.addEventListener("chargingchange", this.#onCharging);
    this.#battery = battery;
    this.#applyBattery(battery);
  }

  #onBatteryEvent(type) {
    const battery = this.#battery;
    if (!battery) {
      return;
    }
    if (type === "chargingchange" && battery.charging) {
      this.#dismissed = false;
    }
    this.#applyBattery(battery);
  }

  #applyBattery(battery) {
    if (!Services.prefs.getBoolPref(PREF_AUTO, false)) {
      return;
    }
    const threshold = Services.prefs.getIntPref(PREF_THRESHOLD, 20) / 100;
    const low = battery.level < threshold && !battery.charging;
    const enabled = Services.prefs.getBoolPref(PREF_ENABLED, false);
    const owned = Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false);
    if (low) {
      if (!enabled && !this.#dismissed) {
        this.#setFromBattery(true);
      }
      return;
    }
    if (battery.charging && owned) {
      this.#setFromBattery(false);
    }
  }

  // Resource limits

  #readSnapshot() {
    try {
      return JSON.parse(Services.prefs.getStringPref(PREF_SAVED, "{}")) ?? {};
    } catch (error) {
      console.error("ZenUnderpowered: unreadable saved prefs", error);
      return {};
    }
  }

  #applyLimits() {
    // Recorded before anything changes, and never overwritten while the mode
    // is on, so a restart cannot mistake the lowered values for the originals.
    const saved = this.#readSnapshot();
    let added = false;
    for (const name of Object.keys(LIMITS)) {
      if (!(name in saved)) {
        saved[name] = readUserValue(name);
        added = true;
      }
    }
    if (added) {
      Services.prefs.setStringPref(PREF_SAVED, JSON.stringify(saved));
    }
    for (const [name, value] of Object.entries(LIMITS)) {
      try {
        writeValue(name, value);
      } catch (error) {
        console.error(`ZenUnderpowered: could not set ${name}`, error);
      }
    }
  }

  #restoreLimits() {
    if (!Services.prefs.prefHasUserValue(PREF_SAVED)) {
      return;
    }
    for (const [name, value] of Object.entries(this.#readSnapshot())) {
      try {
        if (value === null) {
          Services.prefs.clearUserPref(name);
        } else {
          writeValue(name, value);
        }
      } catch (error) {
        console.error(`ZenUnderpowered: could not restore ${name}`, error);
      }
    }
    Services.prefs.clearUserPref(PREF_SAVED);
  }

  // Windows

  #syncChrome(win) {
    const enabled = Services.prefs.getBoolPref(PREF_ENABLED, false);
    win.document.documentElement.toggleAttribute(ROOT_ATTRIBUTE, enabled);
    const button = win.document.getElementById(BUTTON_ID);
    if (button) {
      this.syncButton(button);
    }
  }

  #attach(win) {
    this.#syncChrome(win);
    if (!this.#windows.has(win)) {
      const { STATE_STOP, STATE_IS_WINDOW } = Ci.nsIWebProgressListener;
      const state = {
        timer: 0,
        onTabSelect: () => this.#scheduleFreeze(win),
        onUnload: () => {
          win.clearTimeout(state.timer);
          this.#windows.delete(win);
        },
        progressListener: {
          onStateChange: (browser, webProgress, request, flags) => {
            if (
              webProgress?.isTopLevel &&
              flags & STATE_STOP &&
              flags & STATE_IS_WINDOW
            ) {
              this.#scheduleFreeze(win);
            }
          },
        },
      };
      this.#windows.set(win, state);
      win.gBrowser.addTabsProgressListener(state.progressListener);
      win.gBrowser.tabContainer.addEventListener(
        "TabSelect",
        state.onTabSelect
      );
      win.addEventListener("unload", state.onUnload, { once: true });
    }
    this.#scheduleFreeze(win);
  }

  #detach(win) {
    this.#syncChrome(win);
    const state = this.#windows.get(win);
    if (state) {
      this.#windows.delete(win);
      win.clearTimeout(state.timer);
      win.gBrowser.removeTabsProgressListener(state.progressListener);
      win.gBrowser.tabContainer.removeEventListener(
        "TabSelect",
        state.onTabSelect
      );
      win.removeEventListener("unload", state.onUnload);
    }
    this.#thaw(win);
  }

  // Freezing

  #scheduleFreeze(win) {
    const state = this.#windows.get(win);
    if (!state) {
      return;
    }
    win.clearTimeout(state.timer);
    state.timer = win.setTimeout(() => {
      state.timer = 0;
      this.#freezeWindow(win);
    }, FREEZE_DELAY_MS);
  }

  #freezeWindow(win) {
    if (win.closed || !this.#windows.has(win)) {
      return;
    }
    const selected = win.gBrowser.selectedTab;
    for (const tab of win.gBrowser.tabs) {
      if (this.#canFreeze(tab, selected)) {
        this.#freezeTab(win, tab);
      }
    }
  }

  /**
   * @param {MozTabbrowserTab} tab
   * @param {MozTabbrowserTab} selected - The window's selected tab
   * @returns {boolean} Whether the tab is live, off screen, and safe to unload
   */
  #canFreeze(tab, selected) {
    return isUnloadSafe(tab, selected);
  }

  async #freezeTab(win, tab) {
    if (this.#freezing.has(tab)) {
      return;
    }
    this.#freezing.add(tab);
    try {
      // Session state has to be current before the browser goes away.
      await win.gBrowser.prepareDiscardBrowser(tab);
      if (
        this.#windows.has(win) &&
        this.#canFreeze(tab, win.gBrowser.selectedTab) &&
        // Not forced: a beforeunload handler or open dialog keeps the tab.
        win.gBrowser.discardBrowser(tab)
      ) {
        this.#frozen.add(tab);
      }
    } catch (error) {
      console.error("ZenUnderpowered: could not freeze tab", error);
    } finally {
      this.#freezing.delete(tab);
    }
  }

  #thaw(win) {
    const { gBrowser } = win;
    const tabs = gBrowser.tabs.filter(
      tab =>
        this.#frozen.has(tab) && tab.hasAttribute("pending") && !tab.closing
    );
    if (!tabs.length) {
      return;
    }
    for (const tab of tabs) {
      gBrowser.insertBrowser(tab);
    }
    // SessionStore restores the content of every tab named in this event. Not
    // bubbling, so it reaches SessionStore on the tab container and nothing
    // that tracks split views on the window.
    gBrowser.tabContainer.dispatchEvent(
      new win.CustomEvent("TabSplitViewActivate", { detail: { tabs } })
    );
  }
}

export const ZenUnderpowered = new ZenUnderpoweredImpl();
