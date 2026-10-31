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

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
});

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
  getDisplaySpec(uri) {
    let displaySpec = uri.displaySpec;
    try {
      if (
        Services.prefs.getBoolPref("browser.urlbar.decodeURLsOnCopy", false) &&
        !uri.schemeIs("data")
      ) {
        displaySpec = decodeURI(displaySpec);
      }
    } catch (e) {}
    return displaySpec;
  },

  getCurrentURL() {
    const [currentUrl, ClipboardHelper] = gURLBar.zenStrippedURI;
    const currentTabURL = {
      uri: currentUrl,
      displaySpec: this.getDisplaySpec(currentUrl),
      title: gBrowser.selectedTab.label,
    };
    if (gBrowser.selectedTabs.length < 2) {
      return [[currentTabURL], ClipboardHelper, false];
    }

    const QueryStringStripper = Cc[
      "@mozilla.org/url-query-string-stripper;1"
    ].getService(Ci.nsIURLQueryStringStripper);
    const selectedURLs = [];
    for (const tab of gBrowser.selectedTabs) {
      let uri = lazy.BrowserUtils.getShareableURL(tab.linkedBrowser.currentURI);
      if (!uri) {
        continue;
      }

      try {
        uri = gURLBar.makeURIReadable(
          QueryStringStripper.stripForCopyOrShare(uri) ?? uri
        );
      } catch (e) {
        console.warn(`stripForCopyOrShare: ${e.message}`);
      }

      selectedURLs.push({
        uri,
        displaySpec: this.getDisplaySpec(uri),
        title: tab.label,
      });
    }

    if (!selectedURLs.length) {
      return [[currentTabURL], ClipboardHelper, false];
    }
    return [selectedURLs, ClipboardHelper, true];
  },

  copyCurrentURLToClipboard() {
    const [selectedURLs, ClipboardHelper, isMultiple] = this.getCurrentURL();
    if (isMultiple) {
      ClipboardHelper.copyString(
        selectedURLs.map(selectedURL => selectedURL.displaySpec).join("\n")
      );
      gZenUIManager.showToast("zen-copy-multi-urls-confirmation", {
        l10nArgs: { count: selectedURLs.length },
        timeout: 3000,
      });
      return;
    }

    const [{ uri: currentUrl, displaySpec }] = selectedURLs;
    ClipboardHelper.copyString(displaySpec);

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
    const [selectedURLs, ClipboardHelper, isMultiple] = this.getCurrentURL();
    if (isMultiple) {
      ClipboardHelper.copyString(
        selectedURLs
          .map(
            selectedURL => `[${selectedURL.title}](${selectedURL.displaySpec})`
          )
          .join("\n")
      );
      gZenUIManager.showToast("zen-copy-multi-urls-as-markdown-confirmation", {
        l10nArgs: { count: selectedURLs.length },
        timeout: 3000,
      });
      return;
    }

    const [{ displaySpec, title }] = selectedURLs;
    const markdownLink = `[${title}](${displaySpec})`;
    ClipboardHelper.copyString(markdownLink);

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
