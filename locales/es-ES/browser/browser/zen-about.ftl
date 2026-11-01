# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Acerca de { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Versión { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Versión { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Copiar información de compilación
zen-about-copied = Copiado
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Basado en { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Buscar actualizaciones
zen-about-update-check-again = Volver a buscar
zen-about-update-try-again = Volver a intentarlo
zen-about-update-checking = Buscando actualizaciones…
zen-about-update-up-to-date = { -brand-short-name } está actualizado
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } está disponible
zen-about-update-download = Descargar e instalar
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Descargando actualización — { $transfer }
zen-about-update-applying = Aplicando actualización…
zen-about-update-ready = La actualización está lista para instalar
zen-about-update-restart = Reiniciar para actualizar
zen-about-update-restarting = Reiniciando…
zen-about-update-download-failed = No se pudo descargar la actualización
zen-about-update-checking-failed = No se pudieron buscar actualizaciones
zen-about-update-internal-error = Las actualizaciones no están disponibles debido a un error interno
zen-about-update-download-manually = Descargar manualmente
zen-about-update-manual = Una nueva versión está disponible en la página de descarga
zen-about-update-policy-disabled = Las actualizaciones están deshabilitadas por su organización
zen-about-update-other-instance = { -brand-short-name } está siendo actualizado por otra instancia
zen-about-update-unsupported = Este sistema ya no puede recibir actualizaciones
zen-about-update-learn-more = Más información

## Links

zen-about-release-notes = Novedades
zen-about-donate = Donar
zen-about-report-issue = Informar de un problema
zen-about-community = { -brand-short-name } es gratuito y de código abierto, basado en { -zen-engine-name } por una <a data-l10n-name="github-link">comunidad de colaboradores</a>.
zen-about-license = Licencia
zen-about-rights = Sus derechos
zen-about-privacy = Privacidad
