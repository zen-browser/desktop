# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-toolbar-context-tabs-right = 
    .label = Karty po prawej
    .accesskey = R
zen-toolbar-context-compact-mode = 
    .label = Tryb kompaktowy
zen-toolbar-context-compact-mode-enable = 
    .label = Włącz tryb kompaktowy
    .accesskey = D
zen-toolbar-context-compact-mode-just-tabs = 
    .label = Ukryj panel boczny
zen-toolbar-context-compact-mode-just-toolbar = 
    .label = Ukryj pasek narzędzi
zen-toolbar-context-compact-mode-hide-both = 
    .label = Ukryj oba
    .accesskey = H
zen-toolbar-context-move-to-folder = 
    .label = Przenieś do folderu...
    .accesskey = M
zen-toolbar-context-new-folder = 
    .label = Nowy folder
    .accesskey = N
sidebar-zen-expand = 
    .label = Rozwiń panel boczny
sidebar-zen-create-new = 
    .label = Utwórz nową...
tabbrowser-unload-tab-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Wyładuj i przełącz na kartę
            [few] Wyładuj { $tabCount } karty i przełącz na pierwszą
           *[other] Wyładuj { $tabCount } kart i przełącz na pierwszą
        }
tabbrowser-reset-pin-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Zresetuj i przypnij kartę
            [few] Zresetuj i przypnij { $tabCount } karty
           *[other] Zresetuj i przypnij { $tabCount } kart
        }
zen-tab-sublabel =
    { $tabSubtitle ->
        [zen-default-pinned] Cofnij do przypiętego adresu URL
        [zen-default-pinned-cmd] Oddziel od przypiętej karty
       *[other] { $tabSubtitle }
    }
