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
   * Resolve the current tab URL string for clipboard writes.
   * Never depends on urlbar selection/focus. Prefer zenStrippedURI when the
   * UrlbarInput patch is present; otherwise strip via QueryStringStripper or
   * fall back to gBrowser.currentURI.
   */
  _resolveCurrentUrlStringForClipboard() {
    let uri = gBrowser?.currentURI;
    if (!uri) {
      return null;
    }

    try {
      const stripped = gURLBar?.zenStrippedURI;
      if (Array.isArray(stripped) && stripped[0]) {
        const text = stripped[0].displaySpec || stripped[0].spec;
        if (text) {
          return { text, uri: stripped[0] };
        }
      }
    } catch (error) {
      console.warn("Astra: zenStrippedURI failed, using currentURI:", error);
    }

    try {
      const stripper = Cc[
        "@mozilla.org/url-query-string-stripper;1"
      ].getService(Ci.nsIURLQueryStringStripper);
      const stripped = stripper.stripForCopyOrShare(uri);
      if (stripped) {
        uri = gURLBar?.makeURIReadable?.(stripped) || stripped;
      }
    } catch (_error) {
      // Stripper optional — raw currentURI is fine.
    }

    const text = uri.displaySpec || uri.spec;
    return text ? { text, uri } : null;
  },

  copyCurrentURLToClipboard() {
    const resolved = this._resolveCurrentUrlStringForClipboard();
    if (!resolved?.text) {
      console.error("Astra: copyCurrentURLToClipboard: no URL available");
      return;
    }
    const { text, uri: currentUrl } = resolved;

    // Privileged synchronous write — do not use navigator.clipboard (can
    // silently fail in chrome when focus is on the urlbar input).
    if (window.gZenSmartGuard?.guardedCopyToClipboard) {
      window.gZenSmartGuard.guardedCopyToClipboard(text, "current-url");
    } else {
      Services.clipboardHelper.copyString(text);
    }

    let button;
    try {
      /* eslint-disable mozilla/valid-services */
      if (Services.zen?.canShare?.() && text.startsWith("http")) {
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
    } catch (error) {
      console.warn("Astra: share toast button skipped:", error);
    }

    try {
      gZenUIManager.showToast("zen-copy-current-url-confirmation", {
        button,
        timeout: 3000,
      });
    } catch (error) {
      // Clipboard already written — toast is best-effort only.
      console.warn("Astra: copy toast failed:", error);
    }
  },

  copyCurrentURLAsMarkdownToClipboard() {
    const resolved = this._resolveCurrentUrlStringForClipboard();
    if (!resolved?.text) {
      console.error(
        "Astra: copyCurrentURLAsMarkdownToClipboard: no URL available"
      );
      return;
    }
    const tabTitle = gBrowser.selectedTab.label;
    const markdownLink = `[${tabTitle}](${resolved.text})`;
    if (window.gZenSmartGuard?.guardedCopyToClipboard) {
      window.gZenSmartGuard.guardedCopyToClipboard(
        markdownLink,
        "current-url-markdown"
      );
    } else {
      Services.clipboardHelper.copyString(markdownLink);
    }
    try {
      gZenUIManager.showToast("zen-copy-current-url-as-markdown-confirmation", {
        timeout: 3000,
      });
    } catch (error) {
      console.warn("Astra: markdown copy toast failed:", error);
    }
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
