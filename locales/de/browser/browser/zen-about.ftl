# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Über { -brand-full-name }
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
    .title = Build-Informationen kopieren
zen-about-copied = Kopiert
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Basiert auf { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Nach Updates suchen
zen-about-update-try-again = Erneut versuchen
zen-about-update-checking = Suche nach Updates…
zen-about-update-up-to-date = { -brand-short-name } ist auf dem neuesten Stand
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } ist verfügbar
zen-about-update-download = Herunterladen und installieren
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Update wird heruntergeladen: { $transfer }
zen-about-update-applying = Update wird angewendet…
zen-about-update-ready = Das Update ist bereit zur Installation
zen-about-update-restart = Zum Aktualisieren neu starten
zen-about-update-restarting = Wird neu gestartet…
zen-about-update-download-failed = Das Update konnte nicht heruntergeladen werden
zen-about-update-checking-failed = Die Suche nach Updates ist fehlgeschlagen
zen-about-update-internal-error = Updates sind wegen eines internen Fehlers nicht verfügbar
zen-about-update-download-manually = Manuell herunterladen
zen-about-update-manual = Eine neue Version ist auf der Downloadseite verfügbar
zen-about-update-policy-disabled = Updates wurden von deiner Organisation deaktiviert
zen-about-update-other-instance = { -brand-short-name } wird gerade von einer anderen Instanz aktualisiert
zen-about-update-unsupported = Dieses System kann keine Updates mehr erhalten
zen-about-update-learn-more = Mehr erfahren

## Links

zen-about-release-notes = Was ist neu
zen-about-donate = Spenden
zen-about-report-issue = Problem melden
zen-about-community = { -brand-short-name } ist freie Open-Source-Software, entwickelt auf Basis von { -zen-engine-name } von einer <a data-l10n-name="github-link">Community aus Mitwirkenden</a>.
zen-about-license = Lizenz
zen-about-rights = Deine Rechte
zen-about-privacy = Datenschutz
