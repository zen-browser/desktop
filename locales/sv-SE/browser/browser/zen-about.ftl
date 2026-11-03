# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Om { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Version { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Version { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Kopiera bygginformation
zen-about-copied = Kopierat
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Baserat på { -zen-engine-name } { $firefoxVersion}

## Update status

zen-about-update-check = Sök efter uppdateringar
zen-about-update-try-again = Försök igen
zen-about-update-checking = Söker efter uppdateringar…
zen-about-update-up-to-date = { -brand-short-name } är uppdaterad
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } är tillgänglig
zen-about-update-download = Ladda ner och installera
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Laddar ner uppdatering — { $transfer}
zen-about-update-applying = Tillämpar uppdatering…
zen-about-update-ready = Uppdateringen är redo att installera
zen-about-update-restart = Starta om för att uppdatera
zen-about-update-restarting = Startar om…
zen-about-update-download-failed = Uppdateringen kunde inte laddas ner
zen-about-update-checking-failed = Kunde inte söka efter uppdateringar
zen-about-update-internal-error = Uppdateringar är inte tillgängliga på grund av ett internt fel
zen-about-update-download-manually = Ladda ner manuellt
zen-about-update-manual = En ny version finns tillgänglig på nedladdningssidan
zen-about-update-policy-disabled = Uppdateringar är inaktiverade av din organisation
zen-about-update-other-instance = { -brand-short-name } uppdateras av en annan instans
zen-about-update-unsupported = Detta system kan inte längre ta emot uppdateringar
zen-about-update-learn-more = Läs mer

## Links

zen-about-release-notes = Vad är nytt
zen-about-donate = Donera
zen-about-report-issue = Rapportera ett problem
zen-about-community = { -brand-short-name } är fri och öppen källkod, byggd på { -zen-engine-name } av en <a data-l10n-name="github-link">gemenskap av bidragsgivare</a>.
zen-about-license = Licens
zen-about-rights = Dina rättigheter
zen-about-privacy = Sekretess
