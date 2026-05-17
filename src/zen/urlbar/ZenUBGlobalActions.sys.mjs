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

function isNotEmptyTab(window) {
  return !window.gBrowser.selectedTab.hasAttribute("zen-empty-tab");
}

const globalActionsTemplate = [
  {
    label: "Toggle Compact Mode",
    l10nId: "zen-urlbar-action-toggle-compact-mode",
    command: "cmd_zenCompactModeToggle",
    icon: "chrome://browser/skin/zen-icons/sidebar.svg",
  },
  {
    label: "Open Theme Picker",
    l10nId: "zen-urlbar-action-open-theme-picker",
    command: "cmd_zenOpenZenThemePicker",
    icon: "chrome://browser/skin/zen-icons/edit-theme.svg",
  },
  {
    label: "New Split View",
    l10nId: "zen-urlbar-action-new-split-view",
    command: "cmd_zenNewEmptySplit",
    icon: "chrome://browser/skin/zen-icons/split.svg",
  },
  {
    label: "New Folder",
    l10nId: "zen-urlbar-action-new-folder",
    command: "cmd_zenOpenFolderCreation",
    icon: "chrome://browser/skin/zen-icons/folder.svg",
  },
  {
    label: "Copy Current URL",
    l10nId: "zen-urlbar-action-copy-current-url",
    command: "cmd_zenCopyCurrentURL",
    icon: "chrome://browser/skin/zen-icons/link.svg",
  },
  {
    label: "Settings",
    l10nId: "zen-urlbar-action-settings",
    command: window => window.openPreferences(),
    icon: "chrome://browser/skin/zen-icons/settings.svg",
  },
  {
    label: "Open Private Window",
    l10nId: "zen-urlbar-action-open-private-window",
    command: "Tools:PrivateBrowsing",
    icon: "chrome://browser/skin/zen-icons/private-window.svg",
  },
  {
    label: "Open New Window",
    l10nId: "zen-urlbar-action-open-new-window",
    command: "cmd_newNavigator",
    icon: "chrome://browser/skin/zen-icons/window.svg",
  },
  {
    label: "New Blank Window",
    l10nId: "zen-urlbar-action-new-blank-window",
    command: "cmd_zenNewNavigatorUnsynced",
    icon: "chrome://browser/skin/zen-icons/window.svg",
  },
  {
    label: "Pin Tab",
    l10nId: "zen-urlbar-action-pin-tab",
    command: "cmd_zenTogglePinTab",
    icon: "chrome://browser/skin/zen-icons/pin.svg",
    isAvailable: window => {
      const tab = window.gBrowser.selectedTab;
      return !tab.hasAttribute("zen-empty-tab") && !tab.pinned;
    },
  },
  {
    label: "Unpin Tab",
    l10nId: "zen-urlbar-action-unpin-tab",
    command: "cmd_zenTogglePinTab",
    icon: "chrome://browser/skin/zen-icons/unpin.svg",
    isAvailable: window => {
      const tab = window.gBrowser.selectedTab;
      return !tab.hasAttribute("zen-empty-tab") && tab.pinned;
    },
  },
  {
    label: "Next Space",
    l10nId: "zen-urlbar-action-next-space",
    command: "cmd_zenWorkspaceForward",
    icon: "chrome://browser/skin/zen-icons/forward.svg",
    isAvailable: window => {
      return window.gZenWorkspaces._workspaceCache.length > 1;
    },
  },
  {
    label: "Previous Space",
    l10nId: "zen-urlbar-action-previous-space",
    command: "cmd_zenWorkspaceBackward",
    icon: "chrome://browser/skin/zen-icons/back.svg",
    isAvailable: window => {
      // This also covers the case of being in private mode
      return window.gZenWorkspaces._workspaceCache.length > 1;
    },
  },
  {
    label: "Close Tab",
    l10nId: "zen-urlbar-action-close-tab",
    command: "cmd_close",
    icon: "chrome://browser/skin/zen-icons/close.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    label: "Reload Tab",
    l10nId: "zen-urlbar-action-reload-tab",
    command: "Browser:Reload",
    icon: "chrome://browser/skin/zen-icons/reload.svg",
  },
  {
    label: "Reload Tab Without Cache",
    l10nId: "zen-urlbar-action-reload-tab-without-cache",
    command: "Browser:ReloadSkipCache",
    icon: "chrome://browser/skin/zen-icons/reload.svg",
  },
  {
    label: "Next Tab",
    l10nId: "zen-urlbar-action-next-tab",
    command: "Browser:NextTab",
    icon: "chrome://browser/skin/zen-icons/forward.svg",
  },
  {
    label: "Previous Tab",
    l10nId: "zen-urlbar-action-previous-tab",
    command: "Browser:PrevTab",
    icon: "chrome://browser/skin/zen-icons/back.svg",
  },
  {
    label: "Capture Screenshot",
    l10nId: "zen-urlbar-action-capture-screenshot",
    command: "Browser:Screenshot",
    icon: "chrome://browser/skin/zen-icons/screenshot.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    label: "Toggle Tabs on right",
    l10nId: "zen-urlbar-action-toggle-tabs-on-right",
    command: "cmd_zenToggleTabsOnRight",
    icon: "chrome://browser/skin/zen-icons/sidebars-right.svg",
  },
  {
    label: "Add to Essentials",
    l10nId: "zen-urlbar-action-add-to-essentials",
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
    label: "Remove from Essentials",
    l10nId: "zen-urlbar-action-remove-from-essentials",
    command: window =>
      window.gZenPinnedTabManager.removeEssentials(window.gBrowser.selectedTab),
    isAvailable: window =>
      window.gBrowser.selectedTab.hasAttribute("zen-essential"),
    icon: "chrome://browser/skin/zen-icons/essential-remove.svg",
  },
  {
    label: "Find in Page",
    l10nId: "zen-urlbar-action-find-in-page",
    command: "cmd_find",
    icon: "chrome://browser/skin/zen-icons/search-page.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    label: "Manage Extensions",
    l10nId: "zen-urlbar-action-manage-extensions",
    command: "Tools:Addons",
    icon: "chrome://browser/skin/zen-icons/extension.svg",
  },
  {
    label: "Switch to Automatic Appearance",
    l10nId: "zen-urlbar-action-switch-to-automatic-appearance",
    command: () => Services.prefs.setIntPref("zen.view.window.scheme", 2),
    icon: "chrome://browser/skin/zen-icons/sparkles.svg",
    isAvailable: () => {
      return lazy.currentTheme !== 2;
    },
  },
  {
    label: "Switch to Light Mode",
    l10nId: "zen-urlbar-action-switch-to-light-mode",
    command: () => Services.prefs.setIntPref("zen.view.window.scheme", 1),
    icon: "chrome://browser/skin/zen-icons/face-sun.svg",
    isAvailable: () => {
      return lazy.currentTheme !== 1;
    },
  },
  {
    label: "Switch to Dark Mode",
    l10nId: "zen-urlbar-action-switch-to-dark-mode",
    command: () => Services.prefs.setIntPref("zen.view.window.scheme", 0),
    icon: "chrome://browser/skin/zen-icons/moon-stars.svg",
    isAvailable: () => {
      return lazy.currentTheme !== 0;
    },
  },
  {
    label: "Print",
    l10nId: "zen-urlbar-action-print",
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
      : `zen:global-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`,
  extraPayload: {},
  ...action,
}));
