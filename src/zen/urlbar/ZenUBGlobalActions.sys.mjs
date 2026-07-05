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

ChromeUtils.defineLazyGetter(lazy, "l10n", () => {
  return new Localization(["browser/zen-command-palette.ftl"], true);
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
    icon: "chrome://browser/skin/zen-icons/edit-theme.svg",
  },
  {
    l10nId: "zen-action-new-split-view",
    command: "cmd_zenNewEmptySplit",
    icon: "chrome://browser/skin/zen-icons/split.svg",
  },
  {
    l10nId: "zen-action-new-folder",
    command: "cmd_zenOpenFolderCreation",
    icon: "chrome://browser/skin/zen-icons/folder.svg",
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
];

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
    return lazy.l10n.formatValueSync(action.l10nId);
  },
}));
