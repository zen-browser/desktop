// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

window.gZenOperatingSystemCommonUtils = {
  kZenOSToSmallName: {
    WINNT: "windows",
    Darwin: "macos",
    Linux: "linux",
  },

  get currentOperatingSystem() {
    let os = Services.appinfo.OS;
    return this.kZenOSToSmallName[os];
  },
};

export class nsZenMultiWindowFeature {
  constructor() {}

  static get browsers() {
    return Services.wm.getEnumerator("navigator:browser");
  }

  static get currentBrowser() {
    return Services.wm.getMostRecentWindow("navigator:browser");
  }

  static get isActiveWindow() {
    return nsZenMultiWindowFeature.currentBrowser === window;
  }

  windowIsActive(browser) {
    return browser === nsZenMultiWindowFeature.currentBrowser;
  }

  async foreachWindowAsActive(callback) {
    if (!nsZenMultiWindowFeature.isActiveWindow) {
      return;
    }
    await this.forEachWindow(callback);
  }

  async forEachWindow(callback) {
    for (const browser of nsZenMultiWindowFeature.browsers) {
      try {
        if (browser.closed) {
          continue;
        }
        await callback(browser);
      } catch (e) {
        console.error(e);
      }
    }
  }

  forEachWindowSync(callback) {
    for (const browser of nsZenMultiWindowFeature.browsers) {
      try {
        if (browser.closed) {
          continue;
        }
        callback(browser);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export class nsZenDOMOperatedFeature {
  constructor() {
    var initBound = this.init.bind(this);
    document.addEventListener("DOMContentLoaded", initBound, { once: true });
  }
}

export class nsZenPreloadedFeature {
  constructor() {
    var initBound = this.init.bind(this);
    document.addEventListener("MozBeforeInitialXULLayout", initBound, {
      once: true,
    });
  }
}

window.gZenCommonActions = {
  copyToClipboardWithSmartGuard(text, source = "generic") {
    if (window.gZenSmartGuard?.guardedCopyToClipboard) {
      window.gZenSmartGuard.guardedCopyToClipboard(text, source);
      return;
    }
    Services.clipboardHelper.copyString(text);
  },

  /**
   * Resolve the current page URI + clipboard helper.
   * Prefers gURLBar.zenStrippedURI (UrlbarInput patch) when available;
   * falls back so the copy-URL toolbar button still works if the patch
   * is missing or throws.
   */
  _getCurrentUrlForClipboard() {
    try {
      const stripped = gURLBar?.zenStrippedURI;
      if (Array.isArray(stripped) && stripped[0]) {
        return {
          currentUrl: stripped[0],
          ClipboardHelper: stripped[1] || Services.clipboardHelper,
        };
      }
    } catch (error) {
      console.warn("Astra: zenStrippedURI failed, using currentURI:", error);
    }
    return {
      currentUrl: gBrowser.currentURI,
      ClipboardHelper: Services.clipboardHelper,
    };
  },

  copyCurrentURLToClipboard() {
    const { currentUrl, ClipboardHelper } = this._getCurrentUrlForClipboard();
    const displaySpec = currentUrl?.displaySpec;
    if (!displaySpec) {
      console.error("Astra: copyCurrentURLToClipboard: no URL available");
      return;
    }
    if (window.gZenSmartGuard?.guardedCopyToClipboard) {
      window.gZenSmartGuard.guardedCopyToClipboard(displaySpec, "current-url");
    } else {
      ClipboardHelper.copyString(displaySpec);
    }
    let button;
    /* eslint-disable mozilla/valid-services */
    if (Services.zen.canShare() && displaySpec.startsWith("http")) {
      button = {
        id: "zen-copy-current-url-button",
        command: event => {
          const buttonRect = event.target.getBoundingClientRect();
          /* eslint-disable mozilla/valid-services */
          Services.zen.share(
            currentUrl,
            "",
            "",
            buttonRect.left,
            window.innerHeight - buttonRect.bottom,
            buttonRect.width,
            buttonRect.height
          );
        },
      };
    }
    gZenUIManager.showToast("zen-copy-current-url-confirmation", {
      button,
      timeout: 3000,
    });
  },

  copyCurrentURLAsMarkdownToClipboard() {
    const { currentUrl, ClipboardHelper } = this._getCurrentUrlForClipboard();
    const displaySpec = currentUrl?.displaySpec;
    if (!displaySpec) {
      console.error(
        "Astra: copyCurrentURLAsMarkdownToClipboard: no URL available"
      );
      return;
    }
    const tabTitle = gBrowser.selectedTab.label;
    const markdownLink = `[${tabTitle}](${displaySpec})`;
    if (window.gZenSmartGuard?.guardedCopyToClipboard) {
      window.gZenSmartGuard.guardedCopyToClipboard(
        markdownLink,
        "current-url-markdown"
      );
    } else {
      ClipboardHelper.copyString(markdownLink);
    }
    gZenUIManager.showToast("zen-copy-current-url-as-markdown-confirmation", {
      timeout: 3000,
    });
  },

  throttle(f, delay) {
    let timer = 0;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => f.apply(this, args), delay);
    };
  },

  /**
   * Determines if a tab should be closed when navigating back with no history.
   * Only tabs with an owner that are not pinned and not empty are eligible.
   * Respects the user preference zen.tabs.close-on-back-with-no-history.
   *
   * @returns {boolean} True if the tab should be closed on back
   */
  shouldCloseTabOnBack() {
    if (
      !Services.prefs.getBoolPref(
        "zen.tabs.close-on-back-with-no-history",
        true
      )
    ) {
      return false;
    }
    const tab = gBrowser.selectedTab;
    return Boolean(
      tab.owner && !tab.pinned && !tab.hasAttribute("zen-empty-tab")
    );
  },
};
