# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Informazioni Su { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Versione { $version } ({ $arch})
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Versione { $version } ({ $isodate }) ({ $arch})
zen-about-version-button = 
    .title = Copia informazioni build
zen-about-copied = Copiato
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Basato su { -zen-engine-name } { $firefoxVersion}

## Update status

zen-about-update-check = Controllo aggiornamenti
zen-about-update-try-again = Riprova
zen-about-update-checking = Ricerca aggiornamenti…
zen-about-update-up-to-date = { -brand-short-name } è aggiornato!
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } è disponibile
zen-about-update-download = Scarica e installa
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Scarica aggiornamento — { $transfer}
zen-about-update-applying = Installazione aggiornamento…
zen-about-update-ready = L'aggiornamento è pronto per l'installazione
zen-about-update-restart = Riavvia per aggiornare
zen-about-update-restarting = Riavvio…
zen-about-update-download-failed = Non è stato possibile scaricare l'aggiornamento
zen-about-update-checking-failed = Non è stato possibile verificare la disponibilità di aggiornamenti
zen-about-update-internal-error = Gli aggiornamenti non sono disponibili a causa di un errore interno
zen-about-update-download-manually = Scarica manualmente
zen-about-update-manual = Una nuova versione è disponibile nella pagina di download
zen-about-update-policy-disabled = Gli aggiornamenti sono disattivati dalla tua organizzazione
zen-about-update-other-instance = { -brand-short-name } è in aggiornamento da un'altra istanza
zen-about-update-unsupported = Questo sistema non può più ricevere aggiornamenti
zen-about-update-learn-more = Altre informazioni

## Links

zen-about-release-notes = Cosa c'è di nuovo
zen-about-donate = Effettua una donazione
zen-about-report-issue = Segnala un bug
zen-about-community = { -brand-short-name } è gratuito e open source, costruito su { -zen-engine-name } da una comunità <a data-l10n-name="github-link">di contributori</a>.
zen-about-license = Licenza
zen-about-rights = I tuoi diritti
zen-about-privacy = Privacy
