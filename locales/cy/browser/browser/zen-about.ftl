# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Ynghylch { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Fersiwn { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Fersiwn { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Copïo gwybodaeth adeiladu
zen-about-copied = Copïwyd
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Yn seiliedig ar { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Chwilio am ddiweddariadau
zen-about-update-try-again = Ceisio eto
zen-about-update-checking = Yn gwirio am ddiweddariadau…
zen-about-update-up-to-date = Mae { -brand-short-name } yn gyfredol
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = Mae { -brand-short-name } { $version } ar gael
zen-about-update-download = Llwytho i lawr a gosod
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Llwytho diweddariad i lawr — { $transfer }
zen-about-update-applying = Yn rhoi'r diweddariad ar waith…
zen-about-update-ready = Mae'r diweddariad yn barod i'w osod
zen-about-update-restart = Ailgychwyn i ddiweddaru
zen-about-update-restarting = Yn ailgychwyn…
zen-about-update-download-failed = Doedd dim modd llwytho'r diweddariad i lawr
zen-about-update-checking-failed = Methu gwirio am ddiweddariadau
zen-about-update-internal-error = Dyw diweddariadau ddim ar gael oherwydd gwall mewnol
zen-about-update-download-manually = Llwytho i lawr â llwr
zen-about-update-manual = Mae fersiwn newydd ar gael ar y dudalen llwytho i lawr
zen-about-update-policy-disabled = Mae diweddariadau wedi'u hanalluogi gan eich sefydliad
zen-about-update-other-instance = Mae { -brand-short-name } yn cael ei ddiweddaru gan enghraifft arall
zen-about-update-unsupported = Dyw'r system hon ddim yn derbyn diweddariadau mwyach
zen-about-update-learn-more = Dysgu rhagor

## Links

zen-about-release-notes = Beth sy'n newydd
zen-about-donate = Rhoi
zen-about-report-issue = Rhoi gwybod am wall
zen-about-community = Mae { -brand-short-name } yn rhad ac am ddim ac yn god agored, wedi'i adeiladu ar { -zen-engine-name } gan <a data-l10n-name="github-link">gymuned o gyfranwyr</a> .
zen-about-license = Trwydded
zen-about-rights = Eich hawliau
zen-about-privacy = Preifatrwydd
