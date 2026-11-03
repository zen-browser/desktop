// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { UrlbarShared } from "chrome://browser/content/urlbar/UrlbarShared.mjs";

const SEARCH_MODE_ANIMATION_RESET_MS = 1000;

/**
 * Zen's behaviour on top of Firefox's URL bar.
 */
export class nsZenUrlbarController {
  // The URL bar session that currently replaces a new tab.
  #prevUrlbarLabel = null;
  #lastSearch = "";
  #clearTimeout = null;
  #lastTab = null;
  #sessionCounter = 0;
  #owner = null;

  // Search mode animation.
  #animatingSearchMode = false;
  #animatingSearchModeTimeout = null;

  constructor() {
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "waitToClear",
      "zen.urlbar.wait-to-clear",
      0
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "showDomainOnly",
      "zen.urlbar.show-domain-only-in-sidebar",
      true
    );
  }

  init() {
    const { registerZenUrlbarProviders } = ChromeUtils.importESModule(
      "resource:///modules/ZenUBProvider.sys.mjs"
    );
    const { nsZenSiteDataPanel: ZenSiteDataPanel } = ChromeUtils.importESModule(
      "resource:///modules/ZenSiteDataPanel.sys.mjs"
    );
    registerZenUrlbarProviders();
    window.gZenSiteDataPanel = new ZenSiteDataPanel(window);
    gURLBar._zenTrimURL = this.trimURL.bind(this);
    gURLBar._setPlaceholder(null);

    window.addEventListener("Zen:UrlbarSearchModeChanged", event =>
      this.#onSearchModeChanged(event)
    );
  }

  get #newtabButtons() {
    return gNavToolbox.querySelectorAll("#tabs-newtab-button");
  }

  // Section: new tab replacement

  /**
   * Whether closeSeq is the URL bar session currently replacing a new tab.
   *
   * @param {number} closeSeq
   * @returns {boolean}
   */
  isOwner(closeSeq) {
    return this.#owner === closeSeq;
  }

  /**
   * Opens the floating URL bar instead of a new tab when the preference
   * allows it.
   *
   * @param {boolean} werePassedURL - Whether the new tab already has a URL.
   * @param {boolean} searchClipboard - Whether the clipboard is being searched.
   * @param {string} where - Where the tab would open ("tab", "window", ...).
   * @param {boolean} [overridePreferance] - Open regardless of the preference.
   * @param {object} [closeToken] - Receives the session id for matchesCloseToken.
   * @returns {boolean} Whether the URL bar handled the new tab.
   */
  handleNewTab(
    werePassedURL,
    searchClipboard,
    where,
    overridePreferance = false,
    closeToken = {}
  ) {
    // Keep this here. It's better to make sure every
    // call has a different token rather then forgetting
    // to increment it in one of the early returns.
    const closeSeq = ++this.#sessionCounter;
    closeToken.id = closeSeq;

    if (gZenUIManager.testingEnabled && !overridePreferance) {
      return false;
    }

    if (document.documentElement.hasAttribute("zen-welcome-stage")) {
      return false;
    }

    const shouldOpenURLBar =
      overridePreferance ||
      (gZenVerticalTabsManager._canReplaceNewTab &&
        !werePassedURL &&
        !searchClipboard &&
        where === "tab");

    if (!shouldOpenURLBar) {
      return false;
    }

    // Close the new tab popup on cmd/ctrl + t
    if (!overridePreferance && gURLBar.hasAttribute("zen-newtab")) {
      // The _zenHandleUrlbarClose holds a token in it's closure.
      // Call that instead.
      if (gURLBar._zenHandleUrlbarClose) {
        gURLBar._zenHandleUrlbarClose();
      } else {
        this.handleUrlbarClose(closeSeq);
      }
      return true;
    }

    if (this.#clearTimeout) {
      clearTimeout(this.#clearTimeout);
      this.#clearTimeout = null;
    }

    this.#lastTab = gBrowser.selectedTab;
    if (!this.#lastTab) {
      console.warn("No selected tab found when creating new tab");
      return false;
    }

    if (!this.#lastTab.closing) {
      this.#lastTab._visuallySelected = false;
    }

    this.#prevUrlbarLabel = gURLBar._untrimmedValue || "";

    gURLBar._zenHandleUrlbarClose = (onSwitch, onElementPicked) =>
      this.handleUrlbarClose(closeSeq, onSwitch, onElementPicked);
    this.#owner = closeSeq;
    gURLBar.setAttribute("zen-newtab", true);

    for (const button of this.#newtabButtons) {
      button.setAttribute("in-urlbar", true);
    }

    try {
      gURLBar.search(this.#lastSearch || "");
      document.getElementById("Browser:OpenLocation").doCommand();
    } catch (e) {
      console.error("Error opening location in new tab:", e);
      this.handleUrlbarClose(closeSeq, false, false);
      return false;
    }
    return true;
  }

  /**
   * Check whether the closeToken given by handleNewTab
   * corresponds to a close event.
   *
   * @param {object} closeToken - Token previously passed to handleNewTab.
   * @param {CustomEvent} event - A ZenURLBarClosed event.
   * @returns {boolean}
   */
  matchesCloseToken(closeToken, event) {
    return (
      typeof closeToken?.id === "number" &&
      event?.detail?.closeSeq === closeToken.id
    );
  }

  #clearSessionData() {
    this.#prevUrlbarLabel = null;
    this.#lastSearch = "";
  }

  /**
   * Closes the URL bar session started by handleNewTab and restores the tab
   * and URL bar state it replaced.
   *
   * @param {number} closeSeq - Session id from handleNewTab.
   * @param {boolean} [onSwitch] - Closing because the user switched tabs.
   * @param {boolean} [onElementPicked] - Closing because a result was picked.
   */
  handleUrlbarClose(closeSeq, onSwitch = false, onElementPicked = false) {
    if (gURLBar._zenHandleUrlbarClose) {
      gURLBar._zenHandleUrlbarClose = null;
    }

    const isFocusedBefore = gURLBar.focused;
    setTimeout(() => {
      /* If someone else opened the url bar in the meantime don't be
       * stingy and leave it open for them.*/
      if (this.isOwner(closeSeq)) {
        // We use this attribute on Tabbrowser::addTab
        gURLBar.removeAttribute("zen-newtab");

        const lastTab = this.#lastTab;
        if (
          lastTab &&
          !lastTab.closing &&
          lastTab.documentGlobal &&
          !lastTab.documentGlobal.closed &&
          gBrowser.selectedTab === lastTab
        ) {
          lastTab._visuallySelected = true;
          this.#lastTab = null;
        }

        for (const button of this.#newtabButtons) {
          button.removeAttribute("in-urlbar");
        }

        if (onSwitch) {
          this.#clearSessionData();
        } else {
          this.#lastSearch = gURLBar._untrimmedValue || "";
          if (this.#clearTimeout) {
            clearTimeout(this.#clearTimeout);
          }
          this.#clearTimeout = setTimeout(
            () => this.#clearSessionData(),
            this.waitToClear
          );
        }

        if (this.#prevUrlbarLabel) {
          gURLBar.setURI({
            uri: this.#prevUrlbarLabel,
            dueToTabSwitch: onSwitch,
            isSameDocument: !onSwitch,
          });
        }

        gURLBar.handleRevert();
      }

      if (isFocusedBefore) {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("ZenURLBarClosed", {
              detail: { onSwitch, onElementPicked, closeSeq },
            })
          );

          if (!this.isOwner(closeSeq)) {
            return;
          }
          this.#owner = null;

          gURLBar.view.close({ elementPicked: onElementPicked });
          gURLBar.updateTextOverflow();

          if (onElementPicked && onSwitch) {
            gURLBar.setURI({ dueToTabSwitch: onSwitch });
          }

          const selectedTab = gBrowser.selectedTab;
          if (
            selectedTab &&
            selectedTab.linkedBrowser &&
            !selectedTab.closing &&
            onSwitch
          ) {
            const browserState = gURLBar.getBrowserState(
              selectedTab.linkedBrowser
            );
            if (browserState) {
              browserState.urlbarFocused = false;
            }
          }
        }, 0);
      } else if (this.isOwner(closeSeq)) {
        this.#owner = null;
      }
    }, 0);
  }

  // Section: open and close

  onUrlbarOpen() {
    setTimeout(() => {
      const hadValid = gURLBar.getAttribute("pageproxystate") === "valid";
      gURLBar.setPageProxyState("invalid", false);
      gURLBar.setAttribute("had-proxystate", hadValid);
    }, 0);
  }

  onUrlbarClose() {
    if (gURLBar.getAttribute("had-proxystate") == "true") {
      gURLBar.setPageProxyState("valid", false);
    }
    gURLBar.removeAttribute("had-proxystate");
  }

  // Section: search mode

  #onSearchModeChanged(event) {
    if (gReduceMotion) {
      return;
    }
    const { searchMode } = event.detail;
    if (!gURLBar.hasAttribute("breakout-extend") || this.#animatingSearchMode) {
      return;
    }
    this.#animatingSearchMode = true;
    gZenUIManager.motion
      .animate(gURLBar, { scale: [1, 0.98, 1] }, { duration: 0.25 })
      .then(() => {
        this.#animatingSearchMode = false;
      });
    if (searchMode) {
      gURLBar.setAttribute("animate-searchmode", "true");
      this.#animatingSearchModeTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          gURLBar.removeAttribute("animate-searchmode");
          this.#animatingSearchModeTimeout = null;
        });
      }, SEARCH_MODE_ANIMATION_RESET_MS);
    }
  }

  /**
   * Switches the floating URL bar into Zen's commands search mode.
   *
   * @param {Event} event - The keyboard event that requested commands mode.
   */
  enableCommandsMode(event) {
    event.preventDefault();
    if (!gURLBar.hasAttribute("breakout-extend") || this.#animatingSearchMode) {
      return;
    }
    const currentSearchMode = gURLBar.getSearchMode(gBrowser.selectedBrowser);
    let searchMode = null;
    if (!currentSearchMode) {
      searchMode = {
        source: UrlbarShared.RESULT_SOURCE.ZEN_ACTIONS,
        isPreview: true,
      };
    }
    gURLBar.removeAttribute("animate-searchmode");
    if (this.#animatingSearchModeTimeout) {
      clearTimeout(this.#animatingSearchModeTimeout);
      this.#animatingSearchModeTimeout = null;
    }
    gURLBar.searchMode = searchMode;
    gURLBar.startQuery({
      allowAutofill: false,
      event,
    });
  }

  // Section: URL display and link handling

  /**
   * Trims the URL shown in the URL bar. In the single toolbar layout only
   * the domain is shown unless the URL bar is expanded.
   *
   * @param {string} aURL
   * @returns {string}
   */
  trimURL(aURL) {
    if (gURLBar.hasAttribute("breakout-extend")) {
      return aURL;
    }
    if (gZenVerticalTabsManager._hasSetSingleToolbar && this.showDomainOnly) {
      let url = BrowserUIUtils.removeSingleTrailingSlashFromURL(aURL);
      let stripped = url.startsWith("https://") ? url.split("/")[2] : url;
      if (stripped.startsWith("www.")) {
        stripped = stripped.substring(4);
      }
      return stripped;
    }
    return BrowserUIUtils.trimURL(aURL);
  }

  #urlStringsDomainMatch(url1, url2) {
    if (!url1.startsWith("http") || !url2?.startsWith("http")) {
      return false;
    }
    return Services.io.newURI(url1).host === Services.io.newURI(url2).host;
  }

  /**
   * Opens links to other domains from a pinned tab in a new tab, when the
   * preference asks for it.
   *
   * @param {string} url - The URL about to load.
   * @param {MozBrowser} browser - The browser the load was requested in.
   * @param {string} openUILinkWhere - Firefox's choice of where to open.
   * @returns {string} Where the link should open.
   */
  getOpenUILinkWhere(url, browser, openUILinkWhere) {
    try {
      const tab = gBrowser.getTabForBrowser(browser);
      if (
        openUILinkWhere === "current" &&
        !this.#urlStringsDomainMatch(url, browser.currentURI.spec) &&
        tab.pinned &&
        Services.prefs.getBoolPref("zen.tabs.open-pinned-in-new-tab")
      ) {
        return "tab";
      }
    } catch (e) {
      console.error("Error in getOpenUILinkWhere:", e);
    }
    return openUILinkWhere;
  }
}
