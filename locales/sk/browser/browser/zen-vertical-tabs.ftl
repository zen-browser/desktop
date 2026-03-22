# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-toolbar-context-tabs-right = 
    .label = Karty vpravo
    .accesskey = R
zen-toolbar-context-compact-mode = 
    .label = Kompaktný Režim
zen-toolbar-context-compact-mode-enable = 
    .label = Povoliť kompaktný režim
    .accesskey = D
zen-toolbar-context-compact-mode-just-tabs = 
    .label = Skryť bočný panel
zen-toolbar-context-compact-mode-just-toolbar = 
    .label = Skryť panel nástrojov
zen-toolbar-context-compact-mode-hide-both = 
    .label = Skryť oboje
    .accesskey = H
zen-toolbar-context-new-folder = 
    .label = Nový Priečinok
    .accesskey = N
sidebar-zen-expand = 
    .label = Rozšíriť Bočný Panel
sidebar-zen-create-new = 
    .label = Vytvoriť nové...
tabbrowser-unload-tab-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Uvoľniť z pamäte a prepnúť na kartu
            [few] Uvoľniť { $tabCount } karty z pamäte a prepnúť na prvú
           *[other] Uvoľniť { $tabCount } kariet z pamäte a prepnúť na prvú
        }
tabbrowser-reset-pin-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Resetovať a pripnúť kartu
            [few] Resetovať a pripnúť { $tabCount } karty
           *[other] Resetovať a pripnúť { $tabCount } kariet
        }
zen-tab-sublabel =
    { $tabSubtitle ->
        [zen-default-pinned] Back to pinned url
        [zen-default-pinned-cmd] Separate from pinned tab
       *[other] { $tabSubtitle }
    }
