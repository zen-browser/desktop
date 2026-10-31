# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = O { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Wersja { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Wersja { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Skopiuj informacje o buildzie
zen-about-copied = Skopiowano
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Bazuje na { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Sprawdź aktualizacje
zen-about-update-check-again = Sprawdź ponownie
zen-about-update-try-again = Spróbuj ponownie
zen-about-update-checking = Sprawdzanie aktualizacji…
zen-about-update-up-to-date = { -brand-short-name } jest aktualny
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } jest dostępny
zen-about-update-download = Pobierz i zainstaluj
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Pobieranie aktualizacji — { $transfer }
zen-about-update-applying = Trwa instalowanie aktualizacji…
zen-about-update-ready = Aktualizacja jest gotowa do zainstalowania
zen-about-update-restart = Zrestartuj by zaktualizować
zen-about-update-restarting = Restartowanie…
zen-about-update-download-failed = Nie udało się pobrać aktualizacji.
zen-about-update-checking-failed = Nie udało się sprawdzić dostępności aktualizacji
zen-about-update-internal-error = Aktualizacje nie są dostępne z powodu wewnętrznego błędu
zen-about-update-download-manually = Pobierz ręcznie
zen-about-update-manual = Nowa wersja jest dostępna na stronie pobierania
zen-about-update-policy-disabled = Aktualizacje są wyłączone przez Twoją organizację
zen-about-update-other-instance = { -brand-short-name } jest aktualizowany przez inną instancję
zen-about-update-unsupported = Ten system nie może dłużej otrzymywać aktualizacji
zen-about-update-learn-more = Dowiedz się więcej

## Links

zen-about-release-notes = Co nowego
zen-about-donate = Wesprzyj
zen-about-report-issue = Zgłoś problem
zen-about-community = { -brand-short-name } jest darmowym i otwartym oprogramowaniem, zbudowany na { -zen-engine-name } przez <a data-l10n-name="github-link">społeczność twórców</a>.
zen-about-license = Licencja
zen-about-rights = Twoja prawa
zen-about-privacy = Prywatność
