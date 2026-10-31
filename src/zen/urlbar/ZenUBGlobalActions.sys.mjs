/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "currentTheme",
  "zen.view.window.scheme",
  2
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "libraryEnabled",
  "zen.library.enabled",
  true
);

ChromeUtils.defineLazyGetter(lazy, "l10n", () => {
  return new Localization(["browser/zen-command-palette.ftl"], true);
});

ChromeUtils.defineESModuleGetters(lazy, {
  SessionStore:
    "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs",
  SharingUtils:
    "moz-src:///browser/components/sharing/SharingUtils.sys.mjs",
  Sanitizer: "resource:///modules/Sanitizer.sys.mjs",
  SiteDataManager: "resource:///modules/SiteDataManager.sys.mjs",
});

function isNotEmptyTab(window) {
  return !window.gBrowser.selectedTab.hasAttribute("zen-empty-tab");
}

const globalActionsTemplate = [
  {
    l10nId: "zen-action-toggle-compact-mode",
    command: "cmd_zenCompactModeToggle",
    icon: "chrome://browser/skin/zen-icons/sidebar.svg",
  },
  {
    l10nId: "zen-action-open-theme-picker",
    command: "cmd_zenOpenZenThemePicker",
    icon: "chrome://browser/skin/zen-icons/paintbrush-fill.svg",
  },
  {
    l10nId: "zen-action-open-library",
    command: "cmd_zenToggleLibrary",
    icon: "chrome://browser/skin/zen-icons/library.svg",
    isAvailable: () => {
      return lazy.libraryEnabled;
    },
  },
  {
    l10nId: "zen-action-new-split-view",
    command: "cmd_zenNewEmptySplit",
    icon: "chrome://browser/skin/zen-icons/split.svg",
  },
  {
    l10nId: "zen-action-unsplit-view",
    command: "cmd_zenSplitViewUnsplit",
    icon: "chrome://browser/skin/zen-icons/split.svg",
    isAvailable: window => {
      return window.gZenViewSplitter.splitViewActive;
    },
  },
  {
    l10nId: "zen-action-new-space",
    command: "cmd_zenOpenWorkspaceCreation",
    icon: "chrome://browser/skin/zen-icons/plus.svg",
  },
  {
    l10nId: "zen-action-new-folder",
    command: "cmd_zenOpenFolderCreation",
    icon: "chrome://browser/skin/zen-icons/folder.svg",
  },
  {
    l10nId: "zen-action-collapse-all-folders",
    command: window => window.gZenFolders.collapseAllFolders(),
    icon: "chrome://browser/skin/zen-icons/arrows-collapse.svg",
    isAvailable: window => {
      return !!window.gZenFolders?.activeSpaceFolders.some(
        folder => !folder.collapsed
      );
    },
  },
  {
    l10nId: "zen-action-expand-all-folders",
    command: window => window.gZenFolders.expandAllFolders(),
    icon: "chrome://browser/skin/zen-icons/arrows-expand.svg",
    isAvailable: window => {
      return !!window.gZenFolders?.activeSpaceFolders.some(
        folder => folder.collapsed
      );
    },
  },
  {
    l10nId: "zen-action-copy-current-url",
    command: "cmd_zenCopyCurrentURL",
    icon: "chrome://browser/skin/zen-icons/link.svg",
  },
  {
    l10nId: "zen-action-settings",
    command: window => window.openPreferences(),
    icon: "chrome://browser/skin/zen-icons/settings.svg",
  },
  {
    l10nId: "zen-action-open-private-window",
    command: "Tools:PrivateBrowsing",
    icon: "chrome://browser/skin/zen-icons/private-window.svg",
  },
  {
    l10nId: "zen-action-open-new-window",
    command: "cmd_newNavigator",
    icon: "chrome://browser/skin/zen-icons/window.svg",
  },
  {
    l10nId: "zen-action-new-blank-window",
    command: "cmd_zenNewNavigatorUnsynced",
    icon: "chrome://browser/skin/zen-icons/window.svg",
  },
  {
    l10nId: "zen-action-pin-tab",
    command: "cmd_zenTogglePinTab",
    icon: "chrome://browser/skin/zen-icons/pin.svg",
    isAvailable: window => {
      const tab = window.gBrowser.selectedTab;
      return !tab.hasAttribute("zen-empty-tab") && !tab.pinned;
    },
  },
  {
    l10nId: "zen-action-unpin-tab",
    command: "cmd_zenTogglePinTab",
    icon: "chrome://browser/skin/zen-icons/unpin.svg",
    isAvailable: window => {
      const tab = window.gBrowser.selectedTab;
      return !tab.hasAttribute("zen-empty-tab") && tab.pinned;
    },
  },
  {
    l10nId: "zen-action-open-space-routing",
    command: "cmd_zenOpenSpaceRoutingSettings",
    icon: "chrome://browser/skin/zen-icons/selectable/airplane.svg",
  },
  {
    l10nId: "zen-action-new-boost",
    icon: "chrome://browser/skin/zen-icons/boost.svg",
    isAvailable: window => {
      if (!isNotEmptyTab(window)) {
        return false;
      }

      // Keep this action consistent with the rest of the Boosts UI.
      if (!Services.prefs.getBoolPref("zen.boosts.enabled", false)) {
        return false;
      }

      const uri = window.gBrowser.currentURI;
      return !!uri?.schemeIs && (uri.schemeIs("http") || uri.schemeIs("https"));
    },
    command: window => {
      const uri = window.gBrowser.currentURI;
      if (!uri?.schemeIs || !(uri.schemeIs("http") || uri.schemeIs("https"))) {
        return;
      }

      let domain = "";
      try {
        domain = uri.host;
      } catch {
        return;
      }

      if (!domain) {
        return;
      }

      const { gZenBoostsManager } = ChromeUtils.importESModule(
        "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs"
      );
      const boost = gZenBoostsManager.createNewBoost(domain);
      if (!boost) {
        return;
      }
      gZenBoostsManager.openBoostWindow(window, boost, uri);
    },
  },
  {
    l10nId: "zen-action-next-space",
    command: "cmd_zenWorkspaceForward",
    icon: "chrome://browser/skin/zen-icons/forward.svg",
    isAvailable: window => {
      return window.gZenWorkspaces._workspaceCache.length > 1;
    },
  },
  {
    l10nId: "zen-action-previous-space",
    command: "cmd_zenWorkspaceBackward",
    icon: "chrome://browser/skin/zen-icons/back.svg",
    isAvailable: window => {
      // This also covers the case of being in private mode
      return window.gZenWorkspaces._workspaceCache.length > 1;
    },
  },
  {
    l10nId: "zen-action-close-tab",
    command: "cmd_close",
    icon: "chrome://browser/skin/zen-icons/close.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-reopen-closed-tab",
    command: "History:RestoreLastClosedTabOrWindowOrSession",
    icon: "chrome://browser/skin/zen-icons/history.svg",
    isAvailable: window => {
      return !!lazy.SessionStore.getClosedTabCount({
        sourceWindow: window,
      }).length;
    },
  },
  {
    l10nId: "zen-action-duplicate-tab",
    command: "Browser:DuplicateTab",
    icon: "chrome://browser/skin/zen-icons/duplicate-tab.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-reset-pinned-tab",
    command: "cmd_zenPinnedTabReset",
    icon: "chrome://browser/skin/zen-icons/arrow-rotate-anticlockwise.svg",
    isAvailable: window => {
      const tab = window.gBrowser.selectedTab;
      return tab.pinned && tab.hasAttribute("zen-pinned-changed");
    },
  },
  {
    l10nId: "zen-action-reload-tab",
    command: "Browser:Reload",
    icon: "chrome://browser/skin/zen-icons/reload.svg",
  },
  {
    l10nId: "zen-action-reload-tab-without-cache",
    command: "Browser:ReloadSkipCache",
    icon: "chrome://browser/skin/zen-icons/reload.svg",
  },
  {
    l10nId: "zen-action-next-tab",
    command: "Browser:NextTab",
    icon: "chrome://browser/skin/zen-icons/forward.svg",
  },
  {
    l10nId: "zen-action-previous-tab",
    command: "Browser:PrevTab",
    icon: "chrome://browser/skin/zen-icons/back.svg",
  },
  {
    l10nId: "zen-action-capture-screenshot",
    command: "Browser:Screenshot",
    icon: "chrome://browser/skin/zen-icons/screenshot.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-toggle-tabs-on-right",
    command: "cmd_zenToggleTabsOnRight",
    icon: "chrome://browser/skin/zen-icons/sidebars-right.svg",
  },
  {
    l10nId: "zen-action-add-to-essentials",
    command: window =>
      window.gZenPinnedTabManager.addToEssentials(window.gBrowser.selectedTab),
    isAvailable: window => {
      return (
        window.gZenPinnedTabManager.canEssentialBeAdded(
          window.gBrowser.selectedTab
        ) && !window.gBrowser.selectedTab.hasAttribute("zen-essential")
      );
    },
    icon: "chrome://browser/skin/zen-icons/essential-add.svg",
  },
  {
    l10nId: "zen-action-remove-from-essentials",
    command: window =>
      window.gZenPinnedTabManager.removeEssentials(window.gBrowser.selectedTab),
    isAvailable: window =>
      window.gBrowser.selectedTab.hasAttribute("zen-essential"),
    icon: "chrome://browser/skin/zen-icons/essential-remove.svg",
  },
  {
    l10nId: "zen-action-find-in-page",
    command: "cmd_find",
    icon: "chrome://browser/skin/zen-icons/search-page.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-manage-extensions",
    command: "Tools:Addons",
    icon: "chrome://browser/skin/zen-icons/extension.svg",
  },
  {
    l10nId: "zen-action-switch-to-automatic-appearance",
    command: () => Services.prefs.setIntPref("zen.view.window.scheme", 2),
    icon: "chrome://browser/skin/zen-icons/sparkles.svg",
    isAvailable: () => {
      return lazy.currentTheme !== 2;
    },
  },
  {
    l10nId: "zen-action-switch-to-light-mode",
    command: () => Services.prefs.setIntPref("zen.view.window.scheme", 1),
    icon: "chrome://browser/skin/zen-icons/face-sun.svg",
    isAvailable: () => {
      return lazy.currentTheme !== 1;
    },
  },
  {
    l10nId: "zen-action-switch-to-dark-mode",
    command: () => Services.prefs.setIntPref("zen.view.window.scheme", 0),
    icon: "chrome://browser/skin/zen-icons/moon-stars.svg",
    isAvailable: () => {
      return lazy.currentTheme !== 0;
    },
  },
  {
    l10nId: "zen-action-print",
    command: "cmd_print",
    icon: "chrome://browser/skin/zen-icons/print.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-share-tab",
    command: window => {
      const currentUrl = window.gBrowser.currentURI;
      if (Services.zen?.canShare?.()) {
        Services.zen.share(
          currentUrl,
          "",
          "",
          Math.round(window.innerWidth / 2),
          Math.round(window.innerHeight / 2),
          0,
          0
        );
      } else {
        window.gZenCommonActions.copyCurrentURLToClipboard();
      }
    },
    icon: "chrome://browser/skin/zen-icons/share.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-page-qr-code",
    command: window => {
      lazy.SharingUtils.showQRCodePanel(
        window,
        window.gBrowser.selectedBrowser,
        window.gBrowser.currentURI.spec
      );
    },
    icon: "chrome://browser/skin/qrcode.svg",
    isAvailable: window => {
      return isNotEmptyTab(window) && !!window.gBrowser.currentURI?.spec;
    },
  },
  {
    l10nId: "zen-action-toggle-reader-mode",
    command: "View:ReaderView",
    icon: "chrome://browser/skin/zen-icons/reader-mode.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-copy-current-url-markdown",
    command: "cmd_zenCopyCurrentURLMarkdown",
    icon: "chrome://browser/skin/zen-icons/link.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-close-unpinned-tabs",
    command: "cmd_zenCloseUnpinnedTabs",
    icon: "chrome://browser/skin/zen-icons/close.svg",
    isAvailable: window => {
      return window.gBrowser.tabs.some(
        tab => !tab.pinned && !tab.hasAttribute("zen-empty-tab")
      );
    },
  },
  {
    l10nId: "zen-action-unload-workspace",
    command: "cmd_zenUnloadWorkspace",
    icon: "chrome://browser/skin/zen-icons/selectable/bed.svg",
    isAvailable: window => {
      return !window.gZenWorkspaces?.privateWindowOrDisabled;
    },
  },
  {
    l10nId: "zen-action-toggle-split-view-direction",
    command: window => {
      const splitter = window.gZenViewSplitter;
      if (!splitter?.splitViewActive || splitter.currentView < 0) {
        return;
      }
      const group = splitter._data[splitter.currentView];
      const nextGridType = group.gridType === "hsep" ? "vsep" : "hsep";
      splitter.splitTabs(group.tabs, nextGridType);
    },
    icon: "chrome://browser/skin/zen-icons/split.svg",
    isAvailable: window => {
      return !!window.gZenViewSplitter?.splitViewActive;
    },
  },
  {
    l10nId: "zen-action-manage-spaces",
    command: "cmd_zenManageWorkspaces",
    icon: "chrome://browser/skin/zen-icons/manage.svg",
    isAvailable: () => {
      return lazy.libraryEnabled;
    },
  },
  {
    l10nId: "zen-action-replace-pinned-url-with-current",
    command: window =>
      window.gZenPinnedTabManager.replacePinnedUrlWithCurrent(
        window.gBrowser.selectedTab
      ),
    icon: "chrome://browser/skin/zen-icons/pin.svg",
    isAvailable: window => {
      const tab = window.gBrowser.selectedTab;
      return tab?.pinned && tab.hasAttribute("zen-pinned-changed");
    },
  },
  {
    l10nId: "zen-action-mute-tab",
    command: window => window.gBrowser.selectedTab.toggleMuteAudio(),
    icon: "chrome://browser/skin/zen-icons/media-mute.svg",
    isAvailable: window => {
      return isNotEmptyTab(window) && !window.gBrowser.selectedTab.muted;
    },
  },
  {
    l10nId: "zen-action-unmute-tab",
    command: window => window.gBrowser.selectedTab.toggleMuteAudio(),
    icon: "chrome://browser/skin/zen-icons/media-unmute.svg",
    isAvailable: window => {
      return isNotEmptyTab(window) && window.gBrowser.selectedTab.muted;
    },
  },
  {
    l10nId: "zen-action-open-downloads",
    command: "Tools:Downloads",
    icon: "chrome://browser/skin/zen-icons/downloads.svg",
  },
  {
    l10nId: "zen-action-open-history",
    command: "Browser:ShowAllHistory",
    icon: "chrome://browser/skin/zen-icons/history.svg",
  },
  {
    l10nId: "zen-action-clear-history",
    command: "Tools:Sanitize",
    icon: "chrome://browser/skin/zen-icons/trash.svg",
  },
  {
    l10nId: "zen-action-clear-browsing-data",
    command: window => {
      lazy.Sanitizer.showUI(window, "clearSiteData");
    },
    icon: "chrome://browser/skin/zen-icons/forget.svg",
  },
  {
    l10nId: "zen-action-clear-current-site-data",
    command: window => {
      let host = "";
      try {
        host = window.gBrowser.currentURI?.host;
      } catch {
        return;
      }
      if (!host) {
        return;
      }
      const baseDomain = lazy.SiteDataManager.getBaseDomainFromHost(host);
      if (lazy.SiteDataManager.promptSiteDataRemoval(window, [baseDomain])) {
        lazy.SiteDataManager.remove(baseDomain);
      }
    },
    icon: "chrome://browser/skin/zen-icons/trash.svg",
    isAvailable: window => {
      if (!isNotEmptyTab(window)) {
        return false;
      }
      try {
        return !!window.gBrowser.currentURI?.host;
      } catch {
        return false;
      }
    },
  },
  {
    l10nId: "zen-action-zoom-in",
    command: "cmd_fullZoomEnlarge",
    icon: "chrome://browser/skin/zen-icons/plus.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-zoom-out",
    command: "cmd_fullZoomReduce",
    icon: "chrome://browser/skin/zen-icons/zoom-out.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-zoom-reset",
    command: "cmd_fullZoomReset",
    icon: "chrome://browser/skin/zen-icons/arrow-rotate-anticlockwise.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-open-inspector",
    command: window => {
      const { require } = ChromeUtils.importESModule(
        "resource://devtools/shared/loader/Loader.sys.mjs"
      );
      const { gDevToolsBrowser } = require(
        "resource://devtools/client/framework/devtools-browser.js"
      );
      gDevToolsBrowser.selectToolCommand(window, "inspector");
    },
    icon: "chrome://browser/skin/zen-icons/developer.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-open-web-console",
    command: window => {
      const { require } = ChromeUtils.importESModule(
        "resource://devtools/shared/loader/Loader.sys.mjs"
      );
      const { gDevToolsBrowser } = require(
        "resource://devtools/client/framework/devtools-browser.js"
      );
      gDevToolsBrowser.selectToolCommand(window, "webconsole");
    },
    icon: "chrome://browser/skin/zen-icons/brackets-curly.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    l10nId: "zen-action-quit-application",
    command: "cmd_quitApplication",
    icon: "chrome://browser/skin/zen-icons/close.svg",
  },
];

