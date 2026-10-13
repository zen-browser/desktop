/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF_ENABLED = "zen.underpowered.enabled";
const PREF_SAVED = "zen.underpowered.saved-prefs";
const ROOT_ATTRIBUTE = "zen-underpowered";
const BUTTON_ID = "zen-underpowered-button";
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

  init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
    Services.prefs.addObserver(PREF_ENABLED, this);
    Services.obs.addObserver(this, "browser-delayed-startup-finished");
    this.#update(true);
  }

  observe(subject, topic) {
    if (topic === "browser-delayed-startup-finished") {
      if (this.#enabled) {
        this.#attach(subject);
      } else {
        this.#syncChrome(subject);
      }
      return;
    }
    this.#update();
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
    }
  }

  *#browserWindows() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (!win.closed && win.gBrowserInit?.delayedStartupFinished) {
        yield win;
      }
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
    if (
      !tab ||
      tab === selected ||
      tab.closing ||
      !tab.linkedPanel ||
      tab.hasAttribute("pending") ||
      // Still loading: frozen once it stops, so its session entry is complete.
      tab.hasAttribute("busy") ||
      tab.hasAttribute("zen-empty-tab") ||
      tab.hasAttribute("pictureinpicture") ||
      tab.isEmpty
    ) {
      return false;
    }
    if (tab.linkedBrowser?.zenModeActive) {
      return false;
    }
    const group = tab.group;
    if (group?.hasAttribute("split-view-group") && group === selected.group) {
      return false;
    }
    const glanceId = selected.getAttribute("glance-id");
    return !glanceId || tab.getAttribute("glance-id") !== glanceId;
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
