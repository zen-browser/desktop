// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};

// The shortest threshold the settings offer is 12 hours, so looking more often
// than this would only burn wakeups.
const kSweepIntervalMs = 10 * 60 * 1000;

// Breathing room before the first sweep. The session has just been restored
// and its tabs carry the lastAccessed they had when the browser quit, so
// without this a window could lose tabs before it is even usable.
const kStartupGraceMs = 2 * 60 * 1000;

/**
 * Closes tabs that have not been looked at for a while, so that a space goes
 * back to being the handful of tabs actually in use instead of everything ever
 * opened in it. Pinned tabs and Essentials are never touched: they are the
 * things kept on purpose.
 *
 * Off by default, one sweep per window.
 */
class nsZenAutoCloseTabs extends nsZenDOMOperatedFeature {
  /** Timer id of the pending sweep, or null when no sweep is armed. */
  #timer = null;

  /** Set once startup is far enough along for a sweep to be safe. */
  #ready = false;

  init() {
    if (PrivateBrowsingUtils.isWindowPrivate(window)) {
      // A closed private tab is gone for good, so there is nothing to undo a
      // sweep with. Leave private windows alone.
      return;
    }

    // eslint-disable-next-line mozilla/valid-lazy
    XPCOMUtils.defineLazyPreferenceGetter(
      lazy,
      "zenTabsAutoCloseEnabled",
      "zen.tabs.auto-close.enabled",
      false,
      () => this.#onEnabledChanged()
    );
    // eslint-disable-next-line mozilla/valid-lazy
    XPCOMUtils.defineLazyPreferenceGetter(
      lazy,
      "zenTabsAutoCloseAfterHours",
      "zen.tabs.auto-close.after-hours",
      168
    );

    window.addEventListener("unload", () => this.#disarm(), { once: true });
    this.#waitForStartup().catch(console.error);
  }

  /** How long a tab may go unused before it is closed, in milliseconds. */
  get thresholdMs() {
    // A non-positive threshold would close everything on sight; treat it as a
    // broken pref value and fall back to the default of a week.
    const hours =
      lazy.zenTabsAutoCloseAfterHours > 0
        ? lazy.zenTabsAutoCloseAfterHours
        : 168;
    return hours * 60 * 60 * 1000;
  }

  async #waitForStartup() {
    await delayedStartupPromise;
    await SessionStore.promiseAllWindowsRestored;
    await gZenWorkspaces.promiseInitialized;
    if (window.closed) {
      return;
    }
    this.#ready = true;
    this.#arm(kStartupGraceMs);
  }

  #onEnabledChanged() {
    if (lazy.zenTabsAutoCloseEnabled) {
      // Give the same grace period as at startup: turning the feature on is
      // usually followed by picking a threshold.
      this.#arm(kStartupGraceMs);
    } else {
      this.#disarm();
    }
  }

  #arm(delay) {
    this.#disarm();
    if (!this.#ready || !lazy.zenTabsAutoCloseEnabled) {
      return;
    }
    this.#timer = setTimeout(async () => {
      this.#timer = null;
      try {
        if (lazy.zenTabsAutoCloseEnabled) {
          await this.sweep();
        }
      } catch (ex) {
        console.error("Error auto-closing inactive tabs:", ex);
      }
      this.#arm(kSweepIntervalMs);
    }, delay);
  }

  #disarm() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  /**
   * Closes every tab in this window that has gone unused for longer than the
   * configured threshold.
   *
   * @returns {MozTabbrowserTab[]} The tabs that were closed.
   */
  async sweep() {
    const staleTabs = this.collectStaleTabs();
    if (!staleTabs.length) {
      return staleTabs;
    }
    // The candidates were filtered for beforeunload handlers already, so this
    // cannot put a dialog in front of someone who did not ask for one.
    gBrowser.removeTabs(staleTabs, {
      animate: false,
      closeWindowWithLastTab: false,
      skipPermitUnload: true,
    });
    return staleTabs;
  }

  /**
   * The tabs a sweep would close right now, split views included as a unit.
   *
   * @returns {MozTabbrowserTab[]}
   */
  collectStaleTabs() {
    const cutoff = Date.now() - this.thresholdMs;
    const staleTabs = [];
    const seenSplitViews = new Set();

    for (const tab of gZenWorkspaces.allStoredTabs) {
      if (!tab.splitView) {
        if (this.#canClose(tab) && tab.lastAccessed < cutoff) {
          staleTabs.push(tab);
        }
        continue;
      }
      // Half a split view cannot be closed on its own, so the whole thing goes
      // or nothing does. A split tab with no group left to speak for it is
      // skipped rather than guessed about.
      const splitView = tab.group;
      if (!splitView || seenSplitViews.has(splitView)) {
        continue;
      }
      seenSplitViews.add(splitView);
      const splitTabs = splitView.tabs;
      const lastUsed = Math.max(...splitTabs.map(t => t.lastAccessed));
      if (lastUsed < cutoff && splitTabs.every(t => this.#canClose(t))) {
        staleTabs.push(...splitTabs);
      }
    }

    return staleTabs;
  }

  /**
   * Whether a tab may be closed by a sweep, regardless of how old it is.
   *
   * @param {MozTabbrowserTab} tab
   * @returns {boolean}
   */
  #canClose(tab) {
    if (tab.pinned || tab.selected || tab.multiselected || tab.closing) {
      return false;
    }
    // Zen's own tabs: the placeholder of an empty space, and the tab a glance
    // is showing over its opener.
    if (
      tab.hasAttribute("zen-empty-tab") ||
      tab.hasAttribute("zen-glance-tab") ||
      tab.glanceTab
    ) {
      return false;
    }
    // Filing a tab in a folder is as deliberate as pinning it.
    if (tab.group?.isZenFolder) {
      return false;
    }
    for (const attribute of ["pictureinpicture", "soundplaying", "sharing"]) {
      if (tab.hasAttribute(attribute)) {
        return false;
      }
    }
    const browser = tab.linkedBrowser;
    if (
      window.webrtcUI.browserHasStreams(browser) ||
      browser?.browsingContext?.currentWindowGlobal?.hasActivePeerConnections()
    ) {
      return false;
    }
    // A page that wants to warn before it goes away probably holds something
    // unsaved. Skip it rather than prompting out of nowhere.
    return !this.#hasBeforeUnload(browser);
  }

  /**
   * Whether a tab, or anything framed inside it, listens for beforeunload.
   *
   * @param {MozBrowser} browser
   * @returns {boolean}
   */
  #hasBeforeUnload(browser) {
    const root = browser?.browsingContext;
    if (!root) {
      // An unloaded tab runs no script, so it has nothing to save.
      return false;
    }
    const contexts = [root];
    while (contexts.length) {
      const context = contexts.pop();
      if (context.currentWindowContext?.hasBeforeUnload) {
        return true;
      }
      contexts.push(...context.children);
    }
    return false;
  }
}

window.gZenAutoCloseTabs = new nsZenAutoCloseTabs();
