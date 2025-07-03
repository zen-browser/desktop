# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref('zen.workspaces.continue-where-left-off', false);
pref('zen.workspaces.hide-default-container-indicator', true);
pref('zen.workspaces.force-container-workspace', false);
pref('zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed', false);
pref('zen.workspaces.swipe-actions', true);
pref('zen.workspaces.wrap-around-navigation', true);
pref('zen.workspaces.natural-scroll', false);
pref('zen.workspaces.scroll-modifier-key','ctrl'); // can be ctrl, alt, shift, or a meta key
pref('services.sync.engine.workspaces', false);
pref('zen.workspaces.separate-essentials', true);

#ifdef MOZILLA_OFFICIAL
  pref('zen.workspaces.debug', false);
#else
  pref('zen.workspaces.debug', true);
#endif

# Section: Pinned tabs management
pref('zen.pinned-tab-manager.debug', false);
pref('zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url', false);
pref('zen.pinned-tab-manager.close-shortcut-behavior', 'reset-unload-switch');
