# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

tab-zen-split-tabs = 
    .label =
        { $tabCount ->
            [-1] Wydziel kartę
            [1] Dodaj widok podzielony...
            [few] Połącz { $tabCount } karty
           *[other] Połącz { $tabCount } kart
        }
    .accesskey = S
zen-split-link = 
    .label = Otwórz link w nowej podzielonej karcie
    .accesskey = S
zen-split-view-modifier-header = Widok podzielony
zen-split-view-modifier-activate-reallocation = 
    .label = Aktywuj realokację
