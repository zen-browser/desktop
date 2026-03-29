# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

tab-zen-split-tabs = 
    .label =
        { $tabCount ->
            [-1] Rozdziel karty
            [1] Podziel kartę (potrzeba wielu zaznaczonych kart)
            [few] Podziel { $tabCount } karty
           *[other] Podziel { $tabCount } kart
        }
    .accesskey = S
zen-split-link = 
    .label = Podziel link na nową kartę
    .accesskey = S
zen-split-view-modifier-header = Podziel widok
zen-split-view-modifier-activate-reallocation = 
    .label = Aktywuj realokację
