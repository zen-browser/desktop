# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-toolbar-context-tabs-right = 
    .label = Faner til høyre
    .accesskey = L
zen-toolbar-context-compact-mode = 
    .label = Kompakt modus
zen-toolbar-context-compact-mode-enable = 
    .label = Aktiver kompaktmodus
    .accesskey = V
zen-toolbar-context-compact-mode-just-tabs = 
    .label = Hide sidebar
zen-toolbar-context-compact-mode-just-toolbar = 
    .label = Skjul verktøylinje
zen-toolbar-context-compact-mode-hide-both = 
    .label = Skjul begge
    .accesskey = t
zen-toolbar-context-move-to-folder = 
    .label = Flytt til mappe
    .accesskey = Ma
zen-toolbar-context-new-folder = 
    .label = Ny mappe
    .accesskey = n
sidebar-zen-expand = 
    .label = Expand Sidebar
sidebar-zen-create-new = 
    .label = Opprett ny
tabbrowser-unload-tab-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Unload and switch to tab
           *[other] Unload { $tabCount } tabs and switch to the first
        }
tabbrowser-reset-pin-button = 
    .tooltiptext =
        { $tabCount ->
            [one] Tilbakestill og pin fliken
           *[other] Tilbakestill og PIN { $tabCount } fanene
        }
zen-tab-sublabel =
    { $tabSubtitle ->
        [zen-default-pinned] tilbake til pinnet url
        [zen-default-pinned-cmd] Skill fra leddet fane
       *[other] { $tabSubtitle }
    }
