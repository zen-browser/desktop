# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = profilul curent
unified-extensions-description = Extensiile sunt folosite pentru a aduce funcționalități suplimentare în { -brand-short-name }.
tab-context-zen-reset-pinned-tab = 
    .label =
        { $isEssential ->
            [true] Resetare Filă Esențială
           *[false] Resetare Filă Fixată
        }
    .accesskey = R
tab-context-zen-add-essential = 
    .label = Adaugă la Esențiale
    .accesskey = E
tab-context-zen-add-essential-badge = { $num } / { $max }
tab-context-zen-remove-essential = 
    .label = Elimină din Esențiale
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
zen-themes-corrupted = Fișierul tău de moduri { -brand-short-name } este corupt. Acestea au fost resetate la tema implicită.
zen-shortcuts-corrupted = Fișierul tău de scurtături { -brand-short-name } este corupt. Acestea au fost resetate la scurtăturile implicite.
# note: Do not translate the "<br/>" tags in the following string
zen-new-urlbar-notification =
    Noua bară URL a fost activată, eliminând necesitatea pentru paginile cu file noi.<br/><br/>
    Încearcă să deschizi o filă nouă pentru a vedea noua bară URL în acțiune!
zen-disable = Dezactivează
pictureinpicture-minimize-btn = 
    .aria-label = Minimizează
    .tooltip = Minimizează
zen-panel-ui-gradient-generator-custom-color = Culoare Personalizată
zen-copy-current-url-confirmation = URL-ul curent a fost copiat!
zen-copy-current-url-as-markdown-confirmation = URL-ul curent a fost copiat ca Markdown!
zen-general-cancel-label = 
    .label = Anulează
zen-general-confirm = 
    .label = Confirmă
zen-pinned-tab-replaced = URL-ul filei fixate a fost înlocuit cu URL-ul curent!
zen-pinned-tab-url-edited = Pinned tab URL has been updated!
zen-pinned-tab-url-invalid = That doesn't look like a valid URL.
zen-pinned-tab-edit-url-title = Edit Pinned URL
zen-pinned-tab-edit-url-label = Enter the URL this pinned tab should point to:
zen-tabs-renamed = Fila a fost redenumită cu succes!
zen-background-tab-opened-toast = Filă nouă de fundal deschisă!
zen-workspace-renamed-toast = Spațiul de Lucru a fost redenumit cu succes!
zen-split-view-limit-toast = Nu se mai pot adăuga panouri noi la vizualizarea împărțită!
zen-toggle-compact-mode-button = 
    .label = Modul Compact
    .tooltiptext = Comută Modul Compact

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = Află mai multe
zen-close-label = Închide
zen-singletoolbar-urlbar-placeholder-with-name = 
    .placeholder = Caută...
zen-icons-picker-emoji = 
    .label = Emoji-uri
zen-icons-picker-svg = 
    .label = Iconițe
zen-emojis-picker-search = 
    .placeholder = Search emojis
urlbar-search-mode-zen_actions = Acțiuni
zen-site-data-settings = Setări
zen-generic-manage = Gestionează
zen-generic-more = Mai multe
zen-generic-next = Următorul
zen-essentials-promo-label = Adaugă la Esențiale
zen-essentials-promo-sublabel = Ține filele tale preferate la un click distanță
# These labels will be used for the site data panel settings
zen-site-data-setting-allow = Permis
zen-site-data-setting-block = Blocat
zen-site-data-protections-enabled = Activat
zen-site-data-protections-disabled = Dezactivat
zen-site-data-setting-cross-site = Cookie Cross-Site
zen-site-data-security-info-extension = 
    .label = Extensie
zen-site-data-security-info-secure = 
    .label = Securizat
zen-site-data-security-info-not-secure = 
    .label = Nesecurizat
zen-site-data-manage-addons = 
    .label = Gestionează Extensiile
zen-site-data-get-addons = 
    .label = Adaugă Extensii
zen-site-data-site-settings = 
    .label = Toate Setările Site-ului
zen-site-data-header-share = 
    .tooltiptext = Distribuie Această Pagină
zen-site-data-header-reader-mode = 
    .tooltiptext = Intră în Modul Cititor
zen-site-data-header-screenshot = 
    .tooltiptext = Fă o Captură Ecran
zen-site-data-header-bookmark = 
    .tooltiptext = Marchează Această Pagină
zen-urlbar-copy-url-button = 
    .tooltiptext = Copiază URL-ul
zen-site-data-setting-site-protection = Protecție împotriva Urmăririi

# Section: Feature callouts

zen-site-data-panel-feature-callout-title = O casă nouă pentru Suplimente, Permisiuni și multe altele
zen-site-data-panel-feature-callout-subtitle = Apasă pe iconiță pentru a gestiona setările site-ului, pentru a vizualiza informațiile de securitate, accesul extensiilor și pentru a efectua acțiuni comune.
zen-open-link-in-glance = 
    .label = Deschide link-ul în Glance
    .accesskey = G
zen-sidebar-notification-updated-heading = Actualizare finalizată!

# See ZenSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = Ce este nou în { -brand-short-name }
zen-sidebar-notification-updated-tooltip = 
    .title = Vezi Notele de Lansare
zen-sidebar-notification-donate-label = Support { -brand-short-name }
zen-sidebar-notification-donate-tooltip = 
    .title = Donate to the project
zen-sidebar-notification-restart-safe-mode-label = S-a stricat ceva?
zen-sidebar-notification-restart-safe-mode-tooltip = 
    .title = Repornește în Modul Sigur
zen-window-sync-migration-dialog-title = Păstrează-ți Ferestrele Sincronizate
zen-window-sync-migration-dialog-message = Zen sincronizează ferestrele pe același dispozitiv, deci modificările dintr-o fereastră sunt reflectate instantaneu la celelalte ferestre.
zen-window-sync-migration-dialog-learn-more = Află mai multe
zen-window-sync-migration-dialog-accept = Am înțeles
zen-appmenu-new-blank-window = 
    .label = Fereastră Nouă Goală
