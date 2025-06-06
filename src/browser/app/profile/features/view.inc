// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref('zen.view.sidebar-height-throttle', 200); // in ms
pref('zen.view.sidebar-expanded.max-width', 500);

#ifdef XP_MACOSX
pref('zen.view.mac.show-three-dot-menu', false);
pref('zen.widget.mac.mono-window-controls', true);
#endif
pref('zen.view.use-single-toolbar', true);
pref('zen.view.sidebar-expanded', true);
pref('zen.view.sidebar-collapsed.hide-mute-button', true);
pref('zen.view.experimental-force-window-controls-left', false);

#ifdef XP_MACOSX
pref('zen.view.grey-out-inactive-windows', false);
#else
pref('zen.view.grey-out-inactive-windows', true);
#endif

pref('zen.view.hide-window-controls', true);
pref('zen.view.experimental-no-window-controls', false);

pref('zen.view.show-newtab-button-border-top', false);
pref('zen.view.show-newtab-button-top', true);