const FALLBACK_LABELS = {
  "zen-action-share-tab": "Share Tab",
  "zen-action-page-qr-code": "Generate Page QR Code",
  "zen-action-toggle-reader-mode": "Toggle Reader Mode",
  "zen-action-copy-current-url-markdown": "Copy Current URL as Markdown",
  "zen-action-close-unpinned-tabs": "Close Unpinned Tabs",
  "zen-action-unload-workspace": "Unload Workspace",
  "zen-action-toggle-split-view-direction": "Toggle Split View Direction",
  "zen-action-manage-spaces": "Manage Spaces",
  "zen-action-replace-pinned-url-with-current":
    "Replace Pinned Tab URL with Current",
  "zen-action-mute-tab": "Mute Tab",
  "zen-action-unmute-tab": "Unmute Tab",
  "zen-action-open-downloads": "Open Downloads",
  "zen-action-open-history": "Open History",
  "zen-action-clear-history": "Clear Recent History",
  "zen-action-clear-browsing-data": "Clear Cookies and Site Data",
  "zen-action-clear-current-site-data": "Clear Data for This Site",
  "zen-action-zoom-in": "Zoom In",
  "zen-action-zoom-out": "Zoom Out",
  "zen-action-zoom-reset": "Reset Zoom",
  "zen-action-open-inspector": "Toggle Developer Tools / Inspector",
  "zen-action-open-web-console": "Open Web Console",
  "zen-action-quit-application": "Quit Browser",
};

export function formatValueSync(l10nId) {
  try {
    return lazy.l10n.formatValueSync(l10nId) || FALLBACK_LABELS[l10nId] || l10nId;
  } catch {
    return FALLBACK_LABELS[l10nId] || l10nId;
  }
}

const labels = new Map();

Services.obs.addObserver(() => labels.clear(), "intl:app-locales-changed");

/**
 * @param {string} l10nId - The message holding an action's text
 * @returns {string} What it says, in the language in use
 */
export function labelFor(l10nId) {
  let label = labels.get(l10nId);
  if (label === undefined) {
    label = formatValueSync(l10nId);
    if (label) {
      labels.set(l10nId, label);
    }
  }
  return label;
}

export const globalActions = globalActionsTemplate.map(action => ({
  isAvailable: window => {
    return (
      window.document
        .getElementById(action.command)
        ?.getAttribute("disabled") !== "true"
    );
  },
  commandId:
    typeof action.command === "string"
      ? action.command
      : `zen:global-action-${action.l10nId.replace("zen-action-", "")}`,
  extraPayload: {},
  ...action,
  get label() {
    return labelFor(action.l10nId);
  },
}));
