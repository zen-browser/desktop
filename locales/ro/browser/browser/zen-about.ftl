# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Despre { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Versiune { $version } ({ $arch})
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Versiune { $version } ({ $isodate }) ({ $arch})
zen-about-version-button = 
    .title = Copiază informațiile de construcție
zen-about-copied = Copiat
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Pe baza { -zen-engine-name } { $firefoxVersion}

## Update status

zen-about-update-check = Verifică dacă există Actualizări
zen-about-update-try-again = Încearcă din nou
zen-about-update-checking = Verificare actualizări...
zen-about-update-up-to-date = { -brand-short-name } este la zi
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } este disponibil
zen-about-update-download = Descarcă și instalează
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Se descarcă actualizarea — { $transfer}
zen-about-update-applying = Se aplică actualizarea…
zen-about-update-ready = Actualizarea este gata de instalare
zen-about-update-restart = Repornește pentru a actualiza
zen-about-update-restarting = Repornire…
zen-about-update-download-failed = Actualizarea nu a putut fi descărcată
zen-about-update-checking-failed = Nu s-au putut verifica actualizările
zen-about-update-internal-error = Actualizările sunt indisponibile din cauza unei erori interne
zen-about-update-download-manually = Descarcă manual
zen-about-update-manual = O versiune nouă este disponibilă pe pagina de descărcare
zen-about-update-policy-disabled = Actualizările sunt dezactivate de organizația ta
zen-about-update-other-instance = { -brand-short-name } este actualizat de către o altă instanță
zen-about-update-unsupported = Acest sistem nu mai poate primi actualizări
zen-about-update-learn-more = Află mai multe

## Links

zen-about-release-notes = Ce este nou
zen-about-donate = Donează
zen-about-report-issue = Raportează o problemă
zen-about-community = { -brand-short-name } este gratuit și cu sursă deschisă, construit pe { -zen-engine-name } de o comunitate <a data-l10n-name="github-link">de contributori</a>.
zen-about-license = Licență
zen-about-rights = Drepturile tale
zen-about-privacy = Confidențialitate
