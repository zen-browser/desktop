/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

const MAX_HISTORY_LENGTH = 100;

function createHistoryState() {
  return {
    entries: [],
    index: -1,
    navigating: false,
  };
}

/**
 * Maintains a browser-wide jump list of selected tabs.
 *
 * Normal and private windows use separate histories. Entries use weak
 * references so closed tabs and windows do not remain alive because they were
 * visited.
 */
class ZenTabHistory {
  #histories = new Map();
  #registeredWindows = new WeakMap();

  registerWindow(browserWindow) {
    if (
      !browserWindow?.gBrowser ||
      this.#registeredWindows.has(browserWindow)
    ) {
      return;
    }

    const onTabSelect = event => {
      if (lazy.BrowserWindowTracker.getTopWindow() == browserWindow) {
        this.#record(browserWindow, event.target);
      }
    };
    const onUnload = () => this.unregisterWindow(browserWindow);

    browserWindow.addEventListener("TabSelect", onTabSelect);
    browserWindow.addEventListener("unload", onUnload, { once: true });
    this.#registeredWindows.set(browserWindow, { onTabSelect, onUnload });

    const state = this.#stateForWindow(browserWindow);
    if (state.index < 0) {
      this.#record(browserWindow, browserWindow.gBrowser.selectedTab);
    }
  }

  unregisterWindow(browserWindow) {
    const listeners = this.#registeredWindows.get(browserWindow);
    if (!listeners) {
      return;
    }

    browserWindow.removeEventListener("TabSelect", listeners.onTabSelect);
    browserWindow.removeEventListener("unload", listeners.onUnload);
    this.#registeredWindows.delete(browserWindow);
  }

  canGoBack(browserWindow) {
    const state = this.#stateForWindow(browserWindow);
    if (state.navigating) {
      return false;
    }

    const current = this.#currentLocation(browserWindow);
    if (!current) {
      return false;
    }

    const currentIsRecorded = this.#entryMatches(
      state.entries[state.index],
      current.window,
      current.tab
    );
    const startIndex = currentIsRecorded ? state.index - 1 : state.index;
    return Boolean(this.#findLocation(state, startIndex, -1, current));
  }

  canGoForward(browserWindow) {
    const state = this.#stateForWindow(browserWindow);
    if (state.navigating) {
      return false;
    }

    const current = this.#currentLocation(browserWindow);
    if (
      !current ||
      !this.#entryMatches(
        state.entries[state.index],
        current.window,
        current.tab
      )
    ) {
      return false;
    }

    return Boolean(this.#findLocation(state, state.index + 1, 1, current));
  }

  goBack(browserWindow) {
    return this.#navigate(browserWindow, -1);
  }

  goForward(browserWindow) {
    return this.#navigate(browserWindow, 1);
  }

  /**
   * Selects a tab while recording the source and target as one navigation.
   * This preserves the origin when a switch-to-tab result changes windows.
   *
   * @param {Window} sourceWindow The window where navigation started.
   * @param {Window} targetWindow The target tab's owning window.
   * @param {MozTabbrowserTab} targetTab The tab to select.
   * @returns {Promise<boolean>} Whether the target was selected.
   */
  async navigateTo(sourceWindow, targetWindow, targetTab) {
    if (
      !sourceWindow ||
      sourceWindow.closed ||
      !this.#samePrivacyContext(sourceWindow, targetWindow)
    ) {
      return false;
    }

    const state = this.#stateForWindow(sourceWindow);
    const source = this.#currentLocation(sourceWindow);
    const target = this.#locationFor(targetWindow, targetTab);
    if (state.navigating || !target) {
      return false;
    }

    if (source) {
      this.#append(state, source.window, source.tab);
    }
    state.navigating = true;
    try {
      const selected = await this.#selectLocation(target);
      if (selected) {
        this.#append(state, target.window, target.tab);
      }
      return selected;
    } catch (error) {
      console.error("Unable to navigate to tab history target", error);
      return false;
    } finally {
      state.navigating = false;
    }
  }

  async #navigate(browserWindow, direction) {
    const state = this.#stateForWindow(browserWindow);
    if (state.navigating) {
      return false;
    }

    const current = this.#currentLocation(browserWindow);
    if (!current) {
      return false;
    }

