
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Restore session on startup
pref("browser.startup.page", 3);
pref("browser.sessionstore.restore_pinned_tabs_on_demand", true);

// Toolbars
pref("browser.tabs.closeWindowWithLastTab", false);
pref("browser.tabs.loadBookmarksInTabs", false);
pref("browser.tabs.hoverPreview.enabled", false);
pref("browser.tabs.dragdrop.moveOverThresholdPercent", 50);
pref("browser.tabs.unloadTabInContextMenu", true);
pref("browser.tabs.fadeOutExplicitlyUnloadedTabs", true);

pref('browser.toolbars.bookmarks.visibility', 'never');
pref("browser.bookmarks.openInTabClosesMenu", false);
pref("browser.menu.showViewImageInfo", true);
pref("findbar.highlightAll", true);

pref("layout.word_select.eat_space_to_next_word", false);

// Better Windows theming
pref("widget.non-native-theme.scrollbar.style", 2);
pref("widget.non-native-theme.use-theme-accent", true);

// for the new layout:
pref('browser.download.autohideButton', false);

// Disable Firefox's revamp
pref("sidebar.revamp", false, locked);
pref("sidebar.verticalTabs", false, locked);

// Enable experimental settings page (Used for Zen Labs)
pref('browser.preferences.experimental', true);

// Downloads
pref("browser.download.manager.addToRecentDocs", false);
pref('browser.download.open_pdf_attachments_inline', true);
pref('browser.download.alwaysOpenPanel', false);

// Updates
#ifdef MOZILLA_OFFICIAL
pref("app.update.checkInstallTime.days", 6);
#endif

#include fullscreen.inc
#include ai.inc
#include disablemozilla.inc

// TODO: Check this out!
pref("browser.profiles.enabled", false);
pref("browser.tabs.groups.enabled", false);
