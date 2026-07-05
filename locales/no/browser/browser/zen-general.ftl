# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = gjeldende profil
unified-extensions-description = Utvidelser brukes for å få mer tilleggsfunksjonalitet inn i { -brand-short-name }.
tab-context-zen-reset-pinned-tab = 
    .label =
        { $isEssential ->
            [true] Reset Essential Tab
           *[false] Reset Pinned Tab
        }
    .accesskey = L
tab-context-zen-add-essential = 
    .label = Legg til i Essentials
    .accesskey = Ø
tab-context-zen-add-essential-badge = { $num } / { $max}
tab-context-zen-remove-essential = 
    .label = Fjern fra Essentials
    .accesskey = L
tab-context-zen-edit-pinned-page = 
    .label =
        { $isEssential ->
            [true] Rediger Essential URL
           *[false] Rediger Pinned URL
        }
    .accesskey = L
tab-context-zen-replace-pinned-url-with-current = 
    .label = Erstatt med gjeldende URL
    .accesskey = K
tab-context-zen-edit-pinned-url = 
    .label = Rediger…
    .accesskey = Ø
tab-context-zen-edit-title = 
    .label = Endre etikett…
tab-context-zen-edit-icon = 
    .label = Endre ikon…
zen-themes-corrupted = Din { -brand-short-name } mods fil er skadet. De har blitt tilbakestilt til standardtemaet.
zen-shortcuts-corrupted = { -brand-short-name } snarvei-filen din er skadet. De har blitt tilbakestilt til standard snarveier.
# note: Do not translate the "<br/>" tags in the following string
zen-new-urlbar-notification =
    Den nye URL-linjen er aktivert, fjerner behovet for nye fanesider.<br/><br/>
    Prøv å åpne en ny fane for å se den nye URL-linjen som brukes i handling!
zen-disable = Deaktiver
pictureinpicture-minimize-btn = 
    .aria-label = Minimize
    .tooltip = Minimize
zen-panel-ui-gradient-generator-custom-color = Egendefinert farge
zen-copy-current-url-confirmation = Kopierte gjeldende URL!
zen-copy-current-url-as-markdown-confirmation = Kopierte gjeldende nettadresse som Markdown!
zen-general-cancel-label = 
    .label = Avbryt
zen-general-confirm = 
    .label = Bekreft
zen-pinned-tab-replaced = Festet tab-URL har blitt erstattet med gjeldende URL!
zen-pinned-tab-url-edited = Festet fane URL er oppdatert!
zen-pinned-tab-url-invalid = Det ser ikke ut som en gyldig URL-adresse.
zen-pinned-tab-edit-url-title = Rediger fast nettadresse
zen-pinned-tab-edit-url-label = Skriv inn URL-adressen for den låste fanen skal peke til:
zen-tabs-renamed = Kategorien har blitt omdøpt!
zen-background-tab-opened-toast = Ny bakgrunnsfane åpnet!
zen-workspace-renamed-toast = Arbeidsområdet har blitt omdøpt!
zen-split-view-limit-toast = Kan ikke legge til flere paneler i delt visning!
zen-toggle-compact-mode-button = 
    .label = Kompakt modus
    .tooltiptext = Kompaktmodus av/på

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = Finn ut mer
zen-close-label = Lukk
zen-singletoolbar-urlbar-placeholder-with-name = 
    .placeholder = Søk...
zen-icons-picker-emoji = 
    .label = Emojis
zen-icons-picker-svg = 
    .label = Ikoner
zen-emojis-picker-search = 
    .placeholder = Search emojis
urlbar-search-mode-zen_actions = Handlinger
zen-site-data-settings = Innstillinger
zen-generic-manage = Administrer
zen-generic-more = Mer
zen-generic-next = Neste
zen-essentials-promo-label = Legg til i Essentials
zen-essentials-promo-sublabel = Hold favorittfanene dine bare et klikk unna
# These labels will be used for the site data panel settings
zen-site-data-setting-allow = Tillatt
zen-site-data-setting-block = Blokkert
zen-site-data-protections-enabled = Aktivert
zen-site-data-protections-disabled = Deaktivert
zen-site-data-setting-cross-site = Cross-Site cookie
zen-site-data-security-info-extension = 
    .label = Utvidelse
zen-site-data-security-info-secure = 
    .label = Sikker
zen-site-data-security-info-not-secure = 
    .label = Ikke sikker
zen-site-data-manage-addons = 
    .label = Oppdater utvidelser
zen-site-data-get-addons = 
    .label = Legg til utvidelser
zen-site-data-site-settings = 
    .label = Alle nettstedsinnstillinger
zen-site-data-header-share = 
    .tooltiptext = Del denne siden
zen-site-data-header-reader-mode = 
    .tooltiptext = Gå til lesemodus
zen-site-data-header-screenshot = 
    .tooltiptext = Ta et skjermbilde
zen-site-data-header-bookmark = 
    .tooltiptext = Bokmerk denne siden
zen-urlbar-copy-url-button = 
    .tooltiptext = Kopier URL
zen-site-data-setting-site-protection = Sporer beskyttelse

# Section: Feature callouts

zen-site-data-panel-feature-callout-title = Et nytt hjem for tillegg, tillatelser og mer
zen-site-data-panel-feature-callout-subtitle = Klikk på ikonet for å administrere innstillinger på nettstedet, se sikkerhetsinformasjon, tilgangsutvidelser og utføre vanlige handlinger.
zen-open-link-in-glance = 
    .label = Åpne link i sammenheng
    .accesskey = G
zen-sidebar-notification-updated-heading = Oppdatering fullført!

# See ZenSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = Hva er nytt i { -brand-short-name }
zen-sidebar-notification-updated-tooltip = 
    .title = Se utgivelsesnotater
zen-sidebar-notification-restart-safe-mode-label = Noe er ødelagt?
zen-sidebar-notification-restart-safe-mode-tooltip = 
    .title = Omstart i sikker modus
zen-window-sync-migration-dialog-title = Behold Windows er synkronisert
zen-window-sync-migration-dialog-message = Nixo now syncs windows on the same device, so changes in one window are reflected across the others instantly.
zen-window-sync-migration-dialog-learn-more = Finn ut mer
zen-window-sync-migration-dialog-accept = Har det
zen-appmenu-new-blank-window = 
    .label = Nytt tomt vindu
