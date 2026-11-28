// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  SessionStore:
    "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs",
});

XPCOMUtils.defineLazyServiceGetter(
  lazy,
  "contentPrefs",
  "@mozilla.org/content-pref/service;1",
  Ci.nsIContentPrefService2
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "maxVolumePercent",
  "zen.media.tab-volume.max",
  300
);

const DEFAULT_VOLUME = 1;
// Keep in sync with kMaxZenMediaVolume in nsZenMediaBCOverrides.cpp.
const HARD_MAX_VOLUME = 4;

const SESSION_KEY = "zen-tab-volume";
const SITE_PREF_NAME = "zen.media.tab-volume";

/**
 * Per-tab volume control.
 *
 * The volume itself lives on the tab's top browsing context
 * (`BrowsingContext.zenMediaVolume`), and Gecko applies it to everything the
 * tab plays, in every process. This component decides which volume a tab
 * should have and remembers it:
 *
 *  - per tab, as a session store value, so it survives restarts, undo close
 *    tab and duplication;
 *  - per site, in the content prefs database, so that going back to a site
 *    restores the volume it was last given.
 *
 * Same-site navigations keep the tab's volume. Cross-site navigations switch
 * to the volume remembered for the new site, or the default.
 */
export class ZenTabVolume extends ZenUIComponent {
  #enabled = false;

  // Per tab: the site the current volume belongs to, and a counter used to
  // drop site lookups that finished after the volume was decided otherwise.
  #tabStates = new WeakMap();

  init() {
    this.window.gZenTabVolume = this;
    this.#enabled = Services.prefs.getBoolPref(
      "zen.media.tab-volume.enabled",
      true
    );
    if (!this.#enabled) {
      return;
    }

    this.listenBrowserTabsProgress();

