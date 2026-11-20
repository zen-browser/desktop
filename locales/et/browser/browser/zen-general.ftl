# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = praegune profiil
unified-extensions-description = Laiendusi kasutatakse täiendava funktsionaalsuse lisamiseks { -brand-short-name }i.
tab-context-zen-reset-pinned-tab = 
    .label =
        { $isEssential ->
            [true] Reset Essential Tab
           *[false] Reset Pinned Tab
        }
    .accesskey = p
tab-context-zen-add-essential = 
    .label = Add to Essentials
    .accesskey = o
tab-context-zen-add-essential-badge = { $num } / { $max } slots filled
tab-context-zen-remove-essential = 
    .label = Eemalda olulistest
    .accesskey = o
tab-context-zen-edit-pinned-page = 
    .label =
        { $isEssential ->
            [true] Edit Essential URL
           *[false] Edit Pinned URL
        }
    .accesskey = P
tab-context-zen-replace-pinned-url-with-current = 
    .label = Replace with Current URL
    .accesskey = p
tab-context-zen-edit-pinned-url = 
    .label = Muuda…
    .accesskey = E
tab-context-zen-edit-title = 
    .label = Muuda silti…
tab-context-zen-edit-icon = 
    .label = Muuda ikooni…
zen-themes-corrupted = Sinu { -brand-short-name } mods-ide fail on vigane. See on nüüd lähtestatud vaikimisi teemaks.
# note: Do not translate the "<br/>" tags in the following string
zen-new-urlbar-notification =
    Uus asukohariba on sisse lülitatud, mistõttu pole enam uue kaardi lehte tarvis.<br/><br/>
    Proovi avada uut kaarti, et näha uut asukohariba!
zen-disable = Lülita välja
pictureinpicture-minimize-btn = 
    .aria-label = Minimeeri
    .tooltip = Minimeeri
zen-panel-ui-gradient-generator-custom-color = Kohandatud värv
zen-copy-urls-confirmation =
    { $count ->
        [1] Copied current URL!
       *[other] Copied { $count } URLs!
    }
zen-copy-urls-as-markdown-confirmation =
    { $count ->
        [1] Copied current URL as Markdown!
       *[other] Copied { $count } URLs as Markdown!
    }
zen-general-cancel-label = 
    .label = Tühista
zen-general-confirm = 
    .label = Kinnita
zen-pinned-tab-replaced = Esiletõstetud vahekaardi võrguaadress on asendatud praeguse võrguaadressiga!
zen-pinned-tab-url-edited = Pinned tab URL has been updated!
zen-pinned-tab-url-invalid = That doesn't look like a valid URL.
zen-pinned-tab-edit-url-title = Muuda esiletõstetud võrguaadressi
zen-pinned-tab-edit-url-label = Sisesta võrguaadress, kuu see esiletõstetud vahekaart peaks viitama:
zen-tabs-renamed = Vahekaardi nimi on kenasti muudetud!
zen-background-tab-opened-toast = Taustal avati uus kaart!
zen-zoom-changed-toast = { NUMBER($percentage, style: "percent") }
zen-workspace-renamed-toast = Tööruumi nimi on kenasti muudetud!
zen-split-view-limit-toast = Can't add more panels to the split view!
zen-shortcut-blocked-toast = <span>{ $shortcut }</span> again to { $action }
zen-shortcut-blocked-toast-default-action = use it in { -brand-short-name }
zen-sidebar-drag-collapsed-toast = Sidebar hidden! Use <span>{ $shortcut }</span> to bring the sidebar back.
zen-toggle-compact-mode-button = 
    .label = Compact Mode
    .tooltiptext = Lülita kompaktne režiim sisse/välja

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = Rohkem teavet
zen-close-label = Sulge
zen-singletoolbar-urlbar-placeholder-with-name = 
    .placeholder = Otsi...
zen-icons-picker-emoji = 
    .label = Emojid
zen-icons-picker-svg = 
    .label = Ikoonid
zen-emojis-picker-search = 
    .placeholder = Search emojis
urlbar-search-mode-zen_actions = Tegevused
zen-site-data-settings = Sätted
zen-generic-manage = Halda
zen-generic-more = Rohkem
zen-generic-next = Next
zen-essentials-promo-label = Add to Essentials
zen-essentials-promo-sublabel = Keep your favorite tabs just a click away
# These labels will be used for the site data panel settings
zen-site-data-setting-allow = Lubatud
zen-site-data-setting-block = Keelatud
zen-site-data-protections-enabled = Enabled
zen-site-data-protections-disabled = Disabled
zen-site-data-security-info-extension = 
    .label = Laiendus
zen-site-data-security-info-secure = 
    .label = Turvaline
zen-site-data-security-info-not-secure = 
    .label = Ebaturvaline
zen-site-data-manage-addons = 
    .label = Halda laiendusi
zen-site-data-get-addons = 
    .label = Lisa laiendusi
zen-site-data-site-settings = 
    .label = Kõik saidi seadistused
zen-site-data-header-share = 
    .tooltiptext = Share This Page
zen-site-data-header-boost = 
    .tooltiptext = Create a Boost
zen-site-data-header-reader-mode = 
    .tooltiptext = Enter Reader Mode
zen-site-data-header-screenshot = 
    .tooltiptext = Take a Screenshot
zen-site-data-header-bookmark = 
    .tooltiptext = Bookmark This Page
zen-urlbar-copy-url-button = 
    .tooltiptext = Copy URL
zen-site-data-setting-site-protection = Tracking Protection

# Section: Feature callouts

zen-site-data-panel-feature-callout-title = A new home for add-ons, permissions, and more
zen-site-data-panel-feature-callout-subtitle = Click the icon to manage site settings, view security info, access extensions, and perform common actions.
zen-open-link-in-glance = 
    .label = Open Link in Glance
    .accesskey = G
zen-sidebar-notification-updated-heading = Update Complete!

# See ZenSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = What's new in { -brand-short-name }
zen-sidebar-notification-updated-tooltip = 
    .title = View Release Notes
zen-sidebar-notification-donate-label = Support { -brand-short-name }
zen-sidebar-notification-donate-tooltip = 
    .title = Donate to the project
zen-sidebar-notification-restart-safe-mode-label = Something broke?
zen-sidebar-notification-restart-safe-mode-tooltip = 
    .title = Restart in Safe Mode
zen-window-sync-migration-dialog-title = Keep Your Windows in Sync
zen-window-sync-migration-dialog-message = Zen now syncs windows on the same device, so changes in one window are reflected across the others instantly.
zen-window-sync-migration-dialog-learn-more = Learn More
zen-window-sync-migration-dialog-accept = Got It
zen-appmenu-new-blank-window = 
    .label = Uus tühi aken
zen-appmenu-new-little-window = 
    .label = New Little Window
zen-little-window-open-in-space = Open in <b data-l10n-name="space">{ $space }</b>
zen-little-window-open-in-new-window = Open in { -brand-short-name }
zen-little-window-choose-space = 
    .tooltiptext = Vali tööruum
zen-little-window-title = Little Zen
zen-little-window-intro-title = Opened in <i data-l10n-name="name">Little Zen</i>
zen-little-window-intro-description = Click “Open in” to move this page to a full window, or { $shortcut } to close
zen-little-window-download-source = 
    .value = From { $host }
