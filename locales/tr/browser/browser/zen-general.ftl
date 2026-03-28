# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = mevcut profil
unified-extensions-description = Uzantılar { -brand-short-name }'e daha fazla ek işlevsellik kazandırmak için kullanılır.
tab-context-zen-reset-pinned-tab = 
    .label =
        { $isEssential ->
            [true] Temel sekmeyi sıfırla
           *[false] Sabitlenmiş sekmeyi sıfırla
        }
    .accesskey = R
tab-context-zen-add-essential = 
    .label = Temel sekmelere ekle
    .accesskey = E
tab-context-zen-add-essential-badge = { $num } / { $max } yuva dolu
tab-context-zen-remove-essential = 
    .label = Temel sekmelerden kaldır
    .accesskey = R
tab-context-zen-replace-pinned-url-with-current = 
    .label =
        { $isEssential ->
            [true] Temel sekmenin URL’sini geçerli olanla değiştir
           *[false] Sabitlenmiş sekme URL’sini geçerli olanla değiştir
        }
    .accesskey = C
tab-context-zen-edit-title = 
    .label = Etiketi Değiştir...
tab-context-zen-edit-icon = 
    .label = Simgeyi Değiştir...
zen-themes-corrupted = { -brand-short-name } adlı modun dosyaları hatalı. Varsayılan temaya sıfırlandılar.
zen-shortcuts-corrupted = { -brand-short-name } kısayol dosyanız bozuldu. Varsayılan kısayollara sıfırlandı.
# note: Do not translate the "<br/>" tags in the following string
zen-new-urlbar-notification =
    Yeni adres çubuğu etkinleştirildi ve yeni sekme sayfalarına olan ihtiyaç ortadan kalktı.<br/><br/>
    Yeni adres çubuğunu çalışırken görmek için yeni bir sekme açmayı dene!
zen-disable = Devre dışı bırak
pictureinpicture-minimize-btn = 
    .aria-label = Küçült
    .tooltip = Küçült
zen-panel-ui-gradient-generator-custom-color = Özel renk
zen-copy-current-url-confirmation = Geçerli URL kopyalandı!
zen-copy-current-url-as-markdown-confirmation = Geçerli URL Markdown olarak kopyalandı!
zen-general-cancel-label = 
    .label = İptal
zen-general-confirm = 
    .label = Onayla
zen-pinned-tab-replaced = Sabitlenmiş sekmenin URL’si, mevcut URL ile değiştirildi!
zen-tabs-renamed = Sekme başarıyla yeniden adlandırıldı!
zen-background-tab-opened-toast = Yeni arka plan sekmesi açıldı!
zen-workspace-renamed-toast = Çalışma alanı başarıyla yeniden adlandırıldı!
zen-toggle-compact-mode-button = 
    .label = Kompakt mod
    .tooltiptext = Kompakt modu aç/kapat

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = Daha fazla bilgi
zen-close-label = Kapat
zen-singletoolbar-urlbar-placeholder-with-name = 
    .placeholder = Ara...
zen-icons-picker-emoji = 
    .label = Emojiler
zen-icons-picker-svg = 
    .label = Simgeler
urlbar-search-mode-zen_actions = Eylemler
zen-site-data-settings = Ayarlar
zen-generic-manage = Yönet
zen-generic-more = Daha
zen-generic-next = Sonraki
zen-essentials-promo-label = Temel sekmelere ekle
zen-essentials-promo-sublabel = Favori sekmelerinize tek tıkla erişin
# These labels will be used for the site data panel settings
zen-site-data-setting-allow = İzin verildi
zen-site-data-setting-block = Engellendi
zen-site-data-protections-enabled = Etkinleştirildi
zen-site-data-protections-disabled = Devre dışı bırakıldı
zen-site-data-setting-cross-site = Siteler arası çerez
zen-site-data-security-info-extension = 
    .label = Uzantı
zen-site-data-security-info-secure = 
    .label = Güvenli
zen-site-data-security-info-not-secure = 
    .label = Güvenli değil
zen-site-data-manage-addons = 
    .label = Uzantıları yönet
zen-site-data-get-addons = 
    .label = Uzantı ekle
zen-site-data-site-settings = 
    .label = Tüm site ayarları
zen-site-data-header-share = 
    .tooltiptext = Bu sayfayı paylaş
zen-site-data-header-reader-mode = 
    .tooltiptext = Okuyucu moduna gir
zen-site-data-header-screenshot = 
    .tooltiptext = Ekran görüntüsü al
zen-site-data-header-bookmark = 
    .tooltiptext = Bu sayfayı yer imlerine ekle
zen-urlbar-copy-url-button = 
    .tooltiptext = URL'yi kopyala
zen-site-data-setting-site-protection = İzleme koruması

# Section: Feature callouts

zen-site-data-panel-feature-callout-title = Eklentiler, izinler ve daha fazlası için yeni bir alan
zen-site-data-panel-feature-callout-subtitle = Site ayarlarını yönetmek, güvenlik bilgilerini görüntülemek, uzantılara erişmek ve yaygın işlemleri gerçekleştirmek için simgeye tıklayın.
zen-open-link-in-glance = 
    .label = Bağlantıyı hızlı görünümde aç
    .accesskey = G
zen-sidebar-notification-updated-heading = Güncelleme tamamlandı!

# See ZenSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = { -brand-short-name }'de neler yeni
zen-sidebar-notification-updated-tooltip = 
    .title = Sürüm Notlarını Görüntüle
zen-sidebar-notification-restart-safe-mode-label = Bir sorun mu oluştu?
zen-sidebar-notification-restart-safe-mode-tooltip = 
    .title = Güvenli Modda Yeniden Başlat
zen-window-sync-migration-dialog-title = Pencerelerinizi Senkronize Tutun
zen-window-sync-migration-dialog-message = Zen artık aynı cihazdaki pencereleri senkronize ediyor; böylece bir pencerede yapılan değişiklikler anında diğer pencerelere yansıyor.
zen-window-sync-migration-dialog-learn-more = Daha fazla bilgi
zen-window-sync-migration-dialog-accept = Anladım
zen-appmenu-new-blank-window = 
    .label = Yeni boş pencere
