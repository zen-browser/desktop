# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Mica
pref("widget.windows.mica", true);
pref("widget.windows.mica.popups", true);

# 1. DWMSBT_MAINWINDOW
# 2. DWMSBT_TRANSIENTWINDOW (default, also used for popups)
# 3(default). DWMSBT_TABBEDWINDOW
pref("widget.windows.mica.toplevel-backdrop", 2);
