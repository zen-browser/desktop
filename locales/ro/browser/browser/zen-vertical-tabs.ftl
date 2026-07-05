# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-toolbar-context-tabs-right = 
    .label = File în dreapta
    .accesskey = R
zen-toolbar-context-compact-mode = 
    .label = Mod compact
zen-toolbar-context-compact-mode-enable = 
    .label = Activează modul compact
    .accesskey = D
zen-toolbar-context-compact-mode-just-tabs = 
    .label = Hide sidebar
zen-toolbar-context-compact-mode-just-toolbar = 
    .label = Ascunde bara de instrumente
zen-toolbar-context-compact-mode-hide-both = 
    .label = Ascunde ambele
    .accesskey = P
zen-toolbar-context-move-to-folder = 
    .label = Move to Folder...
    .accesskey = M
zen-toolbar-context-new-folder = 
    .label = Dosar nou
    .accesskey = N
sidebar-zen-expand = 
    .label = Expand Sidebar
sidebar-zen-create-new = 
    .label = Create New...
tabbrowser-unload-tab-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Descarca şi comută la tab-ul
           *[other] Descarca filele { $tabCount } şi trece la primul
        }
tabbrowser-reset-pin-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Resetați și fixați fila
           *[other] Resetați și pin { $tabCount } tab-urile
        }
zen-tab-sublabel =
    { $tabSubtitle ->
        [zen-default-pinned] Înapoi la url fixat
        [zen-default-pinned-cmd] Separat din fila fixată
       *[other] { $tabSubtitle }
    }
