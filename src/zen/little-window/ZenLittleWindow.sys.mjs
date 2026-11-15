// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "enabled",
  "zen.little-window.enabled",
  false
);

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  ZenSessionStore: "resource:///modules/zen/ZenSessionManager.sys.mjs",
  ZenWindowSync: "resource:///modules/zen/ZenWindowSync.sys.mjs",
});

const LITTLE_WINDOW_ATTRIBUTE = "zen-little-window";
const LITTLE_WINDOW_URLBAR_ONLY_ATTRIBUTE = "zen-little-window-urlbar-only";
const LITTLE_WINDOW_WIDTH = 960;
const LITTLE_WINDOW_HEIGHT = 680;
const LITTLE_WINDOW_BAR_WIDTH = 680;
const LITTLE_WINDOW_BAR_HEIGHT = 66;

class nsZenLittleWindowService {
  /** Whether little windows can be opened at all. */
  get enabled() {
    return lazy.enabled;
  }

  /** The size of a little window that is showing a page. */
  get windowSize() {
    return { width: LITTLE_WINDOW_WIDTH, height: LITTLE_WINDOW_HEIGHT };
  }

  /**
   * @param {Window} aWindow
   * @returns {boolean} Whether the given browser window is a little window.
   */
  isLittleWindow(aWindow) {
    return !!aWindow?.document?.documentElement.hasAttribute(
      LITTLE_WINDOW_ATTRIBUTE
    );
  }

  /**
   * Opens a new little window.
   *
   * @param {object} [options]
   * @param {Window} [options.openerWindow]
   *   The window the request came from. Its current space decides the
   *   container of the new window unless one is given.
   * @param {string} [options.url]
   *   The page to load. Without one the window is only as big as its URL
   *   bar, and grows to its regular size once a page is loaded from it.
   * @param {number} [options.userContextId]
   *   The container to open the window with.
   * @param {nsIPrincipal} [options.triggeringPrincipal]
   *   The principal to load the page with, for one that did not come from
   *   the user.
   * @returns {Window|null} The new window, which has not loaded yet, or null
   *   when little windows are disabled.
   */
  open({ openerWindow, url, userContextId, triggeringPrincipal } = {}) {
    if (!this.enabled) {
      return null;
    }
    if (typeof userContextId != "number") {
      userContextId = this.isLittleWindow(openerWindow)
        ? openerWindow.gZenLittleWindow?.userContextId
        : openerWindow?.gZenWorkspaces?.getCurrentSpaceContainerId();
    }
    userContextId ??= 0;
    const container = Cc["@mozilla.org/supports-PRUint32;1"].createInstance(
      Ci.nsISupportsPRUint32
    );
    container.data = userContextId;
    const uriToLoad = Cc["@mozilla.org/supports-string;1"].createInstance(
      Ci.nsISupportsString
    );
    uriToLoad.data = url || "about:blank";
    const extraOptions = Cc["@mozilla.org/hash-property-bag;1"].createInstance(
      Ci.nsIWritablePropertyBag2
    );
    extraOptions.setPropertyAsBool(LITTLE_WINDOW_ATTRIBUTE, true);
    if (!url) {
      extraOptions.setPropertyAsBool(LITTLE_WINDOW_URLBAR_ONLY_ATTRIBUTE, true);
    }
    const args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    args.appendElement(uriToLoad);
    args.appendElement(extraOptions);
    args.appendElement(null);
    args.appendElement(null);
    args.appendElement(undefined);
    args.appendElement(container);
    args.appendElement(null);
    args.appendElement(null);
    args.appendElement(
      triggeringPrincipal ?? Services.scriptSecurityManager.getSystemPrincipal()
    );
    const width = url ? LITTLE_WINDOW_WIDTH : LITTLE_WINDOW_BAR_WIDTH;
    const height = url ? LITTLE_WINDOW_HEIGHT : LITTLE_WINDOW_BAR_HEIGHT;
    let features = `width=${width},height=${height},centerscreen`;
    const screen = openerWindow?.screen;
    if (screen) {
      const left = Math.round(
        screen.availLeft + (screen.availWidth - width) / 2
      );
      const top = Math.round(
        screen.availTop + (screen.availHeight - height) / 2
      );
      features = `width=${width},height=${height},left=${left},top=${top}`;
    }
    const win = lazy.BrowserWindowTracker.openWindow({
      openerWindow,
      args,
      features,
    });
    win._zenStartupSyncFlag = "unsynced";
    win._zenStartupUnsyncedUserContextId = userContextId;
    return win;
  }

  /**
   * The space the tabs of a little window go to by default, and the other
   * ones they could go to.
   *
   * @returns {{active: object|null, spaces: object[]}}
   */
  getSpaces() {
    const spaces = lazy.ZenSessionStore.getClonedSpaces();
    const activeId = Services.prefs.getStringPref("zen.workspaces.active", "");
    return {
      active: spaces.find(space => space.uuid == activeId) ?? spaces[0] ?? null,
      spaces,
    };
  }

  /**
   * Moves the tabs of a little window into a space of a regular window and
   * closes the little window.
   *
   * @param {Window} aLittleWindow
   * @param {string} [aSpaceId]
   *   The space to move the tabs to, the active one if omitted.
   * @returns {Promise<Window|null>} The window the tabs ended up in.
   */
  async openInSpace(aLittleWindow, aSpaceId = null) {
    if (!this.isLittleWindow(aLittleWindow) || aLittleWindow.closed) {
      return null;
    }
    const { gBrowser } = aLittleWindow;
    const selectedTab = gBrowser.selectedTab;
    const tabs = gBrowser.tabs.filter(
      tab =>
        !tab.closing &&
        !tab.hasAttribute("zen-empty-tab") &&
        !tab.hasAttribute("zen-glance-tab")
    );
    if (!tabs.length) {
      return null;
    }

    const target =
      lazy.ZenWindowSync.firstSyncedWindow ?? (await this.#openSpacesWindow());
    const workspaces = target.gZenWorkspaces;
    if (aSpaceId && !workspaces.getWorkspaceFromId(aSpaceId)) {
      aSpaceId = null;
    }
    const spaceId = aSpaceId ?? workspaces.activeWorkspace;
    if (workspaces.activeWorkspace !== spaceId) {
      await workspaces.changeWorkspaceWithID(spaceId);
    }

    for (const tab of tabs) {
      if (!tab.isConnected || tab.closing) {
        continue;
      }
      target.gBrowser.adoptTab(tab, {
        selectTab: tab === selectedTab || tabs.length == 1,
        spaceId,
      });
    }
    target.focus();
    if (!aLittleWindow.closed) {
      aLittleWindow.close();
    }
    return target;
  }

  /**
   * Opens a regular window for the tabs of a little window when there is
   * none.
   *
   * @returns {Promise<Window>}
   */
  async #openSpacesWindow() {
    const win = await lazy.BrowserWindowTracker.promiseOpenWindow({
      zenSyncedWindow: true,
    });
    await win.gZenStartup.promiseInitialized;
    return win;
  }
}

export const ZenLittleWindow = new nsZenLittleWindowService();
