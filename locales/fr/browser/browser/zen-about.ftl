# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = À propos de { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Version { $version } ({ $arch})
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Version { $version } ({ $isodate }) ({ $arch})
zen-about-version-button = 
    .title = Copier les informations de build
zen-about-copied = Copié
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Basé sur { -zen-engine-name } { $firefoxVersion}

## Update status

zen-about-update-check = Rechercher les mises à jour
zen-about-update-check-again = Vérifier à nouveau
zen-about-update-try-again = Réessayer
zen-about-update-checking = Recherche de mises à jour…
zen-about-update-up-to-date = { -brand-short-name } est à jour
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } est disponible
zen-about-update-download = Télécharger et installer
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Téléchargement de la mise à jour — { $transfer}
zen-about-update-applying = Application de la mise à jour…
zen-about-update-ready = La mise à jour est prête à être installée
zen-about-update-restart = Redémarrer pour mettre à jour
zen-about-update-restarting = Redémarrage…
zen-about-update-download-failed = Impossible de télécharger la mise à jour
zen-about-update-checking-failed = Impossible de vérifier les mises à jour disponibles
zen-about-update-internal-error = Les mises à jour ne sont pas disponibles en raison d'une erreur interne
zen-about-update-download-manually = Télécharger manuellement
zen-about-update-manual = Une nouvelle version est disponible sur la page de téléchargement
zen-about-update-policy-disabled = Les mises à jour sont désactivées par votre organisation
zen-about-update-other-instance = { -brand-short-name } est en cours de mise à jour par une autre instance
zen-about-update-unsupported = Ce système ne peut plus recevoir de mises à jour
zen-about-update-learn-more = En savoir plus

## Links

zen-about-release-notes = Quoi de neuf
zen-about-donate = Faire un don
zen-about-report-issue = Signaler un problème
zen-about-community = { -brand-short-name } est un logiciel libre et open source, développé à partir de { -zen-engine-name } par une <a data-l10n-name="github-link">communauté de contributeurs</a>.
zen-about-license = Licence
zen-about-rights = Vos droits
zen-about-privacy = Vie privée
