# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Over { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Versie { $version } ({ $arch})
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Versie { $version } ({ $isodate }) ({ $arch})
zen-about-version-button = 
    .title = Kopieer build informatie
zen-about-copied = Gekopieerd
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Op basis van { -zen-engine-name } { $firefoxVersion}

## Update status

zen-about-update-check = Controleer op updates
zen-about-update-check-again = Opnieuw controleren
zen-about-update-try-again = Opnieuw proberen
zen-about-update-checking = Naar updates zoeken...
zen-about-update-up-to-date = { -brand-short-name } is actueel
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } is beschikbaar
zen-about-update-download = Downloaden en installeren
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Update downloaden — { $transfer }
zen-about-update-applying = Update toepassen…
zen-about-update-ready = De update is klaar voor installatie
zen-about-update-restart = Opnieuw starten om te updaten
zen-about-update-restarting = Herstarten…
zen-about-update-download-failed = De update kon niet worden gedownload
zen-about-update-checking-failed = Kon niet op updates controleren
zen-about-update-internal-error = Updates zijn niet beschikbaar vanwege een interne fout
zen-about-update-download-manually = Handmatig downloaden
zen-about-update-manual = Er is een nieuwe versie beschikbaar op de downloadpagina
zen-about-update-policy-disabled = Updates zijn uitgeschakeld door je organisatie
zen-about-update-other-instance = { -brand-short-name } wordt bijgewerkt door een andere instantie
zen-about-update-unsupported = Dit systeem kan geen updates meer ontvangen
zen-about-update-learn-more = Meer info

## Links

zen-about-release-notes = Wat is er nieuw
zen-about-donate = Doneren
zen-about-report-issue = Meld een probleem
zen-about-community = { -brand-short-name } is gratis en open source, gebouwd op { -zen-engine-name } door een <a data-l10n-name="github-link">gemeenschap van bijdragers</a>.
zen-about-license = Licentie
zen-about-rights = Je rechten
zen-about-privacy = Privacy
