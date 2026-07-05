# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = profil curent
unified-extensions-description = Extensiile sunt utilizate pentru a aduce mai multe funcționalități suplimentare în { -brand-short-name }.
tab-context-zen-reset-pinned-tab = 
    .label =
        { $isEssential ->
            [true] Reset Essential Tab
           *[false] Reset Pinned Tab
        }
    .accesskey = R
tab-context-zen-add-essential = 
    .label = Adaugă la Essentials
    .accesskey = E
tab-context-zen-add-essential-badge = { $num } / { $max } slots filled
tab-context-zen-remove-essential = 
    .label = Elimină din Essentials
    .accesskey = R
tab-context-zen-edit-pinned-page = 
    .label =
        { $isEssential ->
            [true] Editați URL-ul esențial
           *[false] Editare URL Pinned
        }
    .accesskey = P
tab-context-zen-replace-pinned-url-with-current = 
    .label = Înlocuiește cu URL-ul curent
    .accesskey = C
tab-context-zen-edit-pinned-url = 
    .label = Editare…
    .accesskey = E
tab-context-zen-edit-title = 
    .label = Change Label...
tab-context-zen-edit-icon = 
    .label = Change Icon...
zen-themes-corrupted = Fișierul dvs. { -brand-short-name } modds este corupt. Acestea au fost resetate la tema implicită.
zen-shortcuts-corrupted = Fișierul de comenzi rapide { -brand-short-name } este corupt. Acestea au fost resetate la comenzile rapide implicite.
# note: Do not translate the "<br/>" tags in the following string
zen-new-urlbar-notification =
    Noua bară URL a fost activată, eliminând necesitatea pentru paginile cu file noi.<br/><br/>
    Încearcă să deschizi o filă nouă pentru a vedea noua bară URL în acțiune!
zen-disable = Dezactivează
pictureinpicture-minimize-btn = 
    .aria-label = Minimize
    .tooltip = Minimize
zen-panel-ui-gradient-generator-custom-color = Culoare personalizată
zen-copy-current-url-confirmation = URL curent copiat!
zen-copy-current-url-as-markdown-confirmation = URL-ul curent copiat ca Markdown!
zen-general-cancel-label = 
    .label = Anulează
zen-general-confirm = 
    .label = Confirmare
zen-pinned-tab-replaced = URL-ul filei fixate a fost înlocuit cu URL-ul curent!
zen-pinned-tab-url-edited = URL-ul filei fixate a fost actualizat!
zen-pinned-tab-url-invalid = Asta nu arată ca un URL valid.
zen-pinned-tab-edit-url-title = Editare URL fixat
zen-pinned-tab-edit-url-label = Introduceți adresa URL pe care această filă ar trebui să o indice:
zen-tabs-renamed = Fila a fost redenumită cu succes!
zen-background-tab-opened-toast = Noua filă de fundal deschisă!
zen-workspace-renamed-toast = Spațiul de lucru a fost redenumit cu succes!
zen-split-view-limit-toast = Nu se pot adăuga mai multe panouri la vizualizarea divizată!
zen-toggle-compact-mode-button = 
    .label = Mod compact
    .tooltiptext = Comutare mod compact

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = Află mai multe
zen-close-label = Inchide
zen-singletoolbar-urlbar-placeholder-with-name = 
    .placeholder = Caută...
zen-icons-picker-emoji = 
    .label = Emojis
zen-icons-picker-svg = 
    .label = Iconițe
zen-emojis-picker-search = 
    .placeholder = Search emojis
urlbar-search-mode-zen_actions = Acțiuni
zen-site-data-settings = Setări
zen-generic-manage = Gestionează
zen-generic-more = Mai
zen-generic-next = Următoarea
zen-essentials-promo-label = Adaugă la Essentials
zen-essentials-promo-sublabel = Ține filele tale preferate la doar un clic distanță
# These labels will be used for the site data panel settings
zen-site-data-setting-allow = Permis
zen-site-data-setting-block = Blocat
zen-site-data-protections-enabled = Activat
zen-site-data-protections-disabled = Dezactivat
zen-site-data-setting-cross-site = Cookie-uri trans-site
zen-site-data-security-info-extension = 
    .label = Extensie
zen-site-data-security-info-secure = 
    .label = Securizat
zen-site-data-security-info-not-secure = 
    .label = Nu este securizat
zen-site-data-manage-addons = 
    .label = Gestionare extensii
zen-site-data-get-addons = 
    .label = Adaugă Extensii
zen-site-data-site-settings = 
    .label = Toate Setările Site-ului
zen-site-data-header-share = 
    .tooltiptext = Distribuie această pagină
zen-site-data-header-reader-mode = 
    .tooltiptext = Intră în modul Cititor
zen-site-data-header-screenshot = 
    .tooltiptext = Captură de ecran
zen-site-data-header-bookmark = 
    .tooltiptext = Marchează această pagină
zen-urlbar-copy-url-button = 
    .tooltiptext = Copiază URL-ul
zen-site-data-setting-site-protection = Protecție de urmărire

# Section: Feature callouts

zen-site-data-panel-feature-callout-title = O locuinţă nouă pentru suplimente, permisiuni şi multe altele
zen-site-data-panel-feature-callout-subtitle = Faceți clic pe pictogramă pentru a gestiona setările site-ului, pentru a vizualiza informațiile de securitate, extensiile de acces și pentru a efectua acțiuni comune.
zen-open-link-in-glance = 
    .label = Deschide link-ul în Glance
    .accesskey = G
zen-sidebar-notification-updated-heading = Actualizare finalizată!

# See ZenSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = Ce este nou în { -brand-short-name }
zen-sidebar-notification-updated-tooltip = 
    .title = Vezi notele de lansare
zen-sidebar-notification-restart-safe-mode-label = Ceva s-a rupt?
zen-sidebar-notification-restart-safe-mode-tooltip = 
    .title = Repornire în modul sigur
zen-window-sync-migration-dialog-title = Păstrați Windows în sincronizare
zen-window-sync-migration-dialog-message = Nixo now syncs windows on the same device, so changes in one window are reflected across the others instantly.
zen-window-sync-migration-dialog-learn-more = Află mai multe
zen-window-sync-migration-dialog-accept = Am înţeles
zen-appmenu-new-blank-window = 
    .label = Fereastră nouă goală
