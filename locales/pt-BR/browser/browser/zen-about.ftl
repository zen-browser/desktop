# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Sobre { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Versão { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Version { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Copiar informações de build
zen-about-copied = Copiado
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Baseado em { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Buscar por atualizações
zen-about-update-check-again = Buscar novamente
zen-about-update-try-again = Tentar de novo
zen-about-update-checking = Procurando por atualizações…
zen-about-update-up-to-date = { -brand-short-name } está atualizado
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } está disponível
zen-about-update-download = Baixar e instalar
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Baixando a atualização — { $transfer}
zen-about-update-applying = Aplicando atualização…
zen-about-update-ready = A atualização está pronta para ser instalada
zen-about-update-restart = Reinicie para atualizar
zen-about-update-restarting = Reiniciando...
zen-about-update-download-failed = Não foi possível baixar a atualização
zen-about-update-checking-failed = Não foi possível verificar se há atualizações
zen-about-update-internal-error = As atualizações não estão disponíveis devido a um erro interno
zen-about-update-download-manually = Baixar manualmente
zen-about-update-manual = Uma nova versão está disponível na página de download
zen-about-update-policy-disabled = As atualizações estão desativadas pela sua organização
zen-about-update-other-instance = { -brand-short-name } está sendo atualizado por outra instância
zen-about-update-unsupported = Este sistema não pode mais receber atualizações
zen-about-update-learn-more = Saiba mais

## Links

zen-about-release-notes = O que há de novo
zen-about-donate = Doar
zen-about-report-issue = Reportar um erro
zen-about-community = { -brand-short-name } é gratuito e de código aberto, construído em { -zen-engine-name } por uma comunidade <a data-l10n-name="github-link">de colaboradores</a>.
zen-about-license = Licença
zen-about-rights = Seus direitos
zen-about-privacy = Privacidade
