# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = current profile

urlbar-search-mode-snippets = Snippets

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
tab-context-zen-edit-pinned-page =
    .label =
        { $isEssential ->
            [true] Edit Essential URL
           *[false] Edit Pinned URL
        }
    .accesskey = P
tab-context-zen-replace-pinned-url-with-current =
    .label = Replace with Current URL
    .accesskey = C
tab-context-zen-edit-pinned-url =
    .label = Edit…
    .accesskey = E
tab-context-zen-edit-title =
    .label = Change Label…
tab-context-zen-edit-icon =
    .label = Change Icon…

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
zen-pinned-tab-url-edited = Pinned tab URL has been updated!
zen-pinned-tab-url-invalid = That doesn't look like a valid URL.
zen-pinned-tab-edit-url-title = Edit Pinned URL
zen-pinned-tab-edit-url-label = Enter the URL this pinned tab should point to:
zen-tabs-renamed = Tab has been successfully renamed!
zen-background-tab-opened-toast = New background tab opened!
zen-workspace-renamed-toast = Workspace has been successfully renamed!
zen-split-view-limit-toast = Can't add more panels to the split view!
zen-sidebar-drag-collapsed-toast = Sidebar hidden! Use <span>{ $shortcut }</span> to bring the sidebar back.

zen-ghost-mode-button =
    .label = Ghost Mode
    .tooltiptext = Open a new Ghost Window

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
zen-emojis-picker-search =
  .placeholder = Search emojis

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
# $minutes (Number) - whole minutes remaining on a temporary grant.
zen-site-data-setting-allow-timed = Allowed for { $minutes } min
zen-site-data-setting-allow-brief = Allowed for less than a minute
zen-site-data-setting-allow-tab = Until this tab closes

zen-permission-duration-label = Allow for
zen-permission-duration-once =
    .label = This time
zen-permission-duration-timed =
    .label = For 10 minutes
zen-permission-duration-tab =
    .label = Until this tab closes
zen-permission-duration-always =
    .label = Always
zen-site-data-protections-enabled = Enabled
zen-site-data-protections-disabled = Disabled
zen-site-data-adblock = Ad blocking
zen-site-data-adblock-light =
    .label = Light
zen-site-data-adblock-medium =
    .label = Medium
zen-site-data-adblock-heavy =
    .label = Heavy
zen-site-data-adblock-pause = This site
zen-site-data-adblock-on = On
zen-site-data-adblock-paused = Paused
zen-site-data-adblock-reset = Reset
zen-site-data-adblock-count = { $count } blocked
zen-site-data-adblock-ubo = uBlock Origin is active
zen-site-data-cookie-consent = Cookie popups
zen-site-data-cookie-consent-pause = This site
zen-site-data-cookie-consent-on = Refusing
zen-site-data-cookie-consent-paused = Paused
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

# See PeppermintSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = What's new in { -brand-short-name }
zen-sidebar-notification-updated-tooltip =
    .title = View Release Notes
zen-sidebar-notification-donate-label = Support { -brand-short-name }
zen-sidebar-notification-donate-tooltip =
    .title = Donate to the project
zen-sidebar-notification-restart-safe-mode-label = Something broke?
zen-sidebar-notification-restart-safe-mode-tooltip =
    .title = Restart in Safe Mode

zen-window-sync-migration-dialog-title = Keep Your Windows in Sync
zen-window-sync-migration-dialog-message = Peppermint now syncs windows on the same device, so changes in one window are reflected across the others instantly.
zen-window-sync-migration-dialog-learn-more = Learn More
zen-window-sync-migration-dialog-accept = Got It

zen-appmenu-new-blank-window =
    .label = New Blank Window

zen-homepage-welcome = Welcome back, { $name }.
zen-homepage-today = Today is { $date }.
zen-homepage-tagline = Have a <span data-l10n-name="fresh">fresh</span> browsing experience!
zen-homepage-card-time-spent = Time spent browsing
zen-homepage-card-top-site = Most used website
zen-homepage-card-network-speed = Avg. Network Speed
zen-homepage-card-downloads = Nº Downloads
zen-homepage-card-visited-sites = Nº Visited websites
zen-homepage-card-version = Current Version

