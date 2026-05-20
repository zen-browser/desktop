// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};

const PREF_ENABLED = "zen.tabs.auto-close.enabled";
const PREF_THRESHOLD_VALUE = "zen.tabs.auto-close.threshold-value";
const PREF_THRESHOLD_UNIT = "zen.tabs.auto-close.threshold-unit";
const PREF_SKIP_AUDIBLE = "zen.tabs.auto-close.skip-audible";
const PREF_CHECK_INTERVAL_MIN = "zen.tabs.auto-close.check-interval-minutes";

const UNIT_TO_MINUTES = { hours: 60, days: 1440 };

class nsZenAutoCloseTabs extends nsZenDOMOperatedFeature {
  #timeoutId = null;
  #enabledObserver = null;

  init() {
    // eslint-disable-next-line mozilla/valid-lazy
    XPCOMUtils.defineLazyPreferenceGetter(lazy, "enabled", PREF_ENABLED, false);
    XPCOMUtils.defineLazyPreferenceGetter(lazy, "thresholdValue", PREF_THRESHOLD_VALUE, 7);
    XPCOMUtils.defineLazyPreferenceGetter(lazy, "thresholdUnit", PREF_THRESHOLD_UNIT, "days");
    XPCOMUtils.defineLazyPreferenceGetter(lazy, "skipAudible", PREF_SKIP_AUDIBLE, true);
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
    if (lazy.skipAudible && tab.soundPlaying) return false;
    return true;
  }

  async #hasUnsavedState(tab) {
    if (tab.discarded) return false;
    try {
      const { permitUnload } = await tab.linkedBrowser.asyncPermitUnload("dontUnload");
      return !permitUnload;
    } catch {
      return true; // can't check, err on the side of leaving it alone
    }
  }

  async #sweep() {
    if (!lazy.enabled || !window.gZenWorkspaces || !window.gBrowser) return;

    const unitMinutes = UNIT_TO_MINUTES[lazy.thresholdUnit] ?? UNIT_TO_MINUTES.days;
    const cutoff = Date.now() - Math.max(1, lazy.thresholdValue) * unitMinutes * 60 * 1000;

    // Split-view tabs are judged as a unit: close both halves only when the
    // most-recently-used one is past the threshold AND no tab in the group is
    // protected. Other tabs are judged individually.
    const splitGroups = new Map();
    const singletons = [];

    for (const tab of gZenWorkspaces.allStoredTabs) {
      const splitGroup = tab.group?.hasAttribute("split-view-group") ? tab.group : null;
      if (splitGroup) {
        if (!splitGroups.has(splitGroup)) splitGroups.set(splitGroup, []);
        splitGroups.get(splitGroup).push(tab);
      } else if (this.#isEligible(tab)) {
        singletons.push(tab);
      }
    }

    const candidates = [];

    for (const tab of singletons) {
      const lastAccessed = tab.lastAccessed || 0;
      if (lastAccessed && lastAccessed < cutoff) candidates.push(tab);
    }

    for (const tabs of splitGroups.values()) {
      if (tabs.some((t) => !this.#isEligible(t))) continue;
      const maxAccessed = Math.max(...tabs.map((t) => t.lastAccessed || 0));
      if (maxAccessed && maxAccessed < cutoff) candidates.push(...tabs);
    }

    if (!candidates.length) return;

    // Skip tabs with unsaved state rather than prompting the user mid-sweep.
    const unsavedFlags = await Promise.all(candidates.map((t) => this.#hasUnsavedState(t)));
    const victims = candidates.filter((_, i) => !unsavedFlags[i]);

    if (!victims.length) return;

    gBrowser.removeTabs(victims, {
      animate: false,
      closeWindowWithLastTab: false,
      skipPermitUnload: true,
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
