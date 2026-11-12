# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-library-button =
    .label = Library
    .tooltiptext = Library

library-footer-close-button =
    .tooltiptext = Close library
library-footer-donate-button =
    .tooltiptext = Donate to Zen
library-footer-customize-button =
    .tooltiptext = Choose tabs
library-tab-remove-button =
    .title = Take this tab out
library-tab-restore-button =
    .title = Put this tab back

library-history-section-title = History
library-downloads-section-title = Downloads
library-boosts-section-title = Boosts
library-media-section-title = Media
library-spaces-section-title = Spaces

library-filter-button = Filter
library-open-legacy =
    .label = Open the old library window
library-history-clear =
    .label = Clear history
library-history-clear-last-hour =
    .label = Last hour
library-history-clear-last-12-hours =
    .label = Last 12 hours
library-history-clear-today =
    .label = Today
library-history-clear-last-week =
    .label = Last week
library-history-clear-last-month =
    .label = Last month
library-history-clear-all =
    .label = Everything
library-history-clear-prompt-title = Clear history?
library-history-clear-prompt-message = The pages you visited in this time frame will be forgotten. This cannot be undone.
library-history-clear-prompt-accept = Clear history
library-filter-done = Done

library-history-filter-title = Filter History…
library-history-filter-when = When was it visited?
library-history-filter-source = What to look through
library-history-source-history = History
library-history-source-closed = Closed tabs
library-filter-today = Today
library-filter-week = This Week
library-filter-month = This Month
library-history-filter-sort = Sort by
library-history-sort-date = By Date
library-history-sort-site = By Site
library-history-sort-most-visited = By Most Visited
library-history-sort-last-visited = By Last Visited
library-history-site-other = Other
library-history-search-placeholder =
    .placeholder = Search History…
library-history-empty = No history found
library-history-closed-empty = No closed tabs
library-archive-section-title = Archive
library-media-empty = No media found
library-media-turn-off =
    .label = Turn off Media
library-media-search-placeholder =
    .placeholder = Search Media…
library-media-loading = Looking for media…
library-media-opt-in-title = Your Media in the Library
library-media-opt-in-body = Quickly grab screenshots, images and videos from your computer by showing them in the Zen Library.
library-media-opt-in-button = Show Media
library-media-opt-in-note = Media never leaves your computer and is not viewable by anyone but you.
library-media-filter-title = Filter Media…
library-media-filter-folders = Where to look
library-media-open-in = Open in { $app }
library-media-close =
    .title = Close
library-media-previous =
    .title = Previous
library-media-next =
    .title = Next
library-media-more =
    .title = More options
library-media-menu-open =
    .label = Open
library-media-menu-copy =
    .label = Copy
library-history-opened-in-background = Opened tab in a new tab
library-history-forget-button =
    .title = Remove from history
library-history-reopen-button =
    .title = Reopen page
library-history-menu-open =
    .label = Reopen Page
library-history-menu-forget =
    .label = Forget This Page

-library-cancel-download = Cancel download
-library-show-in-folder = { PLATFORM() ->
    [macos] Show in Finder
    [windows] Show in File Explorer
   *[other] Show in folder
}

library-space-routing-section-title = Routing
library-space-routing-search-placeholder =
    .placeholder = Search routes
library-space-routing-new-button = New
library-space-routing-new-title = New route
library-space-routing-edit-title = Edit route
library-space-routing-when-the-link = When the link
library-space-routing-contains = Contains
library-space-routing-equal-to = Is Exactly
library-space-routing-regex = RegEx
library-space-routing-open-it-in = Open it in
# Shown as text in a route's row and as the label of an item in the menu
# that picks where a route lands, which XUL draws from an attribute.
-library-space-routing-most-recent = Most recent space
library-space-routing-most-recent-space = { -library-space-routing-most-recent }
    .label = { -library-space-routing-most-recent }
library-space-routing-cancel = Cancel
library-space-routing-add-route = Add route
library-space-routing-save-route = Save route
library-space-routing-remove-button =
    .title = Remove route
library-space-routing-external-links = Default route for external links
library-space-routing-empty = Routes send links to the space you keep them in. Add one for a site you always open in the same place.
library-space-routing-no-results = No routes found

library-downloads-empty = No downloads found
library-downloads-clear-all =
    .label = Clear all downloads
library-downloads-more-button =
    .title = More options
library-downloads-menu-open =
    .label = Open { $name }
library-downloads-menu-copy =
    .label = Copy { $name }
library-downloads-menu-hide =
    .label = Hide from Zen
library-downloads-menu-delete =
    .label = Delete File
library-downloads-menu-clear-preview =
    .label = Clear Download Preview
library-downloads-menu-retry =
    .label = Retry Download
library-downloads-open-when-done = Opens when finished
# Variables:
#   $rate (string) - How much comes in per second, like 3.2
#   $unit (string) - The unit of $rate, like MB
library-downloads-speed = { $rate } { $unit }/s
library-downloads-cancel-button =
    .title = { -library-cancel-download }
library-downloads-cancel-tooltip =
    .tooltiptext = { -library-cancel-download }
library-downloads-show-button =
    .title = { -library-show-in-folder }
library-downloads-show-tooltip =
    .tooltiptext = { -library-show-in-folder }
library-downloads-filter-title = Filter Downloads…
library-downloads-filter-type = File type
library-downloads-filter-when = When was it downloaded?
library-downloads-type-images = Images
library-downloads-type-video = Video
library-downloads-type-audio = Audio
library-downloads-type-documents = Documents
library-downloads-type-archives = Archives
library-downloads-type-apps = Apps
library-downloads-retry-button =
    .title = Retry download

library-spaces-theme-button =
    .title = Change theme
library-spaces-move-button =
    .title = Drag to reorder