    this.#append(state, current.window, current.tab);
    const originIndex = state.index;
    const target = this.#findLocation(
      state,
      state.index + direction,
      direction,
      current
    );
    if (!target) {
      return false;
    }

    state.index = target.index;
    state.navigating = true;
    let selected = false;
    try {
      selected = await this.#selectLocation(target);
      return selected;
    } catch (error) {
      console.error("Unable to navigate through tab history", error);
      return false;
    } finally {
      if (!selected) {
        state.index = originIndex;
      }
      state.navigating = false;
    }
  }

  async #selectLocation(location) {
    const { window: targetWindow, tab } = location;
    if (!this.#isValidLocation(targetWindow, tab)) {
      return false;
    }

    targetWindow.focus();
    await targetWindow.gZenWorkspaces.switchTabIfNeeded(tab);
    if (targetWindow.closed) {
      return false;
    }
    const selectedTab = this.#normalizeTab(
      targetWindow,
      targetWindow.gBrowser.selectedTab
    );
    if (selectedTab != tab) {
      return false;
    }

    targetWindow.gBrowser.selectedBrowser?.focus();
    return true;
  }

  #record(browserWindow, tab) {
    const state = this.#stateForWindow(browserWindow);
    if (state.navigating) {
      return;
    }

    const location = this.#locationFor(browserWindow, tab);
    if (location) {
      this.#append(state, location.window, location.tab);
    }
  }

  #append(state, browserWindow, tab) {
    if (this.#entryMatches(state.entries[state.index], browserWindow, tab)) {
      return;
    }

    state.entries.splice(state.index + 1);
    state.entries.push({
      windowRef: new WeakRef(browserWindow),
      tabRef: new WeakRef(tab),
    });

    const overflow = state.entries.length - MAX_HISTORY_LENGTH;
    if (overflow > 0) {
      state.entries.splice(0, overflow);
    }
    state.index = state.entries.length - 1;
  }

  #findLocation(state, startIndex, direction, current) {
    for (
      let index = startIndex;
      index >= 0 && index < state.entries.length;
      index += direction
    ) {
      const location = this.#resolveEntry(state.entries[index]);
      if (
        location &&
        (location.window != current.window || location.tab != current.tab)
      ) {
        return { ...location, index };
      }
    }
    return null;
  }

  #resolveEntry(entry) {
    const browserWindow = entry?.windowRef.deref();
    const tab = entry?.tabRef.deref();
    return this.#locationFor(browserWindow, tab);
  }

  #currentLocation(browserWindow) {
    return this.#locationFor(
      browserWindow,
      browserWindow?.gBrowser?.selectedTab
    );
  }

  #locationFor(browserWindow, tab) {
    tab = this.#normalizeTab(browserWindow, tab);
    if (!this.#isValidLocation(browserWindow, tab)) {
      return null;
    }
    return { window: browserWindow, tab };
  }

  #normalizeTab(browserWindow, tab) {
    return browserWindow?.gZenGlanceManager?.getTabOrGlanceParent(tab) ?? tab;
  }

  #isValidLocation(browserWindow, tab) {
    return Boolean(
      browserWindow &&
      !browserWindow.closed &&
      tab &&
      !tab.closing &&
      tab.isConnected &&
      tab.documentGlobal == browserWindow &&
      browserWindow.gBrowser?.isTab(tab) &&
      !tab.hasAttribute("zen-empty-tab")
    );
  }

  #entryMatches(entry, browserWindow, tab) {
    return Boolean(
      entry &&
      entry.windowRef.deref() == browserWindow &&
      entry.tabRef.deref() == tab
    );
  }

  #stateForWindow(browserWindow) {
    const isPrivate =
      browserWindow && lazy.PrivateBrowsingUtils.isWindowPrivate(browserWindow);
    if (!this.#histories.has(isPrivate)) {
      this.#histories.set(isPrivate, createHistoryState());
    }
    return this.#histories.get(isPrivate);
  }

  #samePrivacyContext(firstWindow, secondWindow) {
    return Boolean(
      secondWindow &&
      !secondWindow.closed &&
      lazy.PrivateBrowsingUtils.isWindowPrivate(firstWindow) ==
        lazy.PrivateBrowsingUtils.isWindowPrivate(secondWindow)
    );
  }
}

export const gZenTabHistory = new ZenTabHistory();
