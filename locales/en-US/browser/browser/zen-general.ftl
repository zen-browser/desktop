# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = current profile

unified-extensions-description = Extensions are used to bring more extra functionality into { -brand-short-name }.
tab-context-zen-reset-pinned-tab =
    .label =
        { $isEssential ->
            [true] Reset Essential Tab
           *[false] Reset Pinned Tab
        }
    .accesskey = R
tab-context-zen-add-essential =
    .label = Add to Essentials
    .accesskey = E
tab-context-zen-add-essential-badge = { $num } / { $max }
tab-context-zen-remove-essential =
    .label = Remove from Essentials
    .accesskey = R
tab-context-zen-replace-pinned-url-with-current =
    .label =
        { $isEssential ->
            [true] Replace Essential URL with Current
           *[false] Replace Pinned URL with Current
        }
    .accesskey = C
tab-context-zen-edit-title =
    .label = Change Label...
tab-context-zen-edit-icon =
    .label = Change Icon...

zen-themes-corrupted = Your { -brand-short-name } mods file is corrupted. They have been reset to the default theme.
zen-shortcuts-corrupted = Your { -brand-short-name } shortcuts file is corrupted. They have been reset to the default shortcuts.

# note: Do not translate the "<br/>" tags in the following string
zen-new-urlbar-notification = The new URL bar has been enabled, removing the need for new tab pages.<br/><br/>
    Try opening a new tab to see the new URL bar in action!

zen-disable = Disable

pictureinpicture-minimize-btn =
  .aria-label = Minimize
  .tooltip = Minimize

zen-panel-ui-gradient-generator-custom-color = Custom Color

zen-copy-current-url-confirmation = Copied current URL!
zen-copy-current-url-as-markdown-confirmation = Copied current URL as Markdown!

zen-general-cancel-label =
    .label = Cancel
zen-general-confirm =
    .label = Confirm

zen-pinned-tab-replaced = Pinned tab URL has been replaced with the current URL!
zen-tabs-renamed = Tab has been successfully renamed!
zen-background-tab-opened-toast = New background tab opened!
zen-workspace-renamed-toast = Workspace has been successfully renamed!
zen-split-view-limit-toast = Can't add more panels to the split view!

zen-toggle-compact-mode-button =
    .label = Compact Mode
    .tooltiptext = Toggle Compact Mode

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = Learn More

zen-close-label = Close

zen-singletoolbar-urlbar-placeholder-with-name =
  .placeholder = Search...

zen-icons-picker-emoji =
  .label = Emojis
zen-icons-picker-svg =
  .label = Icons
zen-icons-picker-search =
  .placeholder = Search emojis

urlbar-search-mode-zen_actions = Actions
zen-urlbar-action-toggle-compact-mode = Toggle Compact Mode
zen-urlbar-action-open-theme-picker = Open Theme Picker
zen-urlbar-action-new-split-view = New Split View
zen-urlbar-action-new-folder = New Folder
zen-urlbar-action-copy-current-url = Copy Current URL
zen-urlbar-action-settings = Settings
zen-urlbar-action-open-private-window = Open Private Window
zen-urlbar-action-open-new-window = Open New Window
zen-urlbar-action-new-blank-window = New Blank Window
zen-urlbar-action-pin-tab = Pin Tab
zen-urlbar-action-unpin-tab = Unpin Tab
zen-urlbar-action-next-space = Next Space
zen-urlbar-action-previous-space = Previous Space
zen-urlbar-action-close-tab = Close Tab
zen-urlbar-action-reload-tab = Reload Tab
zen-urlbar-action-reload-tab-without-cache = Reload Tab Without Cache
zen-urlbar-action-next-tab = Next Tab
zen-urlbar-action-previous-tab = Previous Tab
zen-urlbar-action-capture-screenshot = Capture Screenshot
zen-urlbar-action-toggle-tabs-on-right = Toggle Tabs on right
zen-urlbar-action-add-to-essentials = Add to Essentials
zen-urlbar-action-remove-from-essentials = Remove from Essentials
zen-urlbar-action-find-in-page = Find in Page
zen-urlbar-action-manage-extensions = Manage Extensions
zen-urlbar-action-switch-to-automatic-appearance = Switch to Automatic Appearance
zen-urlbar-action-switch-to-light-mode = Switch to Light Mode
zen-urlbar-action-switch-to-dark-mode = Switch to Dark Mode
zen-urlbar-action-print = Print
zen-urlbar-action-focus-on = Focus on
zen-urlbar-action-extension = Extension
zen-site-data-settings = Settings

zen-generic-manage = Manage
zen-generic-more = More
zen-generic-next = Next

zen-essentials-promo-label = Add to Essentials
zen-essentials-promo-sublabel = Keep your favorite tabs just a click away

# These labels will be used for the site data panel settings
zen-site-data-setting-allow = Allowed
zen-site-data-setting-block = Blocked
zen-site-data-protections-enabled = Enabled
zen-site-data-protections-disabled = Disabled
zen-site-data-setting-cross-site = Cross-Site cookie
zen-site-data-security-info-extension =
    .label = Extension
zen-site-data-security-info-secure =
    .label = Secure
zen-site-data-security-info-not-secure =
    .label = Not Secure

zen-site-data-manage-addons =
    .label = Manage Extensions
zen-site-data-get-addons =
    .label = Add Extensions
zen-site-data-site-settings =
    .label = All Site Settings


zen-site-data-header-share =
    .tooltiptext = Share This Page
zen-site-data-header-reader-mode =
    .tooltiptext = Enter Reader Mode
zen-site-data-header-screenshot =
    .tooltiptext = Take a Screenshot
zen-site-data-header-bookmark =
    .tooltiptext = Bookmark This Page

zen-urlbar-copy-url-button =
  .tooltiptext = Copy URL

zen-site-data-setting-site-protection = Tracking Protection

# Section: Feature callouts

zen-site-data-panel-feature-callout-title = A new home for add-ons, permissions, and more
zen-site-data-panel-feature-callout-subtitle = Click the icon to manage site settings, view security info, access extensions, and perform common actions.

zen-open-link-in-glance =
    .label = Open Link in Glance
    .accesskey = G

zen-sidebar-notification-updated-heading = Update Complete!

# See ZenSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = What's new in { -brand-short-name }
zen-sidebar-notification-updated-tooltip =
    .title = View Release Notes
zen-sidebar-notification-restart-safe-mode-label = Something broke?
zen-sidebar-notification-restart-safe-mode-tooltip =
    .title = Restart in Safe Mode

zen-window-sync-migration-dialog-title = Keep Your Windows in Sync
zen-window-sync-migration-dialog-message = Zen now syncs windows on the same device, so changes in one window are reflected across the others instantly.
zen-window-sync-migration-dialog-learn-more = Learn More
zen-window-sync-migration-dialog-accept = Got It

zen-appmenu-new-blank-window =
    .label = New blank window
