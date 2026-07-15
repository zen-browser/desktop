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

zen-toggle-compact-mode-button =
    .label = Compact Mode
    .tooltiptext = Toggle Compact Mode

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = Learn More

zen-close-label = Close

zen-singletoolbar-urlbar-placeholder-with-name =
  .placeholder = Search...

zen-icons-picker-emoji =
  .label = India Emojis
zen-icons-picker-svg =
  .label = India Icons
zen-icons-picker-search-placeholder =
  .placeholder = Search India icons and emojis
zen-icons-picker-category-all =
  .label = All
zen-icons-picker-category-essentials =
  .label = Essentials
zen-icons-picker-category-productivity =
  .label = Productive
zen-icons-picker-category-festivals =
  .label = Festivals
zen-icons-picker-category-fun =
  .label = Fun

urlbar-search-mode-zen_actions = Actions
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
zen-site-data-header-read-aloud =
    .tooltiptext = Read Aloud (opens Reader View — use Listen)
zen-site-data-header-screenshot =
    .tooltiptext = Take a Screenshot
zen-site-data-header-bookmark =
    .tooltiptext = Bookmark This Page

zen-panel-ui-search-open-tabs =
    .label = Search Open Tabs

zen-read-aloud-use-listen = Use Listen in the Reader toolbar to hear this page.
zen-read-aloud-unavailable = Read Aloud is not available for this page or platform.

zen-urlbar-copy-url-button =
  .tooltiptext = Copy URL

zen-site-data-setting-site-protection = Tracking Protection
zen-smart-site-data-title = SMART Guard
zen-smart-status-safe = Safe
zen-smart-status-low = Monitor
zen-smart-status-medium = Warning
zen-smart-status-high = Risk
zen-smart-open-details =
    .label = SMART Guard Details
zen-smart-download-warning = SMART Guard: Suspicious download signal detected.
zen-smart-screen-warning = SMART Guard: Screen sharing risk signal detected.
zen-smart-clipboard-warning = SMART Guard: Sensitive clipboard signal detected.
zen-smart-suspend-complete = Smart Suspend unloaded { $count } background tab(s).
zen-crash-recovery-title = Crash Recovery
zen-crash-recovery-description = Astra detected an unexpected shutdown. Choose what to recover first.
zen-crash-recovery-restore-session =
    .label = Restore Session
zen-crash-recovery-restore-workspace =
    .label = Restore Current Workspace
zen-crash-recovery-session-restore-started = Session restore started.
zen-crash-recovery-workspace-restore-started = Workspace recovery started in synced window.
zen-folder-quick-add-started = Creating folder from current tab...
zen-folder-quick-add-unavailable = Quick Add is not available in this window.
zen-workspace-undo-move-success = Moved tab back to the previous space.
zen-workspace-undo-move-none = No recent tab move to undo.

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

astra-theme-options-title = Astra Options
astra-theme-transparent-mode-label = Transparent Mode
astra-theme-transparent-mode-description =
    Frosted glass on browser chrome. Websites stay opaque. Does not change Windows system settings.
astra-theme-transparent-mode-checkbox =
    .label = Enable Transparent Mode
astra-theme-transparent-on =
    .label = ON
astra-theme-transparent-off =
    .label = Off
# Status labels — native is requested/best-effort only (not pixel-confirmed).
astra-theme-transparent-acrylic-requested =
    .label = Acrylic requested
astra-theme-transparent-mica-requested =
    .label = Mica requested
astra-theme-transparent-mica-alt-requested =
    .label = Mica Alt requested
astra-theme-transparent-astra-glass =
    .label = Astra Glass

zen-window-sync-migration-dialog-title = Keep Your Windows in Sync
zen-window-sync-migration-dialog-message = Zen now syncs windows on the same device, so changes in one window are reflected across the others instantly.
zen-window-sync-migration-dialog-learn-more = Learn More
zen-window-sync-migration-dialog-accept = Got It

zen-appmenu-new-blank-window =
    .label = New blank window

astra-energy-saver-enabled = Energy Saver on — low battery
astra-energy-saver-enabled-manual = Energy Saver on
astra-energy-saver-disabled = Energy Saver off — charging or battery recovered
astra-energy-saver-disabled-manual = Energy Saver off

zen-ramsaver-high-memory-heading = Astra is using more memory than usual
zen-ramsaver-restart-action-label = Restart to free up memory

