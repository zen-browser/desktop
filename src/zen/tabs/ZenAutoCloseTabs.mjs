// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};

const PREF_ENABLED = "zen.tabs.auto-close.enabled";
const PREF_THRESHOLD_HOURS = "zen.tabs.auto-close.threshold-hours";
const PREF_SKIP_AUDIBLE = "zen.tabs.auto-close.skip-audible";
const PREF_MIN_PER_WORKSPACE = "zen.tabs.auto-close.min-tabs-per-workspace";
const PREF_CHECK_INTERVAL_MIN = "zen.tabs.auto-close.check-interval-minutes";

class nsZenAutoCloseTabs extends nsZenDOMOperatedFeature {
  #timeoutId = null;
  #enabledObserver = null;

  init() {
    // eslint-disable-next-line mozilla/valid-lazy
    XPCOMUtils.defineLazyPreferenceGetter(lazy, "enabled", PREF_ENABLED, false);
    XPCOMUtils.defineLazyPreferenceGetter(lazy, "thresholdHours", PREF_THRESHOLD_HOURS, 168);
    XPCOMUtils.defineLazyPreferenceGetter(lazy, "skipAudible", PREF_SKIP_AUDIBLE, true);
    XPCOMUtils.defineLazyPreferenceGetter(lazy, "minPerWorkspace", PREF_MIN_PER_WORKSPACE, 1);
    XPCOMUtils.defineLazyPreferenceGetter(lazy, "checkIntervalMin", PREF_CHECK_INTERVAL_MIN, 15);

    this.#enabledObserver = () => this.#reschedule();
    Services.prefs.addObserver(PREF_ENABLED, this.#enabledObserver);
    Services.prefs.addObserver(PREF_CHECK_INTERVAL_MIN, this.#enabledObserver);

    window.addEventListener(
      "unload",
      () => {
        Services.prefs.removeObserver(PREF_ENABLED, this.#enabledObserver);
        Services.prefs.removeObserver(PREF_CHECK_INTERVAL_MIN, this.#enabledObserver);
        this.#cancel();
      },
      { once: true }
    );

    this.#reschedule();
  }

  #reschedule() {
    this.#cancel();
    if (!lazy.enabled) return;
    const delayMs = Math.max(1, lazy.checkIntervalMin) * 60 * 1000;
    this.#timeoutId = setTimeout(() => {
      this.#timeoutId = null;
      this.#sweep().finally(() => this.#reschedule());
    }, delayMs);
  }

  #cancel() {
    if (this.#timeoutId !== null) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
  }

  #isEligible(tab) {
    if (!tab.visible) return false;
    if (tab.pinned) return false; // covers Essentials
    if (tab.selected) return false;
    if (tab.busy) return false;
    if (tab.hasAttribute("zen-empty-tab")) return false;
    if (tab.hasAttribute("zen-glance-tab")) return false;
    // v1: skip any grouped tab (folders + split-view)
    if (tab.group) return false;
    if (lazy.skipAudible && tab.audible) return false;
    return true;
  }

  async #sweep() {
    if (!lazy.enabled || !window.gZenWorkspaces || !window.gBrowser) return;

    const cutoff = Date.now() - lazy.thresholdHours * 60 * 60 * 1000;
    const floor = Math.max(0, lazy.minPerWorkspace);

    // Group eligible tabs by workspace.
    const byWorkspace = new Map();
    const liveCountByWorkspace = new Map();

    for (const tab of gZenWorkspaces.allStoredTabs) {
      const wsId = tab.getAttribute("zen-workspace-id") || "";
      if (!tab.pinned && tab.visible) {
        liveCountByWorkspace.set(wsId, (liveCountByWorkspace.get(wsId) || 0) + 1);
      }
      if (!this.#isEligible(tab)) continue;
      const lastAccessed = tab.lastAccessed || 0;
      if (!lastAccessed || lastAccessed >= cutoff) continue;
      if (!byWorkspace.has(wsId)) byWorkspace.set(wsId, []);
      byWorkspace.get(wsId).push(tab);
    }

    const victims = [];
    for (const [wsId, candidates] of byWorkspace) {
      const live = liveCountByWorkspace.get(wsId) || 0;
      const maxClosable = Math.max(0, live - floor);
      if (maxClosable === 0) continue;
      candidates.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
      victims.push(...candidates.slice(0, maxClosable));
    }

    if (!victims.length) return;

    gBrowser.removeTabs(victims, {
      animate: false,
      closeWindowWithLastTab: false,
      skipPermitUnload: false,
    });

    const shortcut = gZenKeyboardShortcutsManager.getShortcutDisplayFromCommand(
      "History:RestoreLastClosedTabOrWindowOrSession"
    );

    gZenUIManager.showToast("zen-tabs-auto-close-toast", {
      l10nArgs: { count: victims.length, shortcut },
    });
  }
}

window.gZenAutoCloseTabs = new nsZenAutoCloseTabs();