    // Tabs restored or loaded before delayed startup missed their location
    // change.
    for (const tab of this.window.gBrowser.tabs) {
      if (tab.linkedBrowser?.browsingContext) {
        this.#onTopLevelNavigation(tab, tab.linkedBrowser.currentURI);
      }
    }
  }

  get maxVolume() {
    const max = Math.min(
      Math.max(lazy.maxVolumePercent, 100),
      HARD_MAX_VOLUME * 100
    );
    return max / 100;
  }

  canControl(tab) {
    return (
      this.#enabled &&
      !!tab?.linkedBrowser?.browsingContext &&
      !tab.hasAttribute("zen-empty-tab")
    );
  }

  getVolume(tab) {
    const volume = tab?.linkedBrowser?.browsingContext?.zenMediaVolume;
    // The field is a float. Rounding drops the single precision noise.
    return volume === undefined
      ? DEFAULT_VOLUME
      : Math.round(volume * 100) / 100;
  }

  /**
   * Changes the volume of a tab right away. Meant for user changes, which win
   * over a site lookup that may still be running for the tab.
   *
   * @param {MozTabbrowserTab} tab
   * @param {number} volume - 1 is the volume the site plays at by itself.
   */
  setVolume(tab, volume) {
    if (!this.canControl(tab)) {
      return;
    }
    this.#nextGeneration(tab);
    this.#applyVolume(tab, volume);
  }

  /**
   * Remembers the current volume of a tab for its site. Called once the user
   * is done changing it, not on every step.
   *
   * @param {MozTabbrowserTab} tab
   * @returns {Promise<void>} Resolves once the value is stored.
   */
  saveSiteVolume(tab) {
    const browser = tab.linkedBrowser;
    const uri = browser?.currentURI;
    if (!this.canControl(tab) || !this.#siteFor(uri)) {
      return Promise.resolve();
    }

    const { promise, resolve } = Promise.withResolvers();
    const callback = { handleCompletion: () => resolve() };
    const volume = this.getVolume(tab);
    if (volume === DEFAULT_VOLUME) {
      lazy.contentPrefs.removeByDomainAndName(
        uri.spec,
        SITE_PREF_NAME,
        browser.loadContext,
        callback
      );
    } else {
      lazy.contentPrefs.set(
        uri.spec,
        SITE_PREF_NAME,
        volume,
        browser.loadContext,
        callback
      );
    }
    return promise;
  }

  onLocationChange(browser, webProgress, request, location, flags) {
    if (
      !webProgress.isTopLevel ||
      flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT
    ) {
      return;
    }
    const tab = this.window.gBrowser.getTabForBrowser(browser);
    if (tab) {
      this.#onTopLevelNavigation(tab, location);
    }
  }

  #onTopLevelNavigation(tab, uri) {
    // Initial and placeholder documents don't count. The real load that
    // follows decides.
    if (!uri || uri.spec === "about:blank") {
      return;
    }

    const site = this.#siteFor(uri);
    const state = this.#stateFor(tab);
    const tabVolume = this.#getTabValue(tab);

    // A tab with a volume of its own but no known site yet was restored or
    // duplicated. Its own volume wins over the site's.
    const keepTabVolume =
      state.site === undefined ? tabVolume !== null : state.site === site;
    state.site = site;

    if (keepTabVolume) {
      // Applied again because the tab may have a new browsing context by now
      // (e.g. it was unloaded in the meantime).
      this.#nextGeneration(tab);
      this.#applyVolume(tab, tabVolume ?? DEFAULT_VOLUME);
      return;
    }
    this.#loadSiteVolume(tab, uri);
  }

  #loadSiteVolume(tab, uri) {
    const generation = this.#nextGeneration(tab);
    if (!this.#siteFor(uri)) {
      this.#applyVolume(tab, DEFAULT_VOLUME);
      return;
    }

    const { loadContext } = tab.linkedBrowser;
    const cached = lazy.contentPrefs.getCachedByDomainAndName(
      uri.spec,
      SITE_PREF_NAME,
      loadContext
    );
    if (cached) {
      this.#applyVolume(tab, cached.value ?? DEFAULT_VOLUME);
      return;
    }

    // Don't carry a boost over to a site that never asked for one while the
    // lookup runs.
    this.#applyVolume(tab, DEFAULT_VOLUME);

    let value;
    lazy.contentPrefs.getByDomainAndName(
      uri.spec,
      SITE_PREF_NAME,
      loadContext,
      {
        handleResult(pref) {
          value = pref.value;
        },
        handleCompletion: () => {
          if (!tab.closing && this.#stateFor(tab).generation === generation) {
            this.#applyVolume(tab, value ?? DEFAULT_VOLUME);
          }
        },
      }
    );
  }

  #applyVolume(tab, volume) {
    volume = this.#normalize(volume);

    const browsingContext = tab.linkedBrowser?.browsingContext;
    if (!browsingContext) {
      return;
    }

    if (browsingContext.zenMediaVolume !== Math.fround(volume)) {
      try {
        browsingContext.zenMediaVolume = volume;
      } catch (e) {
        console.warn("Failed to set the tab volume", e);
        return;
      }
      tab.dispatchEvent(
        new CustomEvent("ZenTabVolumeChanged", {
          bubbles: true,
          detail: { volume },
        })
      );
    }

    this.#setTabValue(tab, volume);
  }

  #stateFor(tab) {
    let state = this.#tabStates.get(tab);
    if (!state) {
      // undefined: we haven't seen the tab navigate yet.
      // null: a page without a site (about:, file:, ...).
      state = { site: undefined, generation: 0 };
      this.#tabStates.set(tab, state);
    }
    return state;
  }

  #nextGeneration(tab) {
    return ++this.#stateFor(tab).generation;
  }

  #getTabValue(tab) {
    const value = lazy.SessionStore.getCustomTabValue(tab, SESSION_KEY);
    return value ? this.#normalize(value) : null;
  }

  #setTabValue(tab, volume) {
    if (volume === DEFAULT_VOLUME) {
      lazy.SessionStore.deleteCustomTabValue(tab, SESSION_KEY);
    } else if (
      lazy.SessionStore.getCustomTabValue(tab, SESSION_KEY) !== String(volume)
    ) {
      lazy.SessionStore.setCustomTabValue(tab, SESSION_KEY, String(volume));
    }
  }

  #normalize(volume) {
    const number = Number(volume);
    if (!Number.isFinite(number)) {
      return DEFAULT_VOLUME;
    }
    return Math.min(
      Math.max(Math.round(number * 100) / 100, 0),
      this.maxVolume
    );
  }

  #siteFor(uri) {
    if (!uri || !(uri.schemeIs("http") || uri.schemeIs("https"))) {
      return null;
    }
    return lazy.contentPrefs.extractDomain(uri.spec);
  }
}
