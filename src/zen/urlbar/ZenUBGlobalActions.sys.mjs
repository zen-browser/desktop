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
    command: "cmd_zenCompactModeToggle",
    icon: "chrome://browser/skin/zen-icons/sidebar.svg",
  },
  {
    label: "Open Theme Picker",
    command: "cmd_zenOpenZenThemePicker",
    icon: "chrome://browser/skin/zen-icons/edit-theme.svg",
    // Astra: Edit Theme is pref-gated (default off).
    isAvailable: () =>
      Services.prefs.getBoolPref("astra.feature.editTheme.enabled", false),
  },
  {
    label: "Astra App Hub",
    command: window => window.gZenAppLauncher?.toggle?.(null, window),
    icon: "chrome://browser/skin/zen-icons/selectable/grid-3x3.svg",
  },
  {
    label: "India Services",
    command: window => window.gZenIndiaGov?.open?.(null, window),
    icon: "chrome://browser/skin/zen-icons/selectable/flag.svg",
  },
  {
    label: "SMART Guard Safety Check",
    command: "cmd_zenSmartGuardDetails",
    icon: "chrome://browser/skin/zen-icons/shield.svg",
  },
  {
    label: "Search Open Tabs",
    command: "cmd_zenSearchOpenTabs",
    icon: "chrome://browser/skin/zen-icons/search-glass.svg",
  },
  {
    label: "Optimize Memory (Smart Suspend)",
    command: "cmd_zenSmartSuspendNow",
    icon: "chrome://browser/skin/zen-icons/selectable/time.svg",
  },
  {
    label: "Crash Recovery",
    command: "cmd_zenOpenCrashRecovery",
    icon: "chrome://browser/skin/zen-icons/security-warning.svg",
  },
  {
    label: "Quick Add Current Tab to Folder",
    command: "cmd_zenQuickAddCurrentTabToFolder",
    icon: "chrome://browser/skin/zen-icons/folder.svg",
    isAvailable: window => {
      const tab = window.gBrowser.selectedTab;
      return !tab.hasAttribute("zen-empty-tab") && !tab.hasAttribute("zen-essential");
    },
  },
  {
    label: "Undo Last Workspace Move",
    command: "cmd_zenUndoLastWorkspaceMove",
    icon: "chrome://browser/skin/zen-icons/history.svg",
  },
  {
    label: "Open IRCTC",
    command: window => window.openTrustedLinkIn("https://www.irctc.co.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/navigate.svg",
  },
  {
    label: "Open DigiLocker",
    command: window =>
      window.openTrustedLinkIn("https://www.digilocker.gov.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/folder.svg",
  },
  {
    label: "Open BHIM UPI",
    command: window => window.openTrustedLinkIn("https://www.bhimupi.org.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/wallet.svg",
  },
  {
    label: "Open UMANG",
    command: window => window.openTrustedLinkIn("https://web.umang.gov.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/grid-2x2.svg",
  },
  {
    label: "Open Income Tax",
    command: window =>
      window.openTrustedLinkIn("https://www.incometax.gov.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/stats-chart.svg",
  },
  {
    label: "Open Aadhaar",
    command: window =>
      window.openTrustedLinkIn("https://myaadhaar.uidai.gov.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/navigate.svg",
  },
  {
    label: "Open Passport Seva",
    command: window =>
      window.openTrustedLinkIn("https://passportindia.gov.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/briefcase.svg",
  },
  {
    label: "Open EPFO",
    command: window => window.openTrustedLinkIn("https://www.epfindia.gov.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/people.svg",
  },
  {
    label: "Open GST Portal",
    command: window => window.openTrustedLinkIn("https://www.gst.gov.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/stats-chart.svg",
  },
  {
    label: "Open NPCI",
    command: window => window.openTrustedLinkIn("https://www.npci.org.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/wallet.svg",
  },
  {
    label: "Open Scholarships NSP",
    command: window => window.openTrustedLinkIn("https://scholarships.gov.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/navigate.svg",
  },
  {
    label: "Open PM-KISAN",
    command: window => window.openTrustedLinkIn("https://pmkisan.gov.in", "tab"),
    icon: "chrome://browser/skin/zen-icons/people.svg",
  },
  {
    label: "New Split View",
    command: "cmd_zenNewEmptySplit",
    icon: "chrome://browser/skin/zen-icons/split.svg",
  },
  {
    label: "New Folder",
    command: "cmd_zenOpenFolderCreation",
    icon: "chrome://browser/skin/zen-icons/folder.svg",
  },
  {
    label: "Copy Current URL",
    command: "cmd_zenCopyCurrentURL",
    icon: "chrome://browser/skin/zen-icons/link.svg",
  },
  {
    label: "Rupee: Copy ₹ Symbol",
    command: window =>
      window.gZenCommonActions.copyToClipboardWithSmartGuard(
        "₹",
        "rupee-symbol"
      ),
    icon: "chrome://browser/skin/zen-icons/wallet.svg",
  },
  {
    label: "Settings",
    command: window => window.openPreferences(),
    icon: "chrome://browser/skin/zen-icons/settings.svg",
  },
  {
    label: "Open Private Window",
    command: "Tools:PrivateBrowsing",
    icon: "chrome://browser/skin/zen-icons/private-window.svg",
  },
  {
    label: "Open New Window",
    command: "cmd_newNavigator",
    icon: "chrome://browser/skin/zen-icons/window.svg",
  },
  {
    label: "New Blank Window",
    command: "cmd_zenNewNavigatorUnsynced",
    icon: "chrome://browser/skin/zen-icons/window.svg",
  },
  {
    label: "Pin Tab",
    command: "cmd_zenTogglePinTab",
    icon: "chrome://browser/skin/zen-icons/pin.svg",
    isAvailable: window => {
      const tab = window.gBrowser.selectedTab;
      return !tab.hasAttribute("zen-empty-tab") && !tab.pinned;
    },
  },
  {
    label: "Unpin Tab",
    command: "cmd_zenTogglePinTab",
    icon: "chrome://browser/skin/zen-icons/unpin.svg",
    isAvailable: window => {
      const tab = window.gBrowser.selectedTab;
      return !tab.hasAttribute("zen-empty-tab") && tab.pinned;
    },
  },
  {
    label: "Next Space",
    command: "cmd_zenWorkspaceForward",
    icon: "chrome://browser/skin/zen-icons/forward.svg",
    isAvailable: window => {
      return window.gZenWorkspaces._workspaceCache.length > 1;
    },
  },
  {
    label: "Previous Space",
    command: "cmd_zenWorkspaceBackward",
    icon: "chrome://browser/skin/zen-icons/back.svg",
    isAvailable: window => {
      // This also covers the case of being in private mode
      return window.gZenWorkspaces._workspaceCache.length > 1;
    },
  },
  {
    label: "Close Tab",
    command: "cmd_close",
    icon: "chrome://browser/skin/zen-icons/close.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    label: "Reload Tab",
    command: "Browser:Reload",
    icon: "chrome://browser/skin/zen-icons/reload.svg",
  },
  {
    label: "Reload Tab Without Cache",
    command: "Browser:ReloadSkipCache",
    icon: "chrome://browser/skin/zen-icons/reload.svg",
  },
  {
    label: "Next Tab",
    command: "Browser:NextTab",
    icon: "chrome://browser/skin/zen-icons/forward.svg",
  },
  {
    label: "Previous Tab",
    command: "Browser:PrevTab",
    icon: "chrome://browser/skin/zen-icons/back.svg",
  },
  {
    label: "Capture Screenshot",
    command: "Browser:Screenshot",
    icon: "chrome://browser/skin/zen-icons/screenshot.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    label: "Toggle Tabs on right",
    command: "cmd_zenToggleTabsOnRight",
    icon: "chrome://browser/skin/zen-icons/sidebars-right.svg",
  },
  {
    label: "Add to Essentials",
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
    command: window =>
      window.gZenPinnedTabManager.removeEssentials(window.gBrowser.selectedTab),
    isAvailable: window =>
      window.gBrowser.selectedTab.hasAttribute("zen-essential"),
    icon: "chrome://browser/skin/zen-icons/essential-remove.svg",
  },
  {
    label: "Find in Page",
    command: "cmd_find",
    icon: "chrome://browser/skin/zen-icons/search-page.svg",
    isAvailable: window => {
      return isNotEmptyTab(window);
    },
  },
  {
    label: "Manage Extensions",
    command: "Tools:Addons",
    icon: "chrome://browser/skin/zen-icons/extension.svg",
  },
  {
    label: "Switch to Automatic Appearance",
    command: () => Services.prefs.setIntPref("zen.view.window.scheme", 2),
    icon: "chrome://browser/skin/zen-icons/sparkles.svg",
    isAvailable: () => {
      return lazy.currentTheme !== 2;
    },
  },
  {
    label: "Switch to Light Mode",
    command: () => Services.prefs.setIntPref("zen.view.window.scheme", 1),
    icon: "chrome://browser/skin/zen-icons/face-sun.svg",
    isAvailable: () => {
      return lazy.currentTheme !== 1;
    },
  },
  {
    label: "Switch to Dark Mode",
    command: () => Services.prefs.setIntPref("zen.view.window.scheme", 0),
    icon: "chrome://browser/skin/zen-icons/moon-stars.svg",
    isAvailable: () => {
      return lazy.currentTheme !== 0;
    },
  },
  {
    label: "Print",
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
