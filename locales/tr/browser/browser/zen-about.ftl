# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = { -brand-full-name } Hakkında
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Sürüm { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Sürüm { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Yapı bilgilerini kopyala
zen-about-copied = Kopyalandı
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = { -zen-engine-name } { $firefoxVersion } tabanlı

## Update status

zen-about-update-check = Güncellemeleri kontrol et
zen-about-update-check-again = Tekrar kontrol et
zen-about-update-try-again = Tekrar dene
zen-about-update-checking = Güncellemeler kontrol ediliyor…
zen-about-update-up-to-date = { -brand-short-name } güncel
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } mevcut
zen-about-update-download = İndir ve yükle
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Güncelleme indiriliyor — { $transfer }
zen-about-update-applying = Güncelleme uygulanıyor…
zen-about-update-ready = Güncelleme yüklenmeye hazır
zen-about-update-restart = Güncellemek için yeniden başlat
zen-about-update-restarting = Yeniden başlatılıyor…
zen-about-update-download-failed = Güncelleme indirilemedi
zen-about-update-checking-failed = Güncellemeler kontrol edilemedi
zen-about-update-internal-error = İç hata nedeniyle güncellemeler kullanılamıyor
zen-about-update-download-manually = El ile indir
zen-about-update-manual = İndirme sayfasında yeni bir sürüm mevcut
zen-about-update-policy-disabled = Güncellemeler kuruluşunuz tarafından devre dışı bırakıldı
zen-about-update-other-instance = { -brand-short-name } başka bir örnek tarafından güncelleniyor
zen-about-update-unsupported = Bu sistem artık güncelleme alamıyor
zen-about-update-learn-more = Daha fazla bilgi alın

## Links

zen-about-release-notes = Yenilikler
zen-about-donate = Bağış yap
zen-about-report-issue = Sorun bildir
zen-about-community = { -brand-short-name }, <a data-l10n-name="github-link">katkıda bulunan topluluk</a> tarafından { -zen-engine-name } üzerinde oluşturulmuş, ücretsiz ve açık kaynaklı bir yazılımdır.
zen-about-license = Lisans
zen-about-rights = Haklarınız
zen-about-privacy = Gizlilik
