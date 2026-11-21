# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Про { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Версія { $version } ({ $arch})
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Версія { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Копіювати інформацію про збірку
zen-about-copied = Скопійовано
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = На основі { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Перевірити оновлення
zen-about-update-try-again = Спробувати знову
zen-about-update-checking = Перевірка оновлень…
zen-about-update-up-to-date = { -brand-short-name } оновлено
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = Доступно { -brand-short-name } { $version }
zen-about-update-download = Завантажити та встановити
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Завантаження оновлення: { $transfer}
zen-about-update-applying = Застосовую оновлення…
zen-about-update-ready = Оновлення готове до встановлення
zen-about-update-restart = Перезапустіть, щоб оновити
zen-about-update-restarting = Перезапуск…
zen-about-update-download-failed = Не вдалося завантажити оновлення
zen-about-update-checking-failed = Не вдалося перевірити наявність оновлень
zen-about-update-internal-error = Оновлення недоступні через внутрішню помилку
zen-about-update-download-manually = Завантажити вручну
zen-about-update-manual = Нова версія доступна на сторінці завантаження
zen-about-update-policy-disabled = Оновлення вимкнено вашою організацією
zen-about-update-other-instance = { -brand-short-name } оновлюється в іншому екземплярі
zen-about-update-unsupported = Ця система більше не може отримувати оновлення
zen-about-update-learn-more = Докладніше

## Links

zen-about-release-notes = Що нового
zen-about-donate = Пожертвувати
zen-about-report-issue = Повідомити про проблему
zen-about-community = { -brand-short-name } — безплатний продукт із відкритим кодом, створений на основі { -zen-engine-name } <a data-l10n-name="github-link">спільнотою вкладників</a>.
zen-about-license = Ліцензія
zen-about-rights = Ваші права
zen-about-privacy = Приватність
