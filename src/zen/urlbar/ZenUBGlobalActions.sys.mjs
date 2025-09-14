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
    suggestedIndex: 4,
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
];

export const globalActions = globalActionsTemplate.map((action) => ({
  ...action,
  isAvailable: (window) => {
    return window.document.getElementById(action.command)?.getAttribute('disabled') !== 'true';
  },
}));
