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

/**
 * Resolves the URI a tab copies. Mirrors UrlbarInputBase's zenStrippedURI,
 * but for an arbitrary tab instead of the selected one.
 *
 * @param {MozTabbrowserTab} tab
 * @returns {nsIURI|null}
 */
function getTabCopyURI(tab) {
  const browser = tab.linkedBrowser;
  // userTypedValue is only meaningful for the tab the user is typing in.
  const uriString =
    (tab.selected && browser.userTypedValue) ||
    (browser.currentURI ? browser.currentURI.spec : "");

  let uri;
  try {
    uri = Services.io.newURI(uriString);
  } catch (e) {
    uri = browser.currentURI;
  }
  if (!uri) {
    return null;
  }

  try {
    const stripped = Cc["@mozilla.org/url-query-string-stripper;1"]
      .getService(Ci.nsIURLQueryStringStripper)
      .stripForCopyOrShare(uri);
    return stripped ? gURLBar.makeURIReadable(stripped) : uri;
  } catch (e) {
    console.warn(`stripForCopyOrShare: ${e.message}`);
    return uri;
  }
}

/**
 * Returns the URL text to copy, decoded when browser.urlbar.decodeURLsOnCopy is set.
 *
 * @param {nsIURI} uri
 * @returns {string}
 */
function getDisplaySpec(uri) {
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
}

/**
 * Returns the multi-selected tabs in tab-strip order with their copyable URL.
 * Only http(s) URLs qualify. Returns null unless at least two entries remain,
 * so callers fall back to the single current-tab behaviour.
 *
 * @returns {{tab: MozTabbrowserTab, displaySpec: string}[]|null}
 */
function getMultiSelectedCopyEntries() {
  const selectedTabs = gBrowser.selectedTabs;
  if (selectedTabs.length < 2) {
    return null;
  }

  const entries = [];
  for (const tab of gBrowser.tabs) {
    if (!selectedTabs.includes(tab)) {
      continue;
    }
    const uri = getTabCopyURI(tab);
    if (!uri || !(uri.schemeIs("http") || uri.schemeIs("https"))) {
      continue;
    }
    entries.push({ tab, displaySpec: getDisplaySpec(uri) });
  }

  return entries.length >= 2 ? entries : null;
}

/**
 * @param {string} text
 */
function copyStringToClipboard(text) {
  Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper)
    .copyString(text);
}

/**
 * Escapes a tab title for use as a Markdown link label.
 *
 * @param {string} label
 * @returns {string}
 */
function escapeMarkdownLabel(label) {
  return label.replace(/\s+/g, " ").replace(/[[\]]/g, "\\$&");
}

/**
 * Percent-encodes characters that would end a Markdown link destination early.
 *
 * @param {string} url
 * @returns {string}
 */
function escapeMarkdownUrl(url) {
  return url.replace(/[()\s]/g, c => encodeURIComponent(c));
}

/**
 * Copies only the selected tab's URL, with a share button when available.
 */
function copyCurrentTabURL() {
  const [currentUrl, ClipboardHelper] = gURLBar.zenStrippedURI;
  const displaySpec = getDisplaySpec(currentUrl);

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
}

window.gZenCommonActions = {
  /**
   * Copies every multi-selected http(s) tab URL, one per line, or the current
   * tab's URL when fewer than two copyable tabs are selected.
   */
  copyCurrentURLToClipboard() {
    const entries = getMultiSelectedCopyEntries();
    if (!entries) {
      copyCurrentTabURL();
      return;
    }
    copyStringToClipboard(entries.map(e => e.displaySpec).join("\n"));
    gZenUIManager.showToast("zen-copy-urls-confirmation", {
      l10nArgs: { count: entries.length },
      timeout: 3000,
    });
  },

  /** Copies only the current tab's URL. Used by the URL bar copy button. */
  copyCurrentTabURLToClipboard: copyCurrentTabURL,

  copyCurrentURLAsMarkdownToClipboard() {
    const entries = getMultiSelectedCopyEntries();
    if (entries) {
      copyStringToClipboard(
        entries
          .map(
            e =>
              `[${escapeMarkdownLabel(e.tab.label)}](${escapeMarkdownUrl(e.displaySpec)})`
          )
          .join("\n")
      );
      gZenUIManager.showToast("zen-copy-urls-as-markdown-confirmation", {
        l10nArgs: { count: entries.length },
        timeout: 3000,
      });
      return;
    }

    const [currentUrl, ClipboardHelper] = gURLBar.zenStrippedURI;
    const tabTitle = gBrowser.selectedTab.label;
    const displaySpec = getDisplaySpec(currentUrl);

    const markdownLink = `[${tabTitle}](${displaySpec})`;
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
