# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-settings-window-title =
    .title = Settings

zen-settings-window-restart-note = Takes effect after restarting { -brand-short-name }

## Sidebar

zen-settings-window-pane-general = General
zen-settings-window-pane-appearance = Appearance
zen-settings-window-pane-tabs = Tabs
zen-settings-window-pane-containers = Containers
zen-settings-window-pane-links = Links
zen-settings-window-pane-search = Search
zen-settings-window-pane-language = Language
zen-settings-window-pane-shortcuts = Shortcuts
zen-settings-window-pane-privacy = Privacy
zen-settings-window-pane-advanced = Advanced
zen-settings-window-link-mods = Mods
zen-settings-window-link-more = More Settings
zen-settings-window-link-about = About { -brand-short-name }

## General

zen-settings-window-default-browser = { -brand-short-name } works best as your default browser
zen-settings-window-default-browser-button = Set { -brand-short-name } as Default
zen-settings-window-startup-header = Startup
zen-settings-window-launch-on-login = Open { -brand-short-name } automatically when your computer starts up
zen-settings-window-restore-session = Open previous windows and tabs
zen-settings-window-continue-where-left-off = Continue where you left off
zen-settings-window-check-default-browser = Always check if { -brand-short-name } is your default browser
zen-settings-window-downloads-header = Downloads
zen-settings-window-download-location = Download location
zen-settings-window-download-location-other =
    .label = Other…
zen-settings-window-download-location-ask =
    .label = Ask every time
zen-settings-window-download-location-picker = Choose Download Folder

## Appearance

zen-settings-window-layout-header = Layout
zen-settings-window-layout = Toolbar layout
zen-settings-window-layout-single = Single toolbar
zen-settings-window-layout-multiple = Multiple toolbars
zen-settings-window-layout-collapsed = Collapsed sidebar
zen-settings-window-tabs-right = Show tabs on the right
zen-settings-window-newtab-button = Show the new tab button in the tab list
zen-settings-window-newtab-button-top = Keep the new tab button above the tabs

## Tabs

zen-settings-window-tabs-header = Behavior
zen-settings-window-tabs-recently-used-on-close = Go to the most recently used tab when closing a tab
zen-settings-window-tabs-close-on-back = Close a tab when going back with no history
zen-settings-window-tabs-warn-on-quit =
    { PLATFORM() ->
        [macos] Warn before quitting with ⌘Q
        [windows] Warn before quitting with Ctrl+Shift+Q
       *[other] Warn before quitting with Ctrl+Q
    }
zen-settings-window-ctrl-tab-header = Ctrl+Tab
zen-settings-window-tabs-ctrl-tab-recent = Cycle through tabs in recently used order
zen-settings-window-tabs-ctrl-tab-ignore-pending = Skip tabs that aren’t loaded
zen-settings-window-tabs-ctrl-tab-ignore-essentials = Skip Essentials
zen-settings-window-pinned-header = Pinned Tabs
zen-settings-window-pinned-restore = Restore pinned tabs to their pinned page on startup
zen-settings-window-pinned-separate-essentials = Keep separate Essentials for each container
zen-settings-window-spaces-header = Spaces
zen-settings-window-spaces-sync-pinned-only = Only sync pinned tabs between windows
zen-settings-window-spaces-force-container = Switch to the space where a container is set as default when opening container tabs
zen-settings-window-spaces-hide-default-container = Hide the container indicator for a space’s default container

## Containers

zen-settings-window-containers-description = Containers keep cookies and logins separate. Drag to reorder them.
zen-settings-window-containers-add = Add Container…
zen-settings-window-containers-edit =
    .title = Edit
zen-settings-window-containers-remove =
    .title = Remove
zen-settings-window-containers-remove-title = Remove this container?
# Variables:
#   $count (Number): number of tabs that will be closed
zen-settings-window-containers-remove-body =
    { $count ->
        [one] Removing this container closes { $count } container tab.
       *[other] Removing this container closes { $count } container tabs.
    }
