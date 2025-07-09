# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref('zen.view.sidebar-height-throttle', 0); // in ms
pref('zen.view.sidebar-expanded.max-width', 500);

#ifdef XP_MACOSX
  pref('zen.view.mac.show-three-dot-menu', false);
  pref('zen.widget.mac.mono-window-controls', true);
#endif

pref('zen.view.use-single-toolbar', true);
pref('zen.view.sidebar-expanded', true);
pref('zen.view.sidebar-collapsed.hide-mute-button', true);
pref('zen.view.experimental-force-window-controls-left', false);

pref('zen.view.hide-window-controls', true);
pref('zen.view.experimental-no-window-controls', false);

pref('zen.view.grey-out-inactive-windows', true);

pref('zen.view.show-newtab-button-border-top', false);
pref('zen.view.show-newtab-button-top', true);

# 0: Dark
# 1: Light
# 2: Auto (system color scheme unless overridden by browser theme)
pref('zen.view.window.scheme', 2); // auto, light, dark
