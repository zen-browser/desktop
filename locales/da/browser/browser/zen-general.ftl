# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = nuværende profil
unified-extensions-description = Udvidelser bruges til at bringe ekstra funktionalitet ind i { -brand-short-name }.
tab-context-zen-reset-pinned-tab = 
    .label =
        { $isEssential ->
            [true] Reset Essential Tab
           *[false] Reset Pinned Tab
        }
    .accesskey = R
tab-context-zen-add-essential = 
    .label = Add to Essentials
    .accesskey = E
tab-context-zen-add-essential-badge = { $num } / { $max } slots filled
tab-context-zen-remove-essential = 
    .label = Fjern fra Essentielle
    .accesskey = R
tab-context-zen-edit-pinned-page = 
    .label =
        { $isEssential ->
            [true] Edit Essential URL
           *[false] Edit Pinned URL
        }
    .accesskey = P
tab-context-zen-replace-pinned-url-with-current = 
    .label = Replace with Current URL
    .accesskey = C
tab-context-zen-edit-pinned-url = 
    .label = Edit…
    .accesskey = E
tab-context-zen-edit-title = 
    .label = Change Label...
tab-context-zen-edit-icon = 
    .label = Change Icon...
zen-themes-corrupted = Din { -brand-short-name } mods-fil er beskadiget. De er blevet nulstillet til standardtemaet.
zen-shortcuts-corrupted = Din { -brand-short-name }-genvejsfil er beskadiget. De er blevet nulstillet til standardgenvejene.
# note: Do not translate the "<br/>" tags in the following string
zen-new-urlbar-notification =
    Den nye URL-linje er aktiveret og fjerner dermed behovet for nye fanesider.<br/><br/>
    Prøv at åbne en ny fane for at se den i aktion!
zen-disable = Deaktiver
pictureinpicture-minimize-btn = 
    .aria-label = Minimer
    .tooltip = Minimer
zen-panel-ui-gradient-generator-custom-color = Brugerdefineret Farve
zen-copy-current-url-confirmation = Kopieret nuværende URL!
zen-copy-current-url-as-markdown-confirmation = Kopierede nuværende URL som Markdown!
zen-general-cancel-label = 
    .label = Annuller
zen-general-confirm = 
    .label = Bekræft
zen-pinned-tab-replaced = Den fastgjorte fane-URL blev erstattet med den aktuelle.
zen-pinned-tab-url-edited = Pinned tab URL has been updated!
zen-pinned-tab-url-invalid = That doesn't look like a valid URL.
zen-pinned-tab-edit-url-title = Edit Pinned URL
zen-pinned-tab-edit-url-label = Enter the URL this pinned tab should point to:
zen-tabs-renamed = Fanen blev omdøbt!
zen-background-tab-opened-toast = Ny baggrundsfane åbnet!
zen-workspace-renamed-toast = Arbejdsområde blev omdøbt!
zen-split-view-limit-toast = Kan ikke tilføje flere paneler til denne delte visning!
zen-toggle-compact-mode-button = 
    .label = Kompakt tilstand
    .tooltiptext = Kompakt tilstand til/fra

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = Lær mere
zen-close-label = Luk
zen-singletoolbar-urlbar-placeholder-with-name = 
    .placeholder = Søg...
zen-icons-picker-emoji = 
    .label = Emojis
zen-icons-picker-svg = 
    .label = Ikoner
zen-emojis-picker-search = 
    .placeholder = Search emojis
urlbar-search-mode-zen_actions = Handlinger
zen-site-data-settings = Indstillinger
zen-generic-manage = Administrer
zen-generic-more = Mere
zen-generic-next = Næste
zen-essentials-promo-label = Add to Essentials
zen-essentials-promo-sublabel = Hold dine yndlings faner et klik væk
# These labels will be used for the site data panel settings
zen-site-data-setting-allow = Tilladt
zen-site-data-setting-block = Blokeret
zen-site-data-protections-enabled = Aktiveret
zen-site-data-protections-disabled = Deaktiveret
zen-site-data-setting-cross-site = Cross-Site cookie
zen-site-data-security-info-extension = 
    .label = Udvidelse
zen-site-data-security-info-secure = 
    .label = Sikker
zen-site-data-security-info-not-secure = 
    .label = Ikke sikker
zen-site-data-manage-addons = 
    .label = Administrer udvidelser
zen-site-data-get-addons = 
    .label = Tilføj udvidelser
zen-site-data-site-settings = 
    .label = Alle Side Indstillinger
zen-site-data-header-share = 
    .tooltiptext = Del Denne Side
zen-site-data-header-reader-mode = 
    .tooltiptext = Åben Læsertilstand
zen-site-data-header-screenshot = 
    .tooltiptext = Tag et Skærmbillede
zen-site-data-header-bookmark = 
    .tooltiptext = Tilføj Side til Bogmærker
zen-urlbar-copy-url-button = 
    .tooltiptext = Kopiér URL
zen-site-data-setting-site-protection = Sporingsbeskyttelse

# Section: Feature callouts

zen-site-data-panel-feature-callout-title = Et nyt hjem for tilføjelser, tilladelser og mere
zen-site-data-panel-feature-callout-subtitle = Klik ikonet for at administrere side indstillinger, se sikkerhedsoplysninger, tilgå udvidelser, og udføre almindelige handlinger.
zen-open-link-in-glance = 
    .label = Open Link in Glance
    .accesskey = G
zen-sidebar-notification-updated-heading = Opdatering Fuldført!

# See ZenSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = Hvad er nyt i { -brand-short-name }
zen-sidebar-notification-updated-tooltip = 
    .title = Se Udgivelsesnoter
zen-sidebar-notification-donate-label = Support { -brand-short-name }
zen-sidebar-notification-donate-tooltip = 
    .title = Donate to the project
zen-sidebar-notification-restart-safe-mode-label = Noget der ikke virker?
zen-sidebar-notification-restart-safe-mode-tooltip = 
    .title = Genstart i Beskyttet Tilstand
zen-window-sync-migration-dialog-title = Hold Dine Vinduer Synkroniseret
zen-window-sync-migration-dialog-message = Zen synkroniserer nu vinduer på samme enhed, så ændringer i et vindue afspejles øjeblikkeligt på tværs af de andre.
zen-window-sync-migration-dialog-learn-more = Lær Mere
zen-window-sync-migration-dialog-accept = Forstået
zen-appmenu-new-blank-window = 
    .label = Nyt tomt vindue