zen-settings-window-containers-remove-confirm = Remove
zen-settings-window-containers-remove-cancel = Cancel

## Links

zen-settings-window-little-header = Little { -brand-short-name }
zen-settings-window-little-description = Little { -brand-short-name } is a smaller, simpler { -brand-short-name } window. It’s perfect for quick lookups and for links you only need for a moment.
zen-settings-window-little-enabled = Enable Little { -brand-short-name }
zen-settings-window-little-global-shortcut = Open Little { -brand-short-name } with its shortcut from any app
# Variables:
#   $shortcut (String): the keyboard shortcut, e.g. ⌥⌘N
zen-settings-window-little-global-shortcut-key = Open Little { -brand-short-name } when I press { $shortcut } in any app
zen-settings-window-little-external-links = Links from other apps open in Little { -brand-short-name }
zen-settings-window-glance-header = Glance
zen-settings-window-glance-trigger = Open Glance when clicking on links with
zen-settings-window-glance-trigger-ctrl =
    .label = { PLATFORM() ->
        [macos] ⌃ held
       *[other] Ctrl held
    }
    .aria-label = { PLATFORM() ->
        [macos] Control held
       *[other] Ctrl held
    }
zen-settings-window-glance-trigger-alt =
    .label = { PLATFORM() ->
        [macos] ⌥ held
       *[other] Alt held
    }
    .aria-label = { PLATFORM() ->
        [macos] Option held
       *[other] Alt held
    }
zen-settings-window-glance-trigger-shift =
    .label = { PLATFORM() ->
        [macos] ⇧ held
       *[other] Shift held
    }
    .aria-label = Shift held
zen-settings-window-glance-trigger-meta =
    .label = ⌘ held
    .aria-label = Command held
zen-settings-window-glance-external-links = Open Glance when clicking on links to other sites
zen-settings-window-glance-external-links-note = This only affects Essentials and pinned tabs
zen-settings-window-space-routing = Choose where links open inside { -brand-short-name }.
zen-settings-window-space-routing-button = Space Routing…

## Search

zen-settings-window-search-engine = Default search engine
zen-settings-window-search-suggestions = Show search suggestions
zen-settings-window-search-suggestions-private = Show search suggestions in private windows
zen-settings-window-search-engines-header = Search Engines
zen-settings-window-search-engines-description = Type an engine’s keyword in the address bar to search with it. Turn an engine off to hide it from search.
zen-settings-window-search-keyword =
    .placeholder = Keyword
    .aria-label = Keyword
zen-settings-window-search-engine-remove =
    .title = Remove
zen-settings-window-search-add = Add Search Engine…
zen-settings-window-search-restore = Restore Defaults

## Language

zen-settings-window-language = { -brand-short-name } language
zen-settings-window-language-note = Changing it could make it easier for websites to track you.
zen-settings-window-language-more =
    .label = More Languages…
zen-settings-window-website-languages = Preferred languages for websites
zen-settings-window-website-languages-button = Choose…
zen-settings-window-translations-header = Translations
zen-settings-window-translations-enabled = Translate web pages
zen-settings-window-translations-offer = Offer to translate pages in other languages
zen-settings-window-translations-languages = Languages to always or never translate
zen-settings-window-translations-button = Translation Settings…

## Shortcuts

zen-settings-window-shortcuts-search =
    .placeholder = Type a feature name or shortcut
zen-settings-window-shortcuts-header = Custom Shortcuts
zen-settings-window-shortcuts-description = Select a shortcut, then click its keys to record new ones. Press Delete to remove it or Escape to cancel.
zen-settings-window-shortcuts-customized = Custom Shortcuts
zen-settings-window-shortcuts-reset-one = Reset Shortcut to Default
zen-settings-window-shortcuts-more = •••
    .title = More
zen-settings-window-shortcuts-menu-remove =
    .label = Remove Shortcut
zen-settings-window-shortcuts-menu-reset-all =
    .label = Reset All Shortcuts
zen-settings-window-shortcuts-menu-extensions =
    .label = Extension Shortcuts…
