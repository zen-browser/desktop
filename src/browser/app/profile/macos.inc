// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Enable transparent background for macos
pref('widget.macos.sidebar-blend-mode.behind-window', true);
// 1. hudWindow
// 2. fullScreenUI
// 3. popover
// 4. menu
// 5. toolTip
// 6. headerView
// 7. underlay
pref('zen.widget.macos.window-material', 1);
