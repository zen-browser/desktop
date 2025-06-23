// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref('zen.theme.accent-color', "#ffb787");
pref('zen.theme.content-element-separation', 8); // In pixels
pref('zen.theme.gradient', true);
pref('zen.theme.gradient.show-custom-colors', false);
pref('zen.theme.essentials-favicon-bg', true);
pref('zen.theme.window.scheme', 'auto'); // auto, light, dark

#ifdef XP_MACOSX
  pref('zen.theme.border-radius', 10); // In pixels
#else
  pref('zen.theme.border-radius', 8); // In pixels
#endif

#ifdef XP_MACOSX
  pref('zen.theme.acrylic-elements', false);
#else
  pref('zen.theme.acrylic-elements', false);
#endif

