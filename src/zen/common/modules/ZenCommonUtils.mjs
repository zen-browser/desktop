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

ChromeUtils.defineLazyGetter(lazy, "ClipboardHelper", () =>
  Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper)
);

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
  /**
   * The exposable URLs of every selected tab, or of the current tab alone when
   * only one tab is selected and when none of the selected tabs can be shared.
   *
   * @returns {[{uri: nsIURI, title: string}[], boolean]}
   *   The links, and whether they came from a multiple selection.
   */
  getCurrentURLs() {
    const titleOf = tab => tab.linkedBrowser.contentTitle || tab.label;
    const exposableURIOf = uri =>
      lazy.BrowserUtils.getExposableURI(uri, { stripTracking: true });
    const uriOf = browser => {
      try {
        if (browser.userTypedValue) {
          return Services.io.newURI(browser.userTypedValue);
        }
      } catch {}
      return browser.currentURI;
    };
    const currentTab = [
      {
        uri: exposableURIOf(uriOf(gBrowser.selectedBrowser)),
        title: titleOf(gBrowser.selectedTab),
      },
    ];
    if (gBrowser.selectedTabs.length < 2) {
      return [currentTab, false];
    }

    const selectedURLs = [];
    for (const tab of gBrowser.selectedTabs) {
      const shareableURL = lazy.BrowserUtils.getShareableURL(
        uriOf(tab.linkedBrowser)
      );
      if (!shareableURL) {
        continue;
      }

      selectedURLs.push({
        uri: exposableURIOf(shareableURL),
        title: titleOf(tab),
      });
    }

    if (!selectedURLs.length) {
      return [currentTab, false];
    }
    return [selectedURLs, true];
  },

  copyCurrentURLToClipboard() {
    const [selectedURLs, isMultiple] = this.getCurrentURLs();
    lazy.BrowserUtils.copyLinks(
      selectedURLs.map(({ uri, title }) => ({ url: uri.displaySpec, title }))
    );

    const [{ uri: currentUrl }] = selectedURLs;
    let button;
    /* eslint-disable mozilla/valid-services */
    if (
      !isMultiple &&
      Services.zen.canShare() &&
      currentUrl.displaySpec.startsWith("http")
    ) {
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
    gZenUIManager.showToast("zen-copy-urls-confirmation", {
      l10nArgs: { count: selectedURLs.length },
      button,
      timeout: 3000,
    });
  },

  copyCurrentURLAsMarkdownToClipboard() {
    const [selectedURLs] = this.getCurrentURLs();
    lazy.ClipboardHelper.copyString(
      selectedURLs
        .map(({ uri, title }) => `[${title}](${uri.displaySpec})`)
        .join("\n")
    );

    gZenUIManager.showToast("zen-copy-urls-as-markdown-confirmation", {
      l10nArgs: { count: selectedURLs.length },
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
