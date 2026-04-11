# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = текущ профил
unified-extensions-description = Разширенията се използват за добавяне на допълнителна функционалност към { -brand-short-name }.
tab-context-zen-reset-pinned-tab = 
    .label =
        { $isEssential ->
            [true] Reset Essential Tab
           *[false] Reset Pinned Tab
        }
    .accesskey = R
tab-context-zen-add-essential = 
    .label = Добавяне към Основни
    .accesskey = E
tab-context-zen-add-essential-badge = Запълнени слотове: { $num } / { $max }
tab-context-zen-remove-essential = 
    .label = Премахване от Основни
    .accesskey = R
tab-context-zen-replace-pinned-url-with-current = 
    .label =
        { $isEssential ->
            [true] Replace Essential URL with Current
           *[false] Replace Pinned URL with Current
        }
    .accesskey = C
tab-context-zen-edit-title = 
    .label = Промени етикета...
tab-context-zen-edit-icon = 
    .label = Промени иконата...
zen-themes-corrupted = Файлът с модификации на { -brand-short-name } е повреден. Те бяха нулирани до темата по подразбиране.
zen-shortcuts-corrupted = Файлът с клавишни комбинации на { -brand-short-name } е повреден. Комбинациите бяха нулирани до настройките по подразбиране.
# note: Do not translate the "<br/>" tags in the following string
zen-new-urlbar-notification =
    Новата адресна лента е активирана, което премахва нуждата от страници за нов раздел.<br/><br/>
    Опитай да отвориш нов раздел, за да видиш новата адресна лента в действие!
zen-disable = Изключи
pictureinpicture-minimize-btn = 
    .aria-label = Минимизирай
    .tooltip = Минимизирай
zen-panel-ui-gradient-generator-custom-color = Персонализиран цвят
zen-copy-current-url-confirmation = Текущият адрес е копиран!
zen-copy-current-url-as-markdown-confirmation = Copied current URL as Markdown!
zen-general-cancel-label = 
    .label = Отказ
zen-general-confirm = 
    .label = Потвърди
zen-pinned-tab-replaced = Адресът на закачения раздел беше заменен с текущия адрес!
zen-tabs-renamed = Разделът беше успешно преименуван!
zen-background-tab-opened-toast = Отворен е нов раздел на заден план!
zen-workspace-renamed-toast = Работното пространство беше преименувано успешно!
zen-toggle-compact-mode-button = 
    .label = Компактен изглед
    .tooltiptext = Превключи компактен режим

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = Научи повече
zen-close-label = Затвори
zen-singletoolbar-urlbar-placeholder-with-name = 
    .placeholder = Търси...
zen-icons-picker-emoji = 
    .label = Емоджита
zen-icons-picker-svg = 
    .label = Икони
urlbar-search-mode-zen_actions = Действия
zen-site-data-settings = Настройки
zen-generic-manage = Управление
zen-generic-more = Повече
zen-generic-next = Напред
zen-essentials-promo-label = Добави към Основни
zen-essentials-promo-sublabel = Дръж любимите си раздели само на един клик разстояние
# These labels will be used for the site data panel settings
zen-site-data-setting-allow = Позволено
zen-site-data-setting-block = Блокирани
zen-site-data-protections-enabled = Включено
zen-site-data-protections-disabled = Изключено
zen-site-data-setting-cross-site = Междусайтови бисквитки
zen-site-data-security-info-extension = 
    .label = Разширение
zen-site-data-security-info-secure = 
    .label = Защитено
zen-site-data-security-info-not-secure = 
    .label = Няма защита
zen-site-data-manage-addons = 
    .label = Управление на разширения
zen-site-data-get-addons = 
    .label = Добавяне на разширения
zen-site-data-site-settings = 
    .label = Всички настройки за сайтове
zen-site-data-header-share = 
    .tooltiptext = Сподели тази страница
zen-site-data-header-reader-mode = 
    .tooltiptext = Отвори режим на четене
zen-site-data-header-screenshot = 
    .tooltiptext = Направи екранна снимка
zen-site-data-header-bookmark = 
    .tooltiptext = Добави тази страница в отметки
zen-urlbar-copy-url-button = 
    .tooltiptext = Копирай адрес
zen-site-data-setting-site-protection = Защита от проследяване

# Section: Feature callouts

zen-site-data-panel-feature-callout-title = Ново място за добавки, разширения и още
zen-site-data-panel-feature-callout-subtitle = Натисни върху иконата, за да управляваш настройките на сайта, да видиш информацията за сигурността, да получиш достъп до разширенията и да извършваш често използвани действия.
zen-open-link-in-glance = 
    .label = Отвори връзката в Glance
    .accesskey = Ж
zen-sidebar-notification-updated-heading = Актуализацията е завършена!

# See ZenSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = Какво е ново в { -brand-short-name }
zen-sidebar-notification-updated-tooltip = 
    .title = Виж бележките към изданието
zen-sidebar-notification-restart-safe-mode-label = Има проблем?
zen-sidebar-notification-restart-safe-mode-tooltip = 
    .title = Рестартирай в безопасен режим
zen-window-sync-migration-dialog-title = Синхронизирай прозорците си
zen-window-sync-migration-dialog-message = Zen вече синхронизира прозорците на едно и също устройство, така че промените в един прозорец се отразяват незабавно във всички останали.
zen-window-sync-migration-dialog-learn-more = Научи повече
zen-window-sync-migration-dialog-accept = Добре
zen-appmenu-new-blank-window = 
    .label = New blank window
