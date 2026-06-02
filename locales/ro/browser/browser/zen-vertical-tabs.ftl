# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-toolbar-context-tabs-right = 
    .label = Tab-urile în dreapta
    .accesskey = R
zen-toolbar-context-compact-mode = 
    .label = Modul Compact
zen-toolbar-context-compact-mode-enable = 
    .label = Activează modul compact
    .accesskey = D
zen-toolbar-context-compact-mode-just-tabs = 
    .label = Ascunde bara laterală
zen-toolbar-context-compact-mode-just-toolbar = 
    .label = Ascunde bara de unelte
zen-toolbar-context-compact-mode-hide-both = 
    .label = Ascunde ambele
    .accesskey = H
zen-toolbar-context-move-to-folder = 
    .label = Mută în Folderul...
    .accesskey = M
zen-toolbar-context-new-folder = 
    .label = Folder Nou
    .accesskey = N
sidebar-zen-expand = 
    .label = Extinde bara laterală
sidebar-zen-create-new = 
    .label = Creează unul nou...
tabbrowser-unload-tab-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Închide şi treci la tab
           *[other] Închide { $tabCount } tab-uri şi treci la primul
        }
tabbrowser-reset-pin-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Resetează și Fixează tab-ul
           *[other] Resetează și Fixează { $tabCount } tab-uri
        }
zen-tab-sublabel =
    { $tabSubtitle ->
        [zen-default-pinned] Înapoi la url-ul fixat
        [zen-default-pinned-cmd] Separat de tab-urile fixate
       *[other] { $tabSubtitle }
    }
