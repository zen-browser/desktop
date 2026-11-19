# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

tab-zen-split-tabs =
    .label =
        { $tabCount ->
            [-1] Split Out Tab
            [1] Add Split View...
           *[other] Join { $tabCount } Tabs
        }
    .accesskey = S

zen-split-link =
    .label = Split Link to New Tab
    .accesskey = S

zen-split-view-modifier-header = Split View
zen-split-view-modifier-activate-reallocation =
    .label = Activate reallocation