library-spaces-actions-button =
    .tooltiptext = More options
library-spaces-icon-button =
    .title = Change icon
library-spaces-name-button =
    .title = Rename space

library-boosts-search-placeholder =
    .placeholder = Search Boosts…
library-boosts-empty = No boosts yet
library-boosts-toggle =
    .aria-label = Enable boost
library-boosts-delete-button =
    .title = Delete boost
library-boosts-menu-edit =
    .label = Edit Boost

library-mods-section-title = Mods
library-mods-search-placeholder =
    .placeholder = Search mods…
library-mods-filter-title = Filter mods
library-mods-filter-state = Show
library-mods-filter-enabled = Turned on
library-mods-filter-disabled = Turned off
library-mods-filter-error = With problems
library-mods-empty = No mods yet
library-mods-browse-store-button = Browse mods
library-mods-no-results = No mods found
library-mods-all-disabled = All mods are turned off
library-mods-enable-all-button = Turn on
# Variables:
#   $author (String) - Who published the mod
#   $version (String) - The installed version of the mod
library-mods-byline = { $author } · { $version }
library-mods-error-missing-files = Files missing, reinstall it
library-mods-error-update-failed = Last update failed
library-mods-error-script-failed = A script failed
library-mods-toggle =
    .aria-label = Turn on mod
library-mods-configure-button =
    .title = Mod preferences
library-mods-menu-configure =
    .label = Preferences
library-mods-menu-homepage =
    .label = Open mod page
library-mods-menu-reinstall =
    .label = Reinstall
library-mods-menu-remove =
    .label = Remove
library-mods-menu-approve-scripts =
    .label = Allow scripts…
library-mods-menu-reload =
    .label = Reload from folder
library-mods-menu-folder =
    .label = Show folder
library-mods-badge-local = Local
    .title = This mod lives in a folder of yours
library-mods-scripts-running = JS
    .title = This mod runs scripts
library-mods-scripts-off = JS
    .title = Scripts are off. Turn on zen.mods.scripts.enabled in about:config to run them.
library-mods-scripts-needs-approval = JS
    .title = Its scripts need your permission. Allow them from the mod’s menu.
library-mods-scripts-needs-restart = Restart
    .title = Restart { -brand-short-name } to finish turning its scripts off
library-mods-preference-none = None
library-mods-preference-none-item =
    .label = None

library-mods-remove-prompt-title = Remove this mod?
# Variables:
#   $name (String) - The name of the mod
library-mods-remove-prompt-message = “{ $name }” and its preferences will be removed.
library-mods-remove-prompt-accept = Remove
# Variables:
#   $name (String) - The name of the mod
library-mods-remove-local-prompt-message = “{ $name }” will be removed from { -brand-short-name }. Its folder stays where it is.

library-mods-scripts-prompt-title = Allow this mod to run scripts?
# Variables:
#   $name (String) - The name of the mod
#   $state (String) - "on" when scripts are allowed in about:config, "off" otherwise
library-mods-scripts-prompt-message =
    “{ $name }” comes with scripts. Scripts can do anything { -brand-short-name } can, like reading the pages you visit, so only allow scripts you trust.
    { $state ->
        [on] { "" }
       *[off] They stay off until zen.mods.scripts.enabled is turned on in about:config.
    }
library-mods-scripts-prompt-accept = Allow scripts

library-mods-install-folder-title = Choose the mod’s folder
library-mods-install-folder-invalid = That folder isn’t a mod
library-mods-install-folder-invalid-description = It needs a theme.json with a name and a version, and a chrome.css or scripts.
# Variables:
#   $name (String) - The name of the mod
library-mods-installed = Added { $name }
# Variables:
#   $name (String) - The name of the mod
library-mods-reloaded = Reloaded { $name }
# Variables:
#   $name (String) - The name of the mod
library-mods-reload-failed = Couldn’t reload { $name }

library-mods-import-title = Import mods
library-mods-export-title = Export mods
library-mods-import-prompt-title = Import these mods?
# Variables:
#   $count (Number) - How many mods will be installed
#   $names (String) - The names of the first mods, one per line
#   $more (Number) - How many mods are not in $names
library-mods-import-prompt-message =
    { $count ->
        [one] This mod will be installed from the store:
       *[other] These { $count } mods will be installed from the store:
    }
    { $names }
    { $more ->
        [0] { "" }
       *[other] and { $more } more
    }
library-mods-import-prompt-accept = Install

# Variables:
#   $count (Number) - How many mods were installed
library-mods-imported =
    { $count ->
        [one] Imported one mod
       *[other] Imported { $count } mods
    }
library-mods-import-nothing = That file has no new mods from the store
library-mods-import-invalid = That file isn’t a mods export
# Variables:
#   $count (Number) - How many mods were saved to the file
library-mods-exported =
    { $count ->
        [one] Exported one mod
       *[other] Exported { $count } mods
    }
# Variables:
#   $count (Number) - How many mods were updated
library-mods-updates-installed =
    { $count ->
        [one] Updated one mod
       *[other] Updated { $count } mods
    }
library-mods-updates-none = Your mods are up to date
library-mods-updates-failed = Couldn’t reach the mods store
# Variables:
#   $name (String) - The name of the mod
library-mods-reinstalled = Reinstalled { $name }
# Variables:
#   $name (String) - The name of the mod
library-mods-reinstall-failed = Couldn’t reinstall { $name }

library-mods-check-for-updates =
    .label = Check for updates
library-mods-disable-all =
    .label = Turn off all mods
library-mods-enable-all =
    .label = Turn on mods
library-mods-install-folder =
    .label = Add mod from folder…
library-mods-import =
    .label = Import…
library-mods-export =
    .label = Export…
library-mods-browse-store =
    .label = Browse mods
