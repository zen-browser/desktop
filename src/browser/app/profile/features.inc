// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#ifdef MOZILLA_OFFICIAL
pref('zen.welcome-screen.seen', false, sticky);
#else
pref('zen.welcome-screen.seen', true, sticky);
#endif

pref('zen.tabs.vertical', true);
pref('zen.tabs.vertical.right-side', false);
pref('zen.tabs.rename-tabs', true);
pref('zen.tabs.show-newtab-vertical', true);

pref('zen.ctrlTab.show-pending-tabs', false);

pref('zen.mediacontrols.enabled', true);

pref('zen.haptic-feedback.enabled', true);

#include features/mods.inc
#include features/compact-mode.inc
#include features/urlbar.inc
#include features/glance.inc
#include features/view.inc
#include features/downloads.inc
#include features/workspaces.inc
#include features/split-view.inc
#include features/kbs.inc

// Section: Watermark
#ifdef MOZILLA_OFFICIAL
pref('zen.watermark.enabled', true, sticky);
#else
pref('zen.watermark.enabled', false, sticky);
#endif

// Startup flags
pref('zen.startup.smooth-scroll-in-tabs', true);
