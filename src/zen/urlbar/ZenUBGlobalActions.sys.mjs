/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const globalActionsTemplate = [
  {
    label: 'Toggle Compact Mode',
    command: 'cmd_zenCompactModeToggle',
    icon: 'chrome://browser/skin/zen-icons/sidebar.svg',
    suggestedIndex: 0,
  },
  {
    label: 'Open Theme Picker',
    command: 'cmd_zenOpenZenThemePicker',
    icon: 'chrome://browser/skin/zen-icons/edit-theme.svg',
  },
  {
    label: 'New Split View',
    command: 'cmd_zenNewEmptySplit',
    icon: 'chrome://browser/skin/zen-icons/split.svg',
    suggestedIndex: 0,
  },
  {
    label: 'New Folder',
    command: 'cmd_zenOpenFolderCreation',
    icon: 'chrome://browser/skin/zen-icons/folder.svg',
  },
  {
    label: 'Copy Current URL',
    command: 'cmd_zenCopyCurrentURL',
    icon: 'chrome://browser/skin/zen-icons/edit-copy.svg',
    suggestedIndex: 0,
  },
  {
    label: 'Settings',
    command: (window) => window.openPreferences(),
    icon: 'chrome://browser/skin/zen-icons/settings.svg',
  },
  {
    label: 'Open New Window',
    command: 'cmd_newNavigator',
    icon: 'chrome://browser/skin/zen-icons/window.svg',
  },
  {
    label: 'Open Private Window',
    command: 'Tools:PrivateBrowsing',
    icon: 'chrome://browser/skin/zen-icons/private-window.svg',
  },
  {
    label: 'Toggle Pinned Tab',
    command: 'cmd_zenTogglePinTab',
    icon: 'chrome://browser/skin/zen-icons/pin.svg',
    isAvailable: (window) => {
      return !window.gBrowser.selectedTab.hasAttribute('zen-empty-tab');
    },
  },
  {
    label: 'Next Workspace',
    command: 'cmd_zenWorkspaceForward',
    icon: 'chrome://browser/skin/zen-icons/forward.svg',
  },
  {
    label: 'Previous Workspace',
    command: 'cmd_zenWorkspaceBackward',
    icon: 'chrome://browser/skin/zen-icons/back.svg',
  },
  {
    label: 'Close Tab',
    command: 'cmd_close',
    icon: 'chrome://browser/skin/zen-icons/close.svg',
    suggestedIndex: 1,
  },
];

export const globalActions = globalActionsTemplate.map((action) => ({
  isAvailable: (window) => {
    return window.document.getElementById(action.command)?.getAttribute('disabled') !== 'true';
  },
  extraPayload: {},
  ...action,
}));