zen-settings-window-shortcuts-unassigned = ---
zen-settings-window-shortcuts-recording = Press keys…
zen-settings-window-shortcuts-no-window = Open a { -brand-short-name } window to see and change its shortcuts.
zen-settings-window-shortcuts-no-results = No shortcuts match your search.

## Privacy

zen-settings-window-protection-header = Protection
zen-settings-window-tracking-protection = Tracking protection
zen-settings-window-tracking-protection-standard =
    .label = Standard
zen-settings-window-tracking-protection-strict =
    .label = Strict
zen-settings-window-tracking-protection-custom =
    .label = Custom
zen-settings-window-global-privacy-control = Tell websites not to sell or share my data
zen-settings-window-https-only = Only connect to websites over HTTPS
zen-settings-window-data-header = Browsing Data
zen-settings-window-save-passwords = Ask to save passwords
zen-settings-window-clear-data = Cookies, history and site data
zen-settings-window-clear-data-button = Clear Data…
zen-settings-window-more-privacy = More Privacy Settings…

## Sync

zen-settings-window-sync-signed-out = Take { -brand-short-name } with you
zen-settings-window-sync-signed-out-description = Sign in to sync your spaces, bookmarks, passwords and more across devices.
zen-settings-window-sync-sign-in = Sign In…
zen-settings-window-sync-account-header = Account
zen-settings-window-sync-manage-account = Manage Account
zen-settings-window-sync-not-verified = This account needs to be verified
zen-settings-window-sync-login-failed = Sign in again to keep syncing
zen-settings-window-sync-sign-in-again = Sign In Again…
zen-settings-window-sync-header = Sync
zen-settings-window-sync-settings = Sync Settings…
zen-settings-window-dialog-done = Done
zen-settings-window-dialog-close =
    .title = Close
    .aria-label = Close
zen-settings-window-sync-off = Sync is turned off
zen-settings-window-sync-turn-on = Turn On Sync…
zen-settings-window-sync-status = Status
zen-settings-window-sync-status-syncing = Syncing…
zen-settings-window-sync-status-never = Not synced yet
zen-settings-window-sync-status-just-now = Updated just now
# Variables:
#   $date (Date): when the last sync finished
zen-settings-window-sync-status-date = Updated { DATETIME($date, dateStyle: "medium", timeStyle: "short") }
zen-settings-window-sync-now = Sync Now
zen-settings-window-sync-engine-spaces = Spaces
zen-settings-window-sync-spaces-unpinned = Include unpinned tabs
zen-settings-window-sync-spaces-unpinned-description = Also sync the regular tabs of each space, not just your pinned tabs and folders.
zen-settings-window-sync-engine-bookmarks = Bookmarks
zen-settings-window-sync-engine-history = History
zen-settings-window-sync-engine-tabs = Open tabs
zen-settings-window-sync-engine-passwords = Passwords
zen-settings-window-sync-engine-addons = Add-ons
zen-settings-window-sync-engine-prefs = Settings
zen-settings-window-sync-note = Synced data is end-to-end encrypted.
zen-settings-window-sync-connect-device = Connect Another Device…
zen-settings-window-sync-sign-out = Sign Out…
zen-settings-window-sync-more = More Sync Settings…

## Advanced

zen-settings-window-browsing-header = Browsing
zen-settings-window-smooth-scroll = Use smooth scrolling
zen-settings-window-autoscroll = Use autoscrolling
zen-settings-window-spellcheck = Check spelling as you type
zen-settings-window-media-header = Media
zen-settings-window-drm = Play DRM-controlled content
zen-settings-window-pip-toggle = Show picture-in-picture video controls
zen-settings-window-pip-auto = Enable picture-in-picture when you leave a video tab
zen-settings-window-window-header = Window
zen-settings-window-haptic-feedback = Haptic feedback when reordering tabs
zen-settings-window-drag-from-content = Drag the window from the top of the page
zen-settings-window-compact-flash-popup = Briefly show the toolbar when switching tabs in compact mode
zen-settings-window-more-settings = More Settings…
