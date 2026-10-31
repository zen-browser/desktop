# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Quant al { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Versió { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Versió { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Copia la informació de la compilació
zen-about-copied = Copiat
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Basat en { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Cerca actualitzacions
zen-about-update-check-again = Torna-ho a provar
zen-about-update-try-again = Torna-ho a provar
zen-about-update-checking = S'està comprovant si hi ha actualitzacions…
zen-about-update-up-to-date = El { -brand-short-name } està actualitzat
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = El { -brand-short-name } { $version } està disponible
zen-about-update-download = Baixa i instal·la
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = S'està baixant l'actualització: { $transfer }
zen-about-update-applying = S'està aplicant l'actualització…
zen-about-update-ready = L'actualització està a punt per instal·lar-se
zen-about-update-restart = Reinicia per actualitzar
zen-about-update-restarting = S'està reiniciant…
zen-about-update-download-failed = No s'ha pogut baixar l'actualització
zen-about-update-checking-failed = No s'ha pogut comprovar les actualitzacions
zen-about-update-internal-error = Les actualitzacions no estan disponibles a causa d'un error intern
zen-about-update-download-manually = Baixa manualment
zen-about-update-manual = Hi ha una nova versió disponible a la pàgina de baixades
zen-about-update-policy-disabled = Les actualitzacions estan desactivades per la vostra organització
zen-about-update-other-instance = { -brand-short-name } està sent actualitzat per una altra instància
zen-about-update-unsupported = Aquest sistema ja no pot rebre actualitzacions
zen-about-update-learn-more = Més informació

## Links

zen-about-release-notes = Novetats
zen-about-donate = Feu un donatiu
zen-about-report-issue = Notifica un problema
zen-about-community = { -brand-short-name } és programari lliure i de codi obert, construït sobre { -zen-engine-name } per una <a data-l10n-name="github-link">comunitat de col·laboradors</a>.
zen-about-license = Llicència
zen-about-rights = Els vostres drets
zen-about-privacy = Privadesa